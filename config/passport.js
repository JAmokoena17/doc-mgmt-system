const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { query } = require('../db');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

/*
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists
    const result = await query('SELECT * FROM users WHERE email = $1', [profile.emails[0].value]);
    
    if (result.rows.length > 0) {
      // User exists, return user
      return done(null, result.rows[0]);
    } else {
      // Create new user
      const newUser = await query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING *',
        [profile.emails[0].value, 'google_oauth', 'reviewer']
      );
      
      return done(null, newUser.rows[0]);
    }
  } catch (error) {
    return done(error, null);
  }
}));
*/

module.exports = passport;
