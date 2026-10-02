const prisma = require('../../config/db');

// Clearing the TOTP secret and backup codes is all a reset needs: at the next
// login auth.service sees no secret (mfaEnrolled: false) and sends the user
// through enrollment again. Sessions already signed in are unaffected.
async function clearMfa(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecretEncrypted: null, backupCodesHashed: [] },
  });
}

/** Never exposes the secret itself -- only whether one is set. */
const mfaEnrolled = (user) => Boolean(user.totpSecretEncrypted);

module.exports = { clearMfa, mfaEnrolled };
