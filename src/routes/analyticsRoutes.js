const express = require('express');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

router.get('/progress/:userId/:courseId', analyticsController.getUserCourseProgress);
router.get('/resume/:userId/:courseId', analyticsController.getResumeLink);
router.get('/course/:courseId', analyticsController.getCourseStatistics);

module.exports = router;