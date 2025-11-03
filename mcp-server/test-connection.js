#!/usr/bin/env node

/**
 * Test database connection for MCP server
 * Used during installation to verify configuration
 */

import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

async function testConnection() {
  const databaseUrl = process.env.MCP_DATABASE_URL;

  if (!databaseUrl) {
    console.error(`${colors.red}✗${colors.reset} MCP_DATABASE_URL environment variable not set`);
    process.exit(1);
  }

  console.log(`${colors.blue}ℹ${colors.reset} Testing connection to database...`);

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    // Test basic connectivity
    await pool.query('SELECT 1');
    console.log(`${colors.green}✓${colors.reset} Database connection successful`);

    // Check for messages table
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'teams'
        AND table_name = 'messages'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log(`${colors.green}✓${colors.reset} Messages table exists`);

      // Get message count
      const countResult = await pool.query('SELECT COUNT(*) FROM teams.messages');
      const count = parseInt(countResult.rows[0].count);
      console.log(`${colors.green}✓${colors.reset} Found ${count.toLocaleString()} messages in database`);

      if (count === 0) {
        console.log(`${colors.yellow}⚠${colors.reset} Database is empty. Make sure to extract messages using the Chrome extension`);
      }
    } else {
      console.log(`${colors.yellow}⚠${colors.reset} Messages table not found. Database may need initialization`);
    }

    // Check database permissions
    try {
      await pool.query('SELECT * FROM teams.messages LIMIT 1');
      console.log(`${colors.green}✓${colors.reset} Read permissions verified`);
    } catch (error) {
      console.log(`${colors.yellow}⚠${colors.reset} Cannot read messages: ${error.message}`);
    }

    await pool.end();
    console.log(`\n${colors.green}✨ Database connection test passed!${colors.reset}`);
    process.exit(0);

  } catch (error) {
    await pool.end();
    console.error(`${colors.red}✗${colors.reset} Connection test failed: ${error.message}`);

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log('\nPossible solutions:');
      console.log('1. Ensure PostgreSQL is running');
      console.log('2. Check if Docker containers are up: docker-compose up -d');
      console.log('3. Verify the database host and port are correct');
    } else if (error.code === '28P01' || error.code === '28000') {
      console.log('\nAuthentication failed. Check your database credentials.');
    } else if (error.code === '3D000') {
      console.log('\nDatabase does not exist. Run the backend server to initialize it.');
    }

    process.exit(1);
  }
}

testConnection().catch(console.error);