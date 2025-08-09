class AppError extends Error {
  constructor(message, statusCode) {
    // Ensure message is a string
    const formattedMessage = typeof message === 'object' ? 
      JSON.stringify(message) : String(message);
    
    super(formattedMessage);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const handleError = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  // Ensure message is a string
  const message = typeof err.message === 'object' ? 
    JSON.stringify(err.message) : String(err.message);

  res.status(err.statusCode).json({
    status: err.status,
    message: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = {
  AppError,
  handleError
};