const { AppError } = require('./errorHandler');
const { ERROR_CODES } = require('../constants/errors');

// Usage: router.post('/login', validate(loginSchema), handler)
// Replaces req.body with the parsed (and coerced) result on success.
function validate(schema) {
  return function (req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        new AppError(400, ERROR_CODES.VALIDATION_ERROR, result.error.issues.map((i) => i.message).join('; ')),
      );
    }
    req.body = result.data;
    return next();
  };
}

module.exports = { validate };
