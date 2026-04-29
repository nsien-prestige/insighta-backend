const pool = require('../db/db')
const { uuidv7 } = require('uuidv7')
const axios = require('axios')
const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken
} = require('../utils/token')

// Helper - create or update user from github data
const findOrCreateUser = async (githubUser, primaryEmail) => {
    const existingUser = await pool.query(
        `SELECT * FROM users WHERE github_id = $1`,
        [String(githubUser.id)]
    )

    let user

    if (existingUser.rows.length > 0) {
        const updated = await pool.query(
            `UPDATE users 
             SET username = $1, email = $2, avatar_url = $3, last_login_at = NOW()
             WHERE github_id = $4
             RETURNING *`,
            [githubUser.login, primaryEmail, githubUser.avatar_url, String(githubUser.id)]
        )
        user = updated.rows[0]
    } else {
        const created = await pool.query(
            `INSERT INTO users (id, github_id, username, email, avatar_url, role, is_active, last_login_at, created_at)
             VALUES ($1, $2, $3, $4, $5, 'analyst', true, NOW(), NOW())
             RETURNING *`,
            [uuidv7(), String(githubUser.id), githubUser.login, primaryEmail, githubUser.avatar_url]
        )
        user = created.rows[0]
    }

    return user
}

// Helper - fetch github user info using access token
const getGithubUser = async (githubAccessToken) => {
    const [userResponse, emailResponse] = await Promise.all([
        axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${githubAccessToken}` }
        }),
        axios.get('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${githubAccessToken}` }
        })
    ])

    const githubUser = userResponse.data
    const emails = emailResponse.data
    const primaryEmail = emails.find(e => e.primary)?.email || null

    return { githubUser, primaryEmail }
}

// Step 1 - Redirect user to GitHub OAuth page (both CLI and web use this)
const githubLogin = (req, res) => {
    const { state, code_challenge } = req.query

    if (!state || !code_challenge) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing state or code_challenge'
        })
    }

    const params = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID,
        redirect_uri: process.env.GITHUB_CALLBACK_URL,
        scope: 'read:user user:email',
        state,
        code_challenge,
        code_challenge_method: 'S256'
    })

    res.redirect(`https://github.com/login/oauth/authorize?${params}`)
}

// Step 2a - Web portal callback
// GitHub redirects here after web login
// Returns tokens as HTTP-only cookies (tokens never exposed to JS)
const githubCallback = async (req, res) => {
    const { code } = req.query

    if (!code) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing authorization code'
        })
    }

    try {
        // Exchange code for GitHub access token
        const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: process.env.GITHUB_CALLBACK_URL,
            },
            { headers: { Accept: 'application/json' } }
        )

        const githubAccessToken = tokenResponse.data.access_token

        if (!githubAccessToken) {
            return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`)
        }

        const { githubUser, primaryEmail } = await getGithubUser(githubAccessToken)
        const user = await findOrCreateUser(githubUser, primaryEmail)

        if (!user.is_active) {
            return res.redirect(`${process.env.CLIENT_URL}/login?error=account_disabled`)
        }

        const accessToken = generateAccessToken(user)
        const refreshToken = await generateRefreshToken(user.id)

        // Set tokens as HTTP-only cookies - JS cannot read these
        res.cookie('access_token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 3 * 60 * 1000 // 3 minutes
        })

        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 5 * 60 * 1000 // 5 minutes
        })

        // Redirect to web portal dashboard
        res.redirect(`${process.env.CLIENT_URL}/dashboard`)

    } catch (err) {
        console.error(err)
        res.redirect(`${process.env.CLIENT_URL}/login?error=server_error`)
    }
}

// Step 2b - CLI callback
// CLI starts local server, captures code from GitHub,
// then posts { code, code_verifier } here
// Returns tokens as JSON (CLI stores them locally)
const cliCallback = async (req, res) => {
    const { code, code_verifier } = req.body

    if (!code || !code_verifier) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing code or code_verifier'
        })
    }

    try {
        // Exchange code + code_verifier with GitHub
        // GitHub uses code_verifier to verify PKCE challenge
        const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: process.env.GITHUB_CLI_CLIENT_ID,
                client_secret: process.env.GITHUB_CLI_CLIENT_SECRET,
                code,
                redirect_uri: 'http://localhost:9876/callback',
                code_verifier
            },
            { headers: { Accept: 'application/json' } }
        )

        const githubAccessToken = tokenResponse.data.access_token

        if (!githubAccessToken) {
            return res.status(401).json({
                status: 'error',
                message: 'Failed to obtain access token from GitHub'
            })
        }

        const { githubUser, primaryEmail } = await getGithubUser(githubAccessToken)
        const user = await findOrCreateUser(githubUser, primaryEmail)

        if (!user.is_active) {
            return res.status(403).json({
                status: 'error',
                message: 'Account is disabled'
            })
        }

        const accessToken = generateAccessToken(user)
        const refreshToken = await generateRefreshToken(user.id)

        // Return tokens as JSON - CLI will store them locally
        res.status(200).json({
            status: 'success',
            access_token: accessToken,
            refresh_token: refreshToken,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar_url: user.avatar_url,
                role: user.role
            }
        })

    } catch (err) {
        console.error(err)
        res.status(500).json({
            status: 'error',
            message: 'Authentication failed'
        })
    }
}

// Refresh tokens
const refreshToken = async (req, res) => {
    // Check both request body (CLI) and cookies (web portal)
    const token = req.body.refresh_token || req.cookies?.refresh_token

    if (!token) {
        return res.status(400).json({
            status: 'error',
            message: 'Refresh token required'
        })
    }

    try {
        const decoded = verifyRefreshToken(token)

        const stored = await pool.query(
            `SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`,
            [token]
        )

        if (stored.rows.length === 0) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid or expired refresh token'
            })
        }

        // Delete old token immediately - token rotation
        await pool.query(
            `DELETE FROM refresh_tokens WHERE token = $1`,
            [token]
        )

        const userResult = await pool.query(
            `SELECT * FROM users WHERE id = $1`,
            [decoded.id]
        )

        const user = userResult.rows[0]

        if (!user || !user.is_active) {
            return res.status(403).json({
                status: 'error',
                message: 'Account not found or disabled'
            })
        }

        const newAccessToken = generateAccessToken(user)
        const newRefreshToken = await generateRefreshToken(user.id)

        // If request came from web (has cookies), respond with cookies
        if (req.cookies?.refresh_token) {
            res.cookie('access_token', newAccessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 3 * 60 * 1000
            })

            res.cookie('refresh_token', newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 5 * 60 * 1000
            })

            return res.status(200).json({
                status: 'success',
                message: 'Tokens refreshed'
            })
        }

        // Otherwise respond with JSON (CLI)
        res.status(200).json({
            status: 'success',
            access_token: newAccessToken,
            refresh_token: newRefreshToken
        })

    } catch (err) {
        console.error(err)
        res.status(401).json({
            status: 'error',
            message: 'Invalid or expired refresh token'
        })
    }
}

// Logout
const logout = async (req, res) => {
    // Check both body (CLI) and cookies (web)
    const token = req.body.refresh_token || req.cookies?.refresh_token

    if (!token) {
        return res.status(400).json({
            status: 'error',
            message: 'Refresh token required'
        })
    }

    try {
        await pool.query(
            `DELETE FROM refresh_tokens WHERE token = $1`,
            [token]
        )

        // Clear cookies if they exist (web portal)
        if (req.cookies?.refresh_token) {
            res.clearCookie('access_token')
            res.clearCookie('refresh_token')
        }

        res.status(200).json({
            status: 'success',
            message: 'Logged out successfully'
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({
            status: 'error',
            message: 'Logout failed'
        })
    }
}

const getMe = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, email, avatar_url, role, created_at, last_login_at
             FROM users WHERE id = $1`,
            [req.user.id]
        )

        if (result.rows.length === 0) {
            return res.status(404).json({
                "status": "error",
                "message": "User not found"
            })
        }

        res.status(200).json({
            "status": "success",
            "data": result.rows[0]
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({
            "status": "error",
            "message": "Failed to fetch user info"
        })
    }
}

module.exports = {
    githubLogin,
    githubCallback,
    cliCallback,
    refreshToken,
    logout
}