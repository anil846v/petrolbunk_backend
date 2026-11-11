const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

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

// 2. Sharp Image Processing Middleware
const processProfileImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const uploadDir = path.join(__dirname, '../../uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueId = crypto.randomBytes(4).toString('hex');
    const filename = `user_${Date.now()}_${uniqueId}.webp`;
    const targetPath = path.join(uploadDir, filename);

    await sharp(req.file.buffer)
      .rotate() // Auto-orient mobile photos
      .resize(400, 400, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .withMetadata(false) // Strip EXIF/GPS metadata
      .toFile(targetPath);

    // Save relative URL path to req.body so controllers receive it as a regular field
    req.body.profile_image = `/uploads/profiles/${filename}`;
    next();
  } catch (error) {
    logger.error('Failed to process profile image with sharp:', error);
    next(new AppError('Error processing profile image: ' + error.message, 500));
  }
};

// 3. Helper to clean up previous image when replaced
const deleteOldProfileImage = (relativePath) => {
  if (!relativePath || typeof relativePath !== 'string') return;
  try {
    const cleanPath = relativePath.replace(/^\//, '');
    const absolutePath = path.join(__dirname, '../../', cleanPath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
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
