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
  // Thrown with HTTP 409 when a session already has an unresolved
  // PENDING_CONFIRMATION message -- a new message can't be sent until it's
  // resolved (confirmed or cancelled).
  PENDING_COMMAND_EXISTS: 'PENDING_COMMAND_EXISTS',
  // Thrown with HTTP 422 when the session's Workspace has no
  // WorkspaceCredential configured yet -- nothing to inject into the sandbox.
  WORKSPACE_CREDENTIAL_MISSING: 'WORKSPACE_CREDENTIAL_MISSING',
  // Mapped by the orchestrator from the AI provider's own HTTP errors, so the
  // Operator sees what went wrong instead of a generic 500.
  AI_PROVIDER_REQUEST_TOO_LARGE: 'AI_PROVIDER_REQUEST_TOO_LARGE',
  AI_PROVIDER_RATE_LIMITED: 'AI_PROVIDER_RATE_LIMITED',
  AI_PROVIDER_AUTH_FAILED: 'AI_PROVIDER_AUTH_FAILED',
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
  [ERROR_CODES.PENDING_COMMAND_EXISTS]:
    'This session already has a command awaiting confirmation. Resolve it before sending another message.',
  [ERROR_CODES.WORKSPACE_CREDENTIAL_MISSING]:
    'This Workspace has no cloud credentials configured yet. An administrator needs to add them before chat can run commands.',
  [ERROR_CODES.AI_PROVIDER_REQUEST_TOO_LARGE]:
    "This conversation is too large for the AI provider's limits. Start a new session, or raise the limits in Manage Chat Settings.",
  [ERROR_CODES.AI_PROVIDER_RATE_LIMITED]:
    'The AI provider is rate-limiting requests right now. Wait a moment and try again.',
  [ERROR_CODES.AI_PROVIDER_AUTH_FAILED]:
    'The AI provider rejected the API key. An administrator needs to check it in Manage Chat Settings.',
});

module.exports = { ERROR_CODES, ERROR_MESSAGES };
