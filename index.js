require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const profileRouter = require('./routes/profiles');
const authRouter = require('./routes/auth');

const app = express()

app.use(morgan('dev'))

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}));

app.use(express.json());
app.use(cookieParser())

app.use('/auth', authRouter)
app.use('/api/profiles', profileRouter)

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})