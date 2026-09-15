// Verdicts returned by the deterministic command policy classifier.
// ALLOW_READONLY / ALLOW_LOOKUP may run immediately; REQUIRE_CONFIRMATION
// must be gated behind an explicit human confirmation; REJECTED never runs.
const POLICY_VERDICTS = Object.freeze({
  ALLOW_READONLY: 'ALLOW_READONLY',
  ALLOW_LOOKUP: 'ALLOW_LOOKUP',
  REQUIRE_CONFIRMATION: 'REQUIRE_CONFIRMATION',
  REJECTED: 'REJECTED',
});

module.exports = { POLICY_VERDICTS };
