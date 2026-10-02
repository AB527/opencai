const express = require('express');
const multer = require('multer');
const controller = require('./branding.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed.'));
    }
    cb(null, true);
  },
});

const router = express.Router();

// GET (public, unauthenticated) lives in modules/open -- the login page needs
// to show the current branding before anyone signs in.
router.put(
  '/',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'loginImage', maxCount: 1 },
    { name: 'favicon', maxCount: 1 },
  ]),
  controller.update,
);

module.exports = router;
