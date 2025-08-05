const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

// Add login route
router.post('/login', userController.login);

router.get('/', userController.getAllUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.get('/:id/enrollments', userController.getUserEnrollments);
router.post('/refresh-token', userController.refreshToken);

module.exports = router;