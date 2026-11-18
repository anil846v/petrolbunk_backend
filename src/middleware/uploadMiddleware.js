const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { isS3Configured, uploadBufferToS3, deleteFromS3 } = require('../utils/s3Service');

// 1. Multer memory storage configuration
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files (JPEG, PNG, WebP) are allowed', 400), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB hard ceiling
  },
  fileFilter,
});

// Middleware to upload single profile image
const uploadProfileMemory = upload.single('profile_image');

// 2. Sharp Image Processing Middleware (Hybrid: S3 Cloud or Local Disk)
const processProfileImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const uniqueId = crypto.randomBytes(4).toString('hex');
    const filename = `user_${Date.now()}_${uniqueId}.webp`;

    // Process image into optimized WebP format with sharp in memory
    const processedBuffer = await sharp(req.file.buffer)
      .rotate() // Auto-orient mobile photos
      .resize(400, 400, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .withMetadata(false) // Strip EXIF/GPS metadata
      .toBuffer();

    if (isS3Configured()) {
      // Cloud Storage: Upload directly to Amazon S3
      const s3Key = `uploads/profiles/${filename}`;
      const publicUrl = await uploadBufferToS3({
        buffer: processedBuffer,
        key: s3Key,
        contentType: 'image/webp',
      });
      req.body.profile_image = publicUrl;
      logger.info(`Profile image uploaded to S3: ${publicUrl}`);
    } else {
      // Local Storage Fallback: Save to server filesystem
      const uploadDir = path.join(__dirname, '../../uploads/profiles');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const targetPath = path.join(uploadDir, filename);
      await fs.promises.writeFile(targetPath, processedBuffer);
      req.body.profile_image = `/uploads/profiles/${filename}`;
      logger.info(`Profile image saved locally: ${req.body.profile_image}`);
    }

    next();
  } catch (error) {
    logger.error('Failed to process profile image with sharp:', error);
    next(new AppError('Error processing profile image: ' + error.message, 500));
  }
};

// 3. Helper to clean up previous image when replaced
const deleteOldProfileImage = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return;
  try {
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      // Delete from Amazon S3
      deleteFromS3(filePath).catch((err) => {
        logger.warn('Failed to delete S3 profile image:', err.message);
      });
    } else {
      // Delete from local disk
      const cleanPath = filePath.replace(/^\//, '');
      const absolutePath = path.join(__dirname, '../../', cleanPath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
  } catch (err) {
    logger.warn('Failed to delete old profile image:', err.message);
  }
};

module.exports = {
  uploadProfileMemory,
  processProfileImage,
  deleteOldProfileImage,
};
