const doceboService = require('../services/doceboService');
const { AppError } = require('../utils/errorHandler');
const { capitalizeFirstLetter } = require('../utils/helper');

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
    const role = capitalizeFirstLetter(req.body.role);
    const roleCourseMap = {
      Educator: [183, 184],
      Corporate: [185, 184]
    };

    const userData = {
      ...req.body,
      userid: req.body.email,
       additional_fields: {
        "4": role
     }
    };    

    const result = await doceboService.createUser(userData);

    const userId = result.data.user_id;
    const courseIds = roleCourseMap[role] || [];

    const enrollmentPayload = {
      course_ids: courseIds,
      user_ids: [userId],
      level: "3",
      assignment_type: "mandatory"
    };

    await doceboService.enrollUserInCourse(enrollmentPayload);

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



exports.redirectToDocebo = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { redirectPath } = req.query;
    
    // Validate input
    if (!userId) {
      return next(new AppError('Please provide user ID', 400));
    }
    
    // Generate Docebo dashboard URL
    const result = await doceboService.generateDoceboRedirectUrl(userId, redirectPath);
      
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};




