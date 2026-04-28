const { verifyAccessToken } = require("../utils/token");

const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            "status": "error",
            "message": 'Access token required' 
            });
    }

    const token = authHeader.split(' ')[1]

    try {
        const decoded = verifyAccessToken(token)
        req.user = decoded
        next()

    } catch (err) {
        return res.status(401).json({ 
            "status": 'error',
            "message": 'Invalid or expired access token' });
    }
}

module.exports = authenticate