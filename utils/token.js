const jwt = require('jsonwebtoken')
const { uuidv7 } = require('uuidv7')
const pool = require('../db/db')

const ACCESS_TOKEN_EXPIRY = '3m'
const REFRESH_TOKEN_EXPIRY = '5m'
const REFRESH_TOKEN_EXPIRY_MS = 5 * 60 * 1000

const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    )
}

const generateRefreshToken = async (userId) => {
    const token = jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    )

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)

    await pool.query(
        `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [uuidv7(), userId, token, expiresAt]
    )

    return token
}

const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET)
}

const verifyRefreshToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET)
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
}
