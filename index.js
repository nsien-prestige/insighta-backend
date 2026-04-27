require('dotenv').config();
const express = require('express');
const cors = require('cors');
const profileRouter = require('./routes/profiles');

const app = express()


app.use(cors());
app.use(express.json());

app.use('/api/profiles', profileRouter)

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})