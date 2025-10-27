const { Pool } = require('pg');
const logger = require('./logger');

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function shouldUseSSL() {
  if (process.env.DATABASE_SSL) {
    return parseBool(process.env.DATABASE_SSL);
  }

  if (process.env.PGSSLMODE) {
    const mode = process.env.PGSSLMODE.toLowerCase();
    return !['disable', 'allow', 'prefer'].includes(mode);
  }

  return process.env.NODE_ENV === 'production';
}

const sslEnabled = shouldUseSSL();
const sslConfig = sslEnabled
  ? {
      rejectUnauthorized: !parseBool(
        process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? 'false'
      ),
    }
  : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: sslConfig,
});

logger.info(`PostgreSQL SSL ${sslEnabled ? 'enabled' : 'disabled'}`);

// Connection event handlers
pool.on('connect', () => {
  logger.info('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
  logger.error('❌ PostgreSQL error:', err);
  process.exit(-1);
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('Database connection test failed:', err);
  } else {
    logger.info(`Database connection successful. Server time: ${res.rows[0].now}`);
  }
});

// Query helper with error handling
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error', { text, error: error.message });
    throw error;
  }
}

// Transaction helper
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  transaction
};
