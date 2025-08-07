const { body, validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

// User validation middleware
const validateCreateUser = [
  body('firstname').notEmpty().withMessage('First name is required'),
  body('lastname').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('role').notEmpty().withMessage('Role is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError(errors.array().map(err => err.msg).join(', '), 400));
    }
    next();
  }
];

module.exports = {
  validateCreateUser
};