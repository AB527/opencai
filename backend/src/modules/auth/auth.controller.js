const authService = require('./auth.service');

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function startEnrollment(req, res, next) {
  try {
    const { mfaToken } = req.body;
    const result = await authService.startEnrollment(mfaToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function confirmEnrollment(req, res, next) {
  try {
    const { enrollmentToken, code } = req.body;
    const result = await authService.confirmEnrollment(enrollmentToken, code);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function verifyMfa(req, res, next) {
  try {
    const { mfaToken, code } = req.body;
    const result = await authService.verifyMfa(mfaToken, code);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.id, currentPassword, newPassword);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, startEnrollment, confirmEnrollment, verifyMfa, changePassword };
