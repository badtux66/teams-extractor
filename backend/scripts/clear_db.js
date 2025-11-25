const { pool } = require('../config/database');
const logger = require('../config/logger');

async function clearDatabase() {
    const client = await pool.connect();
    try {
        logger.info('Starting database clear...');

        await client.query('BEGIN');

        // Truncate tables in dependency order
        // messages depends on conversations
        // extraction_checkpoints depends on conversations

        logger.info('Truncating tables...');
        await client.query(`
      TRUNCATE TABLE teams.messages CASCADE;
      TRUNCATE TABLE teams.extraction_checkpoints CASCADE;
      TRUNCATE TABLE teams.conversations CASCADE;
      TRUNCATE TABLE teams.extraction_sessions CASCADE;
      TRUNCATE TABLE teams.statistics CASCADE;
    `);

        // Reset sequences if needed (optional, but good for clean slate)
        // await client.query('ALTER SEQUENCE teams.messages_id_seq RESTART WITH 1');

        await client.query('COMMIT');
        logger.info('✅ Database cleared successfully');

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('❌ Error clearing database:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

clearDatabase();
