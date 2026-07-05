const jwt  = require('jsonwebtoken');
const { User } = require('../models');
const { AuthError, NotFoundError } = require('../utils/AppError');

// Single source of truth — both token and cookie expire at the same time
const JWT_EXPIRES_DAYS = parseInt(process.env.JWT_EXPIRES_DAYS || '7', 10);

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: `${JWT_EXPIRES_DAYS}d`,
  });

const COOKIE_OPTIONS = {
  httpOnly:  true,
  secure:    process.env.NODE_ENV === 'production',
  sameSite:  'strict',
  maxAge:    JWT_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  path:      '/',
};

const login = async (email, password) => {
  const user = await User.findOne({ where: { email } });

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

module.exports = { login, getCurrentUser, COOKIE_OPTIONS };
