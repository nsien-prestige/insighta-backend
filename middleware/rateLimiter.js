const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 requests per windowMs
    standarhHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        res.status(429).json({
            "status": "error",
            "message": "Too many requests, please try again later."
        })
    }
})

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // limit each IP to 60 requests per windowMs
    standarhHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => {
        return req.user ? req.user.id : req.ip; // Use user ID if authenticated, otherwise use IP address
    },
    handler: (req, res) => {
        res.status(429).json({
            "status": "error",
            "message": "Too many requests, please try again later."
        })
    }
})

module.exports = {
    authLimiter,
    apiLimiter
}