const express = require('express');
const userController = require('../controllers/userController');
const { validateCreateUser } = require('../utils/validators');

const router = express.Router();

router.get('/', userController.getAllUsers);
router.post('/', validateCreateUser, userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.get('/:id/enrollments', userController.getUserEnrollments);

module.exports = router;