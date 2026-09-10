require('dotenv').config();
const { query } = require('./db');
const bcrypt = require('bcrypt');

async function createTestUsers() {
  try {
    console.log('Creating test users...');

    // Hash password
    const password = await bcrypt.hash('123', 10);

    // Create regular user
    await query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3, role = $4',
      ['user@test.com', password, 'user', 'user']
    );

    // Create reviewer
    await query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3, role = $4',
      ['reviewer@test.com', password, 'reviewer', 'reviewer']
    );

    // Create manager
    await query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3, role = $4',
      ['manager@test.com', password, 'manager', 'manager']
    );

    // Create finance
    await query(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3, role = $4',
      ['finance@test.com', password, 'finance', 'finance']
    );

    console.log('Test users created successfully!');
    console.log('user@test.com (role: user)');
    console.log('reviewer@test.com (role: reviewer)');
    console.log('manager@test.com (role: manager)');
    console.log('finance@test.com (role: finance)');
    console.log('Password: 123');

  } catch (error) {
    console.error('Error creating users:', error);
  }
}

createTestUsers().then(() => process.exit(0));
