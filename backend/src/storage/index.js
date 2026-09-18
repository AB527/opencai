const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('./s3Client');
const config = require('../config/env');

// Assumes the bucket (or at least this key prefix) has a public-read policy --
// branding assets (logo, login image) are meant to be visible on the
// unauthenticated login page. Configured by whoever provisions MinIO/S3.
function getFileUrl(key) {
  return `${config.s3PublicUrl}/${config.s3Bucket}/${key}`;
}

async function uploadFile(key, buffer, contentType) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return getFileUrl(key);
}

module.exports = { uploadFile, getFileUrl };
