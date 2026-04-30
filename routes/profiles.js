const express = require('express');
const { getAllProfiles, searchProfiles, exportProfiles, getProfileById, createProfile } = require('../controllers/profilesController');
const authenticate = require('../middleware/authenticate');
const requireApiVersion = require('../middleware/requireApiVersion');
const { apiLimiter } = require('../middleware/rateLimiter');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.use(requireApiVersion)
router.use(authenticate)
router.use(apiLimiter)

// Public routes
router.get('/', getAllProfiles)
router.get('/search', searchProfiles)
router.get('/export', exportProfiles)
router.get('/:id', getProfileById)

// Admin only routes
router.post('/', requireRole('admin'), createProfile)

module.exports = router
