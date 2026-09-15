const { CSP } = require('../constants/csp');

/**
 * Map a decrypted WorkspaceCredential JSON payload onto the environment
 * variables the CSP's CLI expects. The returned object is injected per-exec
 * (dockerode's `Env` on each `container.exec()` call) -- never baked into the
 * container at creation time, so credentials never persist in container config.
 *
 * The AWS payload shape is fixed by `workspaceCredentialSchema` in
 * backend/src/modules/admin/organisations.schemas.js:
 * `{ accessKeyId: string, secretAccessKey: string }`.
 *
 * @param {string} csp One of the values in `CSP`.
 * @param {object} credentialJson Decrypted credential payload.
 * @returns {Record<string, string>}
 */
function credentialToEnv(csp, credentialJson) {
  if (csp === CSP.AWS) {
    if (!credentialJson || typeof credentialJson !== 'object') {
      throw new Error('Missing credential payload for CSP: AWS');
    }
    const { accessKeyId, secretAccessKey } = credentialJson;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('Incomplete AWS credential payload');
    }
    return {
      AWS_ACCESS_KEY_ID: accessKeyId,
      AWS_SECRET_ACCESS_KEY: secretAccessKey,
    };
  }
  throw new Error(`Unsupported CSP: ${csp}`);
}

module.exports = { credentialToEnv };
