const express = require('express');
const { getAllProfiles, searchProfiles } = require('../controllers/profilesController');

const router = express.Router();

router.get('/search', searchProfiles)
router.get('/', getAllProfiles)

module.exports = router
