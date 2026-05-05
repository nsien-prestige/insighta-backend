const express = require('express');
const { getAllProfiles, searchProfiles, exportProfiles, getProfileById, createProfile, deleteProfile } = require('../controllers/profilesController');
const authenticate = require('../middleware/authenticate');
const requireApiVersion = require('../middleware/requireApiVersion');
const { apiLimiter } = require('../middleware/rateLimiter');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

router.use(requireApiVersion)
router.use(authenticate)
router.use(apiLimiter)

router.get('/', getAllProfiles)
router.get('/search', searchProfiles)
router.get('/export', exportProfiles)
router.get('/:id', getProfileById)

// Admin only routes
router.post('/', requireRole('admin'), createProfile)
router.delete('/:id', requireRole('admin'), deleteProfile)

module.exports = router
