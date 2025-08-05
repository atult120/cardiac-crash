exports.checkHealth = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Service is healthy',
    timestamp: new Date().toISOString()
  });
};