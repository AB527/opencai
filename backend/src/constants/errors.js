// Shared error codes + default messages. Thrown via middleware/errorHandler's
// AppError and mapped to HTTP responses in one place.
const ERROR_CODES = Object.freeze({
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  MFA_TOKEN_INVALID: 'MFA_TOKEN_INVALID',
  MFA_ALREADY_ENROLLED: 'MFA_ALREADY_ENROLLED',
  MFA_NOT_ENROLLED: 'MFA_NOT_ENROLLED',
  MFA_CODE_INVALID: 'MFA_CODE_INVALID',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // Thrown with HTTP 503 by the AI orchestrator when ChatSettings has no
  // provider / API key configured yet.
  AI_PROVIDER_NOT_CONFIGURED: 'AI_PROVIDER_NOT_CONFIGURED',
  // Thrown with HTTP 409 when a confirm/cancel loses the race for a command
  // that is no longer PENDING_CONFIRMATION (already confirmed, cancelled, ...).
  COMMAND_ALREADY_RESOLVED: 'COMMAND_ALREADY_RESOLVED',
});

const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.INVALID_CREDENTIALS]: 'Invalid username or password.',
  [ERROR_CODES.ACCOUNT_INACTIVE]: 'This account has been deactivated.',
  [ERROR_CODES.MFA_TOKEN_INVALID]: 'This session has expired. Please log in again.',
  [ERROR_CODES.MFA_ALREADY_ENROLLED]: 'MFA is already enrolled for this account.',
  [ERROR_CODES.MFA_NOT_ENROLLED]: 'MFA has not been enrolled for this account yet.',
  [ERROR_CODES.MFA_CODE_INVALID]: 'Invalid authentication code.',
  [ERROR_CODES.UNAUTHENTICATED]: 'Authentication is required.',
  [ERROR_CODES.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ERROR_CODES.VALIDATION_ERROR]: 'The request could not be validated.',
  [ERROR_CODES.NOT_FOUND]: 'The requested resource was not found.',
  [ERROR_CODES.INTERNAL_ERROR]: 'An unexpected error occurred.',
  [ERROR_CODES.AI_PROVIDER_NOT_CONFIGURED]:
    'No AI provider is configured yet. An administrator needs to set one up in Manage Chat Settings.',
  [ERROR_CODES.COMMAND_ALREADY_RESOLVED]: 'This command has already been confirmed or cancelled.',
});

module.exports = { ERROR_CODES, ERROR_MESSAGES };
