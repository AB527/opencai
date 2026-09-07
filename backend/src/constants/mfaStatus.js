// Derived status, not a stored column: a User is ENROLLED once
// totpSecretEncrypted is set, NOT_ENROLLED until then.
const MFA_STATUS = Object.freeze({
  NOT_ENROLLED: 'NOT_ENROLLED',
  ENROLLED: 'ENROLLED',
});

module.exports = { MFA_STATUS };
