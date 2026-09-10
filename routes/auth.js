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
      return res.render('login', { error: 'No account found for this email. Please register first.' });
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
      return res.render('login', { error: 'Incorrect password. Please try again.' });
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

// POST /check-email
router.post('/check-email', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.json({ exists: false });
    }

    const existingUser = await query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.json({
        exists: true,
        message: 'This email is already registered. Please sign in instead, or use a different email address.'
      });
    }

    return res.json({ exists: false });
  } catch (error) {
    console.error('Email check error:', error);
    return res.status(500).json({ exists: false, message: 'We could not verify this email right now. Please try again.' });
  }
});

// POST /register
router.post('/register', registerLimiter, validateRegistration, handleValidationErrors, async (req, res) => {
  try {
    let { email, password } = req.body;
    email = email.trim().toLowerCase();
    const name = email.split('@')[0] || 'User';

    const existingUser = await query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.render('register', { error: 'This email is already registered. Please sign in instead, or use a different email address.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)',
      [email, hashedPassword, name, 'user']
    );
    
    res.redirect('/login');
  } catch (error) {
    console.error('Registration error:', error);

    if (error.code === '23505' || error.constraint === 'users_email_key') {
      return res.render('register', { error: 'This email is already registered. Please sign in instead, or use a different email address.' });
    }

    res.render('register', { error: 'We could not complete registration right now. Please try again.' });
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
