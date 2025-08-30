const calcomService = require("../services/calcomService");
const dashboardService = require("../services/dashboardService");

async function getDashboard(req, res , next) {
 try {
    const token = req.headers.authorization?.split(' ')[1];
    const result = await dashboardService.getDashboardData(req.query , token);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.getDashboard = getDashboard;