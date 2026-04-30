const { verifyAccessToken } = require('../utils/token')

const authenticate = (req, res, next) => {
    // Check Authorization header first (CLI)
    const authHeader = req.headers['authorization']
    let token = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1]
    } else if (req.cookies?.access_token) {
        // Fall back to cookie (web portal)
        token = req.cookies.access_token
    }

    if (!token) {
        return res.status(401).json({
            status: 'error',
            message: 'Access token required'
        })
    }

    try {
        const decoded = verifyAccessToken(token)
        req.user = decoded
        next()
    } catch (err) {
        return res.status(401).json({
            status: 'error',
            message: 'Invalid or expired access token'
        })
    }
}

module.exports = authenticate