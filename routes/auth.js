const express = require('express');
const { githubLogin, githubCallback, refreshToken, logout, cliCallback, getMe } = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const authenticate = require('../middleware/authenticate');
const router = express.Router();

router.get('/github', authLimiter, githubLogin)
router.get('/github/callback', authLimiter, githubCallback)
router.get('/me', authenticate, getMe)
router.post('/cli/callback', authLimiter, cliCallback)
router.post('/refresh', authLimiter, refreshToken)
router.post('/logout', authLimiter, logout)

module.exports = router