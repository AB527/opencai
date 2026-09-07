const { ERROR_CODES, ERROR_MESSAGES } = require('../constants/errors');

class AppError extends Error {
  constructor(status, code, message) {
    super(message || ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR]);
    this.status = status;
    this.code = code;
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  console.error(err);
  return res.status(500).json({
    error: { code: ERROR_CODES.INTERNAL_ERROR, message: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR] },
  });
}

module.exports = { AppError, errorHandler };
