const express = require('express');
const userRoutes = require('./userRoutes');
const courseRoutes = require('./courseRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const healthRoutes = require('./healthRoutes');

const router = express.Router();

// Register all routes
router.use('/api/users', userRoutes);
router.use('/api/courses', courseRoutes);
router.use('/api/analytics', analyticsRoutes);
router.use('/health', healthRoutes);

module.exports = router;