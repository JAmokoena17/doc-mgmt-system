const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('passport');
const { query } = require('../db');
const { validateRegistration, validateLogin, handleValidationErrors } = require('../middleware/validation');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');
const router = express.Router();

// GET /login
router.get('/login', (req, res) => {
  res.render('login');
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    email = email.trim().toLowerCase();

    console.log('Login attempt:', { email, password: password ? '***' : 'empty' });

    const result = await query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
    console.log('User found:', result.rows.length > 0 ? 'YES' : 'NO');

    if (result.rows.length === 0) {
      return res.render('login', { error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    console.log('User role:', user.role);

    const storedHash = user.password_hash || user.password;
    if (!storedHash) {
      return res.render('login', { error: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, storedHash);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      return res.render('login', { error: 'Invalid email or password' });
    }
    
    // Set session
    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userEmail = user.email;
    console.log('Session set:', { userId: user.id, userRole: user.role, userEmail: user.email });
    
    res.redirect('/documents');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'An error occurred during login' });
  }
});

// GET /register
router.get('/register', (req, res) => {
  res.render('register');
});

// POST /register
router.post('/register', registerLimiter, validateRegistration, handleValidationErrors, async (req, res) => {
  try {
    let { email, password } = req.body;
    email = email.trim().toLowerCase();

    const existingUser = await query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.render('register', { error: 'This email is already in use. Please sign in or use a different email.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
      [email, hashedPassword, 'reviewer']
    );
    
    res.redirect('/login');
  } catch (error) {
    console.error('Registration error:', error);
    res.render('register', { error: 'An error occurred during registration' });
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login');
  });
});

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication
    req.session.userId = req.user.id;
    req.session.userRole = req.user.role;
    req.session.userEmail = req.user.email;
    res.redirect('/documents');
  }
);

module.exports = router;
