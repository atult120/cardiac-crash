const doceboService = require('../services/doceboService');
const { AppError } = require('../utils/errorHandler');

exports.getAllUsers = async (req, res, next) => {
  try {
    const result = await doceboService.getAllUsers(req.query);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    // Generate a random unique ID for the user
    const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    // Validate role (must be either 'tutor' or 'corporate')
    const role = req.body.role?.toLowerCase();
    
    const userData = {
      ...req.body,
      userid: uniqueId,
      // level: role === 'tutor' ? 7 : 6,
    };
    
    const result = await doceboService.createUser(userData);
    res.status(201).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await doceboService.updateUser(id, req.body);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    await doceboService.deleteUser(id);
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserEnrollments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await doceboService.getUserEnrollments(id);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// New login controller
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return next(new AppError('Please provide username and password', 400));
    }
    
    // Attempt login
    const result = await doceboService.loginUser(username, password);
      
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// New refresh token controller
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    // Validate input
    if (!refreshToken) {
      return next(new AppError('Please provide refresh token', 400));
    }
    
    // Attempt refresh
    const result = await doceboService.refreshToken(refreshToken);
      
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};
