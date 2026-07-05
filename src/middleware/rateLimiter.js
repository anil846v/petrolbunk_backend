const rateLimit = require('express-rate-limit');

/**
 * Strict limiter for auth endpoints — 10 attempts per 15 min per IP.
 * Prevents brute-force login attacks.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { success: false, message: 'Too many attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

/**
 * General API limiter — 300 requests per minute per IP.
 * Prevents abuse of data-heavy report/list endpoints.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      300,
  message:  { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

module.exports = { authLimiter, apiLimiter };
