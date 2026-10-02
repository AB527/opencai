const prisma = require('../../config/db');
const { uploadFile } = require('../../storage');

function extensionFor(file) {
  const parts = file.originalname.split('.');
  return parts.length > 1 ? `.${parts.pop()}` : '';
}

async function updateBranding({ displayName, logoFile, loginImageFile, faviconFile }) {
  const existing = await prisma.instanceBranding.findFirst();

  const data = {};
  if (displayName !== undefined) data.displayName = displayName;
  if (logoFile) {
    data.logoObjectKey = await uploadFile(
      `branding/logo-${Date.now()}${extensionFor(logoFile)}`,
      logoFile.buffer,
      logoFile.mimetype,
    );
  }
  if (loginImageFile) {
    data.loginImageObjectKey = await uploadFile(
      `branding/login-image-${Date.now()}${extensionFor(loginImageFile)}`,
      loginImageFile.buffer,
      loginImageFile.mimetype,
    );
  }
  if (faviconFile) {
    data.faviconObjectKey = await uploadFile(
      `branding/favicon-${Date.now()}${extensionFor(faviconFile)}`,
      faviconFile.buffer,
      faviconFile.mimetype,
    );
  }

  if (existing) {
    return prisma.instanceBranding.update({ where: { id: existing.id }, data });
  }
  return prisma.instanceBranding.create({ data: { displayName: displayName || 'OpenCAI', ...data } });
}

module.exports = { updateBranding };
