const rateLimit = require('express-rate-limit');

// General rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many attempts from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('login', {
      error: 'Too many attempts, please try again after 15 minutes'
    });
  }
});

// Stricter rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 login attempts per windowMs
  message: {
    error: 'Too many login attempts, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    res.status(429).render('login', {
      error: 'Too many login attempts, please try again after 15 minutes'
    });
  }
});

// Rate limiting for registration
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registrations per hour
  message: {
    error: 'Too many registration attempts, please try again after 1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('register', {
      error: 'Too many registration attempts, please try again after 1 hour'
    });
  }
});

module.exports = {
  authLimiter,
  loginLimiter,
  registerLimiter
};
