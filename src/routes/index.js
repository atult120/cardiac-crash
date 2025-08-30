const express = require('express');
const userRoutes = require('./userRoutes');
const courseRoutes = require('./courseRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const healthRoutes = require('./healthRoutes');
const sessionRoute = require('./session');
const dashboardRoutes = require('./dashboardRoutes');


const router = express.Router();

// Register all routes
router.use('/api/users', userRoutes);
router.use('/api/courses', courseRoutes);
router.use('/api/analytics', analyticsRoutes);
router.use('/health', healthRoutes);
router.use('/api/sessions' , sessionRoute)
router.use('/api/dashboard' , dashboardRoutes);

module.exports = router;