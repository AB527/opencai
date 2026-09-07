const { S3Client } = require('@aws-sdk/client-s3');
const config = require('../config/env');

const s3Client = new S3Client({
  endpoint: config.s3Endpoint,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.s3AccessKey,
    secretAccessKey: config.s3SecretKey,
  },
});

module.exports = s3Client;
