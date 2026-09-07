const express = require('express');
const { validate } = require('../../middleware/validate');
const { requireAuth } = require('../../middleware/auth');
const controller = require('./auth.controller');
const {
  loginSchema,
  mfaTokenSchema,
  confirmEnrollmentSchema,
  verifyMfaSchema,
  changePasswordSchema,
} = require('./auth.schemas');

const router = express.Router();

router.post('/login', validate(loginSchema), controller.login);
router.post('/mfa/enroll/start', validate(mfaTokenSchema), controller.startEnrollment);
router.post('/mfa/enroll/confirm', validate(confirmEnrollmentSchema), controller.confirmEnrollment);
router.post('/mfa/verify', validate(verifyMfaSchema), controller.verifyMfa);
router.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  controller.changePassword,
);

module.exports = router;
