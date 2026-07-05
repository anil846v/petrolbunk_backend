const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authMiddleware = async (
  req,
  res,
  next
) => {
  try {
    // Support both cookie and Authorization header for transition
    const token =
      req.cookies?.token ||
      req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findByPk(
      decoded.id
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'User is inactive',
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }
};

const adminMiddleware = (
  req,
  res,
  next
) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }

  next();
};
/* ─────────────────────────────────────────
   OPTIONAL AUTH MIDDLEWARE
   Attaches req.user if token present but
   does NOT block the request if no token.
   Useful for public routes that behave
   differently when an admin is logged in.
───────────────────────────────────────── */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    // Support both cookie and Authorization header
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findByPk(decoded.id);
    if (user && user.is_active) req.user = user;
  } catch (_) {
    // invalid token — just continue as guest
  }
  next();
};
module.exports = {
  authMiddleware,
  adminMiddleware,
  optionalAuthMiddleware,
};