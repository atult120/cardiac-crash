const express = require('express');
const userController = require('../controllers/userController');
const { validateCreateUser } = require('../utils/validators');

const router = express.Router();

router.get('/', userController.getAllUsers);
router.post('/', validateCreateUser, userController.createUser);
router.post('/login', userController.login);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.get('/:id/enrollments', userController.getUserEnrollments);

// Docebo Dashboard Redirection Routes
router.get('/:userId/docebo-sso', userController.redirectToDocebo);

module.exports = router;