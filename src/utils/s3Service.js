const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('./logger');

let s3ClientInstance = null;

/**
 * Check whether AWS S3 credentials and bucket are configured in environment variables
 */
const isS3Configured = () => {
  return Boolean(
    process.env.AWS_S3_BUCKET &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
};

/**
 * Get or create S3 client singleton
 */
const getS3Client = () => {
  if (!s3ClientInstance) {
    const region = process.env.AWS_REGION || 'ap-southeast-2';
    s3ClientInstance = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3ClientInstance;
};

/**
 * Returns public HTTPS URL for an S3 object key
 */
const getS3PublicUrl = (key) => {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || 'ap-southeast-2';
  const cleanKey = key.replace(/^\//, '');
  return `https://${bucket}.s3.${region}.amazonaws.com/${cleanKey}`;
};

/**
 * Upload a processed memory buffer directly to S3
 * @param {Object} params
 * @param {Buffer} params.buffer - Image buffer
 * @param {string} params.key - Destination key (e.g., 'uploads/profiles/user_123.webp')
 * @param {string} params.contentType - MIME type (e.g., 'image/webp')
 * @returns {Promise<string>} Public URL of the uploaded object
 */
const uploadBufferToS3 = async ({ buffer, key, contentType = 'image/webp' }) => {
  const bucket = process.env.AWS_S3_BUCKET;
  const client = getS3Client();
  const cleanKey = key.replace(/^\//, '');

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: cleanKey,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);
  const publicUrl = getS3PublicUrl(cleanKey);
  logger.info(`Successfully uploaded file to S3: ${publicUrl}`);
  return publicUrl;
};

/**
 * Delete an object from S3 using its key or full public URL
 * @param {string} urlOrKey
 */
const deleteFromS3 = async (urlOrKey) => {
  if (!urlOrKey || typeof urlOrKey !== 'string') return;

  const bucket = process.env.AWS_S3_BUCKET;
  if (!isS3Configured()) return;

  try {
    let key = urlOrKey;
    // If full S3 URL was passed, extract the object key
    if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
      const url = new URL(urlOrKey);
      key = url.pathname.replace(/^\//, '');
    }

    const client = getS3Client();
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    logger.info(`Successfully deleted file from S3: ${key}`);
  } catch (error) {
    logger.warn(`Failed to delete object from S3 (${urlOrKey}): ${error.message}`);
  }
};

module.exports = {
  isS3Configured,
  getS3Client,
  getS3PublicUrl,
  uploadBufferToS3,
  deleteFromS3,
};
