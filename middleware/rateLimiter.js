const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            status: 'error',
            message: 'Too many requests, please try again later.'
        })
    }
})

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // limit each IP to 60 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise fall back to IP
        if (req.user) return req.user.id
        // Strip ::ffff: prefix from IPv4-mapped IPv6 addresses
        const ip = req.ip || req.socket?.remoteAddress || 'unknown'
        return ip.replace(/^::ffff:/, '')
    },
    handler: (req, res) => {
        res.status(429).json({
            status: 'error',
            message: 'Too many requests, please try again later.'
        })
    }
})

module.exports = {
    authLimiter,
    apiLimiter
}
