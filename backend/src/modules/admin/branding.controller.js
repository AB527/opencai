const service = require('./branding.service');

async function update(req, res, next) {
  try {
    const { displayName } = req.body;
    const logoFile = req.files?.logo?.[0];
    const loginImageFile = req.files?.loginImage?.[0];
    const faviconFile = req.files?.favicon?.[0];
    res.json(
      await service.updateBranding({ displayName, logoFile, loginImageFile, faviconFile }),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = { update };
