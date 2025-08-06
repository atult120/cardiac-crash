const express = require('express');
const courseController = require('../controllers/courseController');

const router = express.Router();

router.get('/', courseController.getCourses);
router.get('/sdk-url', courseController.getSdkUrl);
router.get('/:id', courseController.getCourseById);
router.post('/enroll', courseController.enrollUserInCourse);

module.exports = router;