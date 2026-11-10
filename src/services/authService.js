const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User } = require('../models');
const { AuthError, NotFoundError, ValidationError } = require('../utils/AppError');
const { sendPasswordResetEmail } = require('../utils/emailService');

// Single source of truth — both token and cookie expire at the same time
const JWT_EXPIRES_DAYS = parseInt(process.env.JWT_EXPIRES_DAYS || '7', 10);

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: `${JWT_EXPIRES_DAYS}d`,
  });

const COOKIE_OPTIONS = {
  httpOnly:  true,
  secure:    process.env.NODE_ENV === 'production',
  sameSite:  process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  maxAge:    JWT_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  path:      '/',
};

/**
 * Robust user lookup by either email, username, or configured ADMIN_EMAIL
 */
const findUserByIdentifier = async (identifier) => {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase();
  const adminEnvEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  return User.findOne({
    where: {
      [Op.or]: [
        { email: clean },
        { username: clean },
        ...(adminEnvEmail && clean === adminEnvEmail ? [{ role: 'ADMIN' }] : []),
      ],
    },
  });
};

const login = async (email, password) => {
  const normalizedInput = (email || '').trim().toLowerCase();
  console.log('[LOGIN ATTEMPT] Identifier received:', normalizedInput);

  const user = await findUserByIdentifier(normalizedInput);

  if (!user || !(await user.comparePassword(password))) {
    throw new AuthError('Invalid email or password');
  }

  if (!user.is_active) {
    throw new AuthError('Your account has been deactivated. Contact the administrator.');
  }

  const token = generateToken(user.id);

  const profile = {
    id:       user.id,
    username: user.username,
    email:    user.email,
    role:     user.role,
    phone_no: user.phone_no,
  };

  return { token, profile };
};

const getCurrentUser = async (id) => {
  const user = await User.findByPk(id, {
    attributes: { exclude: ['password'] },
  });
  if (!user) throw new NotFoundError('User not found');
  return user;
};

const forgotPassword = async (email) => {
  if (!email) throw new ValidationError('Email address or username is required');

  const normalizedInput = email.trim().toLowerCase();
  const user = await findUserByIdentifier(normalizedInput);

  if (!user) {
    throw new NotFoundError('No user account found with this email or username');
  }

  if (!user.is_active) {
    throw new AuthError('This user account is inactive. Please contact the administrator.');
  }

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  await user.update({
    reset_token: otp,
    reset_token_expires: expires,
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const targetEmail = user.email || process.env.ADMIN_EMAIL || normalizedInput;
  const resetLink = `${frontendUrl}/login?reset_email=${encodeURIComponent(targetEmail)}&otp=${otp}`;

  try {
    await sendPasswordResetEmail({
      to: targetEmail,
      username: user.username,
      otp,
      resetLink,
    });
  } catch (err) {
    console.error('SMTP sending error:', err);
    throw new Error('Failed to send reset email. Please verify SMTP configuration.');
  }

  return { email: targetEmail };
};

const verifyOtp = async ({ email, otp }) => {
  if (!email || !otp) {
    throw new ValidationError('Email/Username and OTP verification code are required');
  }

  const normalizedInput = email.trim().toLowerCase();
  const user = await findUserByIdentifier(normalizedInput);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (!user.reset_token || user.reset_token !== otp.trim()) {
    throw new ValidationError('Invalid verification code. Please check and try again.');
  }

  if (!user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
    throw new ValidationError('Verification code has expired. Please request a new one.');
  }

  return { verified: true, email: user.email };
};

const resetPassword = async ({ email, otp, new_password }) => {
  if (!email || !otp || !new_password) {
    throw new ValidationError('Email/Username, OTP verification code, and new password are required');
  }

  if (new_password.length < 6) {
    throw new ValidationError('New password must be at least 6 characters long');
  }

  const normalizedInput = email.trim().toLowerCase();
  const user = await findUserByIdentifier(normalizedInput);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (!user.reset_token || user.reset_token !== otp.trim()) {
    throw new ValidationError('Invalid verification code');
  }

  if (!user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
    throw new ValidationError('Verification code has expired. Please request a new one.');
  }

  // Update password and clear reset fields (password hook in User.js hashes the password)
  await user.update({
    password: new_password,
    reset_token: null,
    reset_token_expires: null,
  });

  return { message: 'Password has been reset successfully' };
};

module.exports = {
  login,
  getCurrentUser,
  forgotPassword,
  verifyOtp,
  resetPassword,
  COOKIE_OPTIONS,
};
