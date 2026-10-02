const prisma = require('../../config/db');

async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Public: the login page needs this before anyone has signed in. Falls back
// to sensible defaults until an Administrator sets real branding (Phase 4:
// Manage Branding writes this row).
async function getInstanceBranding() {
  const branding = await prisma.instanceBranding.findFirst({ orderBy: { updatedAt: 'desc' } });
  return {
    displayName: branding?.displayName || 'OpenCAI',
    logoObjectKey: branding?.logoObjectKey || null,
    loginImageObjectKey: branding?.loginImageObjectKey || null,
    faviconObjectKey: branding?.faviconObjectKey || null,
  };
}

module.exports = { checkDatabaseConnection, getInstanceBranding };
