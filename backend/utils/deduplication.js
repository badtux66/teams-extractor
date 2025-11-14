/**
 * Message Deduplication Utilities
 *
 * Provides functions for:
 * - Generating message fingerprints/hashes
 * - Checking for duplicate messages
 * - Batch deduplication against database
 * - Message hash caching
 */

const crypto = require('crypto');

/**
 * Generate a deterministic SHA-256 hash for a message
 * This hash is used to identify duplicate messages across extractions
 *
 * @param {Object} message - Message object
 * @param {string} message.channelId - Channel/conversation ID
 * @param {string} message.senderId - Sender ID
 * @param {string} message.timestamp - ISO timestamp
 * @param {string} message.content - Message content
 * @returns {string} 64-character hex SHA-256 hash
 */
function generateMessageHash(message) {
  // Create deterministic string from message components
  // Using | as delimiter to avoid collisions
  const hashInput = [
    message.channelId || message.channel_id || '',
    message.senderId || message.sender_id || message.sender?.id || '',
    message.timestamp || '',
    message.content || ''
  ].join('|');

  // Generate SHA-256 hash
  return crypto
    .createHash('sha256')
    .update(hashInput, 'utf8')
    .digest('hex');
}

/**
 * Generate hashes for an array of messages
 *
 * @param {Array} messages - Array of message objects
 * @returns {Array} Array of {hash, message} objects
 */
function generateMessageHashes(messages) {
  return messages.map(message => ({
    hash: generateMessageHash(message),
    message: message
  }));
}

/**
 * Check which messages already exist in the database
 * Uses message hashes for comparison
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Array} messages - Array of messages to check
 * @returns {Promise<Object>} {newMessages, duplicates, existingHashes}
 */
async function deduplicateMessages(pool, messages) {
  if (!messages || messages.length === 0) {
    return {
      newMessages: [],
      duplicates: [],
      existingHashes: new Set()
    };
  }

  // Generate hashes for all incoming messages
  const messageHashes = generateMessageHashes(messages);
  const hashes = messageHashes.map(m => m.hash);

  try {
    // Query database for existing hashes
    const result = await pool.query(
      'SELECT message_hash FROM teams.messages WHERE message_hash = ANY($1)',
      [hashes]
    );

    // Create set of existing hashes for fast lookup
    const existingHashes = new Set(
      result.rows.map(row => row.message_hash)
    );

    // Separate new messages from duplicates
    const newMessages = [];
    const duplicates = [];

    messageHashes.forEach(({ hash, message }) => {
      // Add hash to message object
      const messageWithHash = {
        ...message,
        message_hash: hash
      };

      if (existingHashes.has(hash)) {
        duplicates.push(messageWithHash);
      } else {
        newMessages.push(messageWithHash);
      }
    });

    return {
      newMessages,
      duplicates,
      existingHashes
    };
  } catch (error) {
    console.error('Error during deduplication:', error);
    throw new Error(`Deduplication failed: ${error.message}`);
  }
}

/**
 * Check if a single message is a duplicate
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Object} message - Message to check
 * @returns {Promise<boolean>} True if duplicate exists
 */
async function isDuplicate(pool, message) {
  const hash = generateMessageHash(message);

  try {
    const result = await pool.query(
      'SELECT 1 FROM teams.messages WHERE message_hash = $1 LIMIT 1',
      [hash]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking for duplicate:', error);
    return false; // Assume not duplicate on error to avoid losing messages
  }
}

/**
 * Update extraction count for duplicate messages
 * This tracks how many times we've seen the same message
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Array<string>} messageHashes - Array of message hashes
 * @returns {Promise<number>} Number of records updated
 */
async function incrementExtractionCount(pool, messageHashes) {
  if (!messageHashes || messageHashes.length === 0) {
    return 0;
  }

  try {
    const result = await pool.query(
      `UPDATE teams.messages
       SET extraction_count = extraction_count + 1,
           updated_at = NOW()
       WHERE message_hash = ANY($1)`,
      [messageHashes]
    );

    return result.rowCount;
  } catch (error) {
    console.error('Error incrementing extraction count:', error);
    throw error;
  }
}

/**
 * Get deduplication statistics
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {Promise<Object>} Statistics object
 */
async function getDeduplicationStats(pool) {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_messages,
        COUNT(DISTINCT message_hash) as unique_messages,
        COUNT(*) - COUNT(DISTINCT message_hash) as duplicate_count,
        AVG(extraction_count) as avg_extraction_count,
        MAX(extraction_count) as max_extraction_count,
        COUNT(*) FILTER (WHERE extraction_count > 1) as re_extracted_messages
      FROM teams.messages
      WHERE message_hash IS NOT NULL
    `);

    return result.rows[0] || {};
  } catch (error) {
    console.error('Error getting deduplication stats:', error);
    throw error;
  }
}

/**
 * Find messages that have been extracted multiple times
 * Useful for debugging and monitoring
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @param {number} minCount - Minimum extraction count (default: 2)
 * @param {number} limit - Maximum results to return (default: 100)
 * @returns {Promise<Array>} Array of frequently extracted messages
 */
async function getFrequentlyExtractedMessages(pool, minCount = 2, limit = 100) {
  try {
    const result = await pool.query(
      `SELECT
        message_id,
        channel_name,
        sender_name,
        LEFT(content, 100) as content_preview,
        extraction_count,
        first_extracted_at,
        updated_at as last_extracted_at
       FROM teams.messages
       WHERE extraction_count >= $1
       ORDER BY extraction_count DESC, updated_at DESC
       LIMIT $2`,
      [minCount, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting frequently extracted messages:', error);
    throw error;
  }
}

module.exports = {
  generateMessageHash,
  generateMessageHashes,
  deduplicateMessages,
  isDuplicate,
  incrementExtractionCount,
  getDeduplicationStats,
  getFrequentlyExtractedMessages
};
