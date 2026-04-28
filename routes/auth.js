const express = require('express');
const { githubLogin, githubCallback, refreshToken, logout } = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const router = express.Router();


router.get('/github', authLimiter, githubLogin)
router.get('/github/callback', authLimiter, githubCallback)
router.post('/refresh', authLimiter, refreshToken)
router.post('/logout', authLimiter, logout)

module.exports = router