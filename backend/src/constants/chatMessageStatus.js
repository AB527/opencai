// Chat message lifecycle and outcome states (stored in ChatMessage.status)
const CHAT_MESSAGE_STATUS = Object.freeze({
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  EXECUTING: 'EXECUTING',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
  CAPPED: 'CAPPED',
  DRY_RUN: 'DRY_RUN',
});

module.exports = { CHAT_MESSAGE_STATUS };
