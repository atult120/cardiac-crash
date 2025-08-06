const doceboService = require('../services/doceboService');

exports.getCourses = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    console.log(token);
    const result = await doceboService.getCourses(req.query , token);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getCourseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await doceboService.getCourseById(id);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.enrollUserInCourse = async (req, res, next) => {
  try {
    const result = await doceboService.enrollUserInCourse(req.body);
    res.status(201).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
 };

  exports.getSdkUrl = async (req, res, next) => {
    try {
      const result = await doceboService.getSdkUrl();
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

