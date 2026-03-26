require('dotenv').config();
const { query } = require('./db');
const bcrypt = require('bcrypt');

async function createTestUsers() {
  try {
    console.log('Creating test users...');

    // Hash password
    const password = await bcrypt.hash('123', 10);

    // Create reviewer
    await query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = $3',
      ['reviewer@test.com', password, 'reviewer']
    );

    // Create manager
    await query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = $3',
      ['manager@test.com', password, 'manager']
    );

    // Create finance
    await query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = $3',
      ['finance@test.com', password, 'finance']
    );

    console.log('Test users created successfully!');
    console.log('reviewer@test.com (role: reviewer)');
    console.log('manager@test.com (role: manager)');
    console.log('finance@test.com (role: finance)');
    console.log('Password: 123');

  } catch (error) {
    console.error('Error creating users:', error);
  }
}

createTestUsers().then(() => process.exit(0));
