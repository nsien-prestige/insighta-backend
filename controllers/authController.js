const pool = require('../db/db')
const { uuidv7 } = require('uuidv7')
const axios = require('axios')
const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken
} = require('../utils/tokens')

// Step 1 - Redirect user to GitHub OAuth page
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

// Step 2 - GitHub redirects back here after user authenticates
const githubCallback = async (req, res) => {
    const { code, state, code_verifier } = req.query

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

        // Fetch user info from GitHub
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

        // Create or update user in our database
        const existingUser = await pool.query(
            `SELECT * FROM users WHERE github_id = $1`,
            [String(githubUser.id)]
        )

        let user

        if (existingUser.rows.length > 0) {
            // User exists - update their info and last login
            const updated = await pool.query(
                `UPDATE users 
                 SET username = $1, email = $2, avatar_url = $3, last_login_at = NOW()
                 WHERE github_id = $4
                 RETURNING *`,
                [githubUser.login, primaryEmail, githubUser.avatar_url, String(githubUser.id)]
            )
            user = updated.rows[0]
        } else {
            // New user - create them with default analyst role
            const created = await pool.query(
                `INSERT INTO users (id, github_id, username, email, avatar_url, role, is_active, last_login_at, created_at)
                 VALUES ($1, $2, $3, $4, $5, 'analyst', true, NOW(), NOW())
                 RETURNING *`,
                [uuidv7(), String(githubUser.id), githubUser.login, primaryEmail, githubUser.avatar_url]
            )
            user = created.rows[0]
        }

        // Check if user is active
        if (!user.is_active) {
            return res.status(403).json({
                status: 'error',
                message: 'Account is disabled'
            })
        }

        // Issue tokens
        const accessToken = generateAccessToken(user)
        const refreshToken = await generateRefreshToken(user.id)

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
    const { refresh_token } = req.body

    if (!refresh_token) {
        return res.status(400).json({
            status: 'error',
            message: 'Refresh token required'
        })
    }

    try {
        // Verify the token is valid JWT
        const decoded = verifyRefreshToken(refresh_token)

        // Check it exists in our database
        const stored = await pool.query(
            `SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`,
            [refresh_token]
        )

        if (stored.rows.length === 0) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid or expired refresh token'
            })
        }

        // Invalidate old token immediately (token rotation)
        await pool.query(
            `DELETE FROM refresh_tokens WHERE token = $1`,
            [refresh_token]
        )

        // Get fresh user data
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

        // Issue new token pair
        const newAccessToken = generateAccessToken(user)
        const newRefreshToken = await generateRefreshToken(user.id)

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
    const { refresh_token } = req.body

    if (!refresh_token) {
        return res.status(400).json({
            status: 'error',
            message: 'Refresh token required'
        })
    }

    try {
        await pool.query(
            `DELETE FROM refresh_tokens WHERE token = $1`,
            [refresh_token]
        )

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

module.exports = {
    githubLogin,
    githubCallback,
    refreshToken,
    logout
}