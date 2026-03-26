require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const { query } = require('./db');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Flash middleware (after session)
app.use(flash());

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Make flash messages and user data available to all templates
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success');
  res.locals.error_msg = req.flash('error');
  res.locals.userRole = req.session.userRole;
  res.locals.userId = req.session.userId;
  res.locals.userEmail = req.session.userEmail;
  next();
});

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

// Auth routes
app.use('/', authRoutes);

// Document routes
const documentsRoutes = require('./routes/documents');
app.use('/documents', documentsRoutes);
app.use('/', documentsRoutes); // Allows /reports and /reports/export/* to resolve

// Start server
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Test database connection
  try {
    const result = await query('SELECT NOW()');
    console.log('Database connected successfully:', result.rows[0]);
  } catch (error) {
    console.error('Database connection failed:', error);
  }
});
