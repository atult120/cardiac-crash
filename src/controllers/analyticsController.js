const doceboService = require('../services/doceboService');

exports.getUserCourseProgress = async (req, res, next) => {
  try {
    const { userId, courseId } = req.params;
    const result = await doceboService.getUserCourseProgress(userId, courseId);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getResumeLink = async (req, res, next) => {
  try {
    const { userId, courseId } = req.params;
    const result = await doceboService.getResumeLink(userId, courseId);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getCourseStatistics = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const result = await doceboService.getCourseStatistics(courseId);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};