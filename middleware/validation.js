const { body, validationResult } = require('express-validator');

// Password strength validation
const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];
  if (password.length < minLength) errors.push(`Password must be at least ${minLength} characters long`);
  if (!hasUpperCase) errors.push('Password must contain at least one uppercase letter');
  if (!hasLowerCase) errors.push('Password must contain at least one lowercase letter');
  if (!hasNumbers) errors.push('Password must contain at least one number');
  if (!hasSpecialChar) errors.push('Password must contain at least one special character');

  return errors;
};

// Registration validation
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('password')
    .custom((value) => {
      const errors = validatePassword(value);
      if (errors.length > 0) {
        throw new Error(errors.join(', '));
      }
      return true;
    }),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

// Login validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return res.render(req.path.includes('register') ? 'register' : 'login', {
      error: errorMessages.join(', ')
    });
  }
  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  handleValidationErrors,
  validatePassword
};
