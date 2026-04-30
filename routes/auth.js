const express = require('express');
const { githubLogin, githubCallback, refreshToken, logout, cliCallback, getMe } = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const authenticate = require('../middleware/authenticate');
const router = express.Router();

router.get('/github', authLimiter, githubLogin)
router.get('/github/callback', authLimiter, githubCallback)
router.get('/me', authenticate, getMe)
router.post('/cli/callback', authLimiter, cliCallback)

// POST-only routes with explicit method enforcement
router.post('/refresh', authLimiter, refreshToken)
router.post('/logout', authLimiter, logout)

// Catch wrong HTTP methods on these routes and return 405
const methodNotAllowed = (req, res) => {
    res.status(405).json({
        status: 'error',
        message: 'Method not allowed. Use POST.'
    })
}
router.all('/refresh', methodNotAllowed)
router.all('/logout', methodNotAllowed)

module.exports = router