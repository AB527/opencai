const { AppError } = require('./errorHandler');
const { ERROR_CODES } = require('../constants/errors');

// Usage: router.get('/admin-only', requireAuth, requireRole('ADMIN'), handler)
function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return next(new AppError(401, ERROR_CODES.UNAUTHENTICATED));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, ERROR_CODES.FORBIDDEN));
    }
    return next();
  };
}

module.exports = { requireRole };
