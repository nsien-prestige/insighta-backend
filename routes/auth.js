const express = require('express');
const { githubLogin, githubCallback, refreshToken, logout, cliCallback } = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const router = express.Router();

router.get('/github', authLimiter, githubLogin)
router.get('/github/callback', authLimiter, githubCallback)
router.post('/cli/callback', authLimiter, cliCallback)
router.post('/refresh', authLimiter, refreshToken)
router.post('/logout', authLimiter, logout)

module.exports = router