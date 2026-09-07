const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { AppError } = require('./errorHandler');
const { ERROR_CODES } = require('../constants/errors');

// Verifies a session JWT (issued by modules/auth on successful login + MFA)
// shaped { sub, username, role }, and attaches it to req.user.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, ERROR_CODES.UNAUTHENTICATED));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, username: payload.username, role: payload.role };
    return next();
  } catch {
    return next(new AppError(401, ERROR_CODES.UNAUTHENTICATED));
  }
}

module.exports = { requireAuth };
