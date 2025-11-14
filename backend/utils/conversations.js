/**
 * Conversation Management Utilities
 *
 * Provides functions for:
 * - Creating and updating conversations
 * - Managing extraction checkpoints
 * - Building threaded message structures
 * - Organizing messages by conversation
 */

/**
 * Upsert a conversation in the database
 * Creates if doesn't exist, updates if it does
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Object} conversation - Conversation object
 * @param {string} conversation.id - Unique conversation ID
 * @param {string} conversation.name - Conversation display name
 * @param {string} conversation.type - Type: 'channel', 'chat', 'meeting', or 'direct'
 * @param {string} [conversation.teamId] - Parent team ID (optional)
 * @param {string} [conversation.teamName] - Parent team name (optional)
 * @param {Object} [conversation.metadata] - Additional metadata (optional)
 * @returns {Promise<Object>} Created/updated conversation
 */
async function upsertConversation(pool, conversation) {
  const {
    id,
    name,
    type,
    teamId,
    teamName,
    description,
    participants,
    metadata = {}
  } = conversation;

  try {
    const result = await pool.query(
      `INSERT INTO teams.conversations (
        id, name, type, team_id, team_name, description, participants, metadata, last_activity
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        team_id = EXCLUDED.team_id,
        team_name = EXCLUDED.team_name,
        description = EXCLUDED.description,
        participants = EXCLUDED.participants,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *`,
      [
        id,
        name,
        type,
        teamId || null,
        teamName || null,
        description || null,
        JSON.stringify(participants || []),
        JSON.stringify(metadata)
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error upserting conversation:', error);
    throw new Error(`Failed to upsert conversation: ${error.message}`);
  }
}

/**
 * Get all conversations with message counts
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Object} options - Query options
 * @param {string} [options.type] - Filter by conversation type
 * @param {number} [options.limit] - Maximum results
 * @param {number} [options.offset] - Offset for pagination
 * @returns {Promise<Array>} Array of conversations
 */
async function getConversations(pool, options = {}) {
  const { type, limit = 100, offset = 0 } = options;

  let query = `
    SELECT
      c.id,
      c.name,
      c.type,
      c.team_id,
      c.team_name,
      c.description,
      c.participants,
      c.last_activity,
      c.message_count,
      c.unread_count,
      c.metadata,
      c.created_at,
      c.updated_at,
      COUNT(m.id) as actual_message_count,
      MAX(m.timestamp) as latest_message_time,
      MIN(m.timestamp) as earliest_message_time
    FROM teams.conversations c
    LEFT JOIN teams.messages m ON c.id = m.conversation_id
  `;

  const params = [];
  const conditions = [];

  if (type) {
    conditions.push(`c.type = $${params.length + 1}`);
    params.push(type);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += `
    GROUP BY c.id
    ORDER BY c.last_activity DESC NULLS LAST, c.created_at DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;

  params.push(limit, offset);

  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error getting conversations:', error);
    throw error;
  }
}

/**
 * Get a single conversation by ID
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object|null>} Conversation object or null
 */
async function getConversation(pool, conversationId) {
  try {
    const result = await pool.query(
      `SELECT
        c.*,
        COUNT(m.id) as actual_message_count,
        MAX(m.timestamp) as latest_message_time
       FROM teams.conversations c
       LEFT JOIN teams.messages m ON c.id = m.conversation_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [conversationId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting conversation:', error);
    throw error;
  }
}

/**
 * Get messages for a conversation
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @param {string} conversationId - Conversation ID
 * @param {Object} options - Query options
 * @param {number} [options.limit] - Maximum results
 * @param {number} [options.offset] - Offset for pagination
 * @param {string} [options.orderBy] - Sort field (default: 'timestamp')
 * @param {string} [options.orderDir] - Sort direction: 'ASC' or 'DESC'
 * @returns {Promise<Object>} {messages, total, conversation}
 */
async function getConversationMessages(pool, conversationId, options = {}) {
  const {
    limit = 100,
    offset = 0,
    orderBy = 'timestamp',
    orderDir = 'ASC'
  } = options;

  const allowedOrderBy = ['timestamp', 'created_at', 'sender_name'];
  const allowedOrderDir = ['ASC', 'DESC'];

  const safeOrderBy = allowedOrderBy.includes(orderBy) ? orderBy : 'timestamp';
  const safeOrderDir = allowedOrderDir.includes(orderDir) ? orderDir : 'ASC';

  try {
    // Get messages
    const messagesResult = await pool.query(
      `SELECT *
       FROM teams.messages
       WHERE conversation_id = $1
       ORDER BY ${safeOrderBy} ${safeOrderDir}
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM teams.messages WHERE conversation_id = $1',
      [conversationId]
    );

    // Get conversation info
    const conversation = await getConversation(pool, conversationId);

    return {
      messages: messagesResult.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
      conversation
    };
  } catch (error) {
    console.error('Error getting conversation messages:', error);
    throw error;
  }
}

/**
 * Build threaded structure from flat messages
 * Organizes messages into parent-child relationships
 *
 * @param {Array} messages - Flat array of messages
 * @returns {Array} Array of thread objects
 */
function buildThreadStructure(messages) {
  const messageMap = new Map();
  const roots = [];

  // First pass: index all messages
  messages.forEach(message => {
    messageMap.set(message.message_id, {
      ...message,
      replies: []
    });
  });

  // Second pass: build parent-child relationships
  messages.forEach(message => {
    const current = messageMap.get(message.message_id);

    if (message.parent_message_id && messageMap.has(message.parent_message_id)) {
      // This is a reply - add to parent's replies
      const parent = messageMap.get(message.parent_message_id);
      parent.replies.push(current);
    } else {
      // This is a root message
      roots.push(current);
    }
  });

  return roots;
}

/**
 * Update extraction checkpoint for a conversation
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @param {string} conversationId - Conversation ID
 * @param {Array} messages - Messages that were extracted
 * @returns {Promise<Object>} Updated checkpoint
 */
async function updateCheckpoint(pool, conversationId, messages) {
  if (!messages || messages.length === 0) {
    return null;
  }

  // Find the latest message by timestamp
  const sortedMessages = [...messages].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  const latestMessage = sortedMessages[0];

  try {
    const result = await pool.query(
      `INSERT INTO teams.extraction_checkpoints (
        conversation_id,
        last_message_id,
        last_message_timestamp,
        last_extraction_timestamp,
        total_extracted,
        messages_since_last
      )
      VALUES ($1, $2, $3, NOW(), $4, $4)
      ON CONFLICT (conversation_id)
      DO UPDATE SET
        last_message_id = EXCLUDED.last_message_id,
        last_message_timestamp = EXCLUDED.last_message_timestamp,
        last_extraction_timestamp = NOW(),
        total_extracted = teams.extraction_checkpoints.total_extracted + EXCLUDED.messages_since_last,
        messages_since_last = EXCLUDED.messages_since_last
      RETURNING *`,
      [
        conversationId,
        latestMessage.message_id || latestMessage.messageId,
        latestMessage.timestamp,
        messages.length
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error updating checkpoint:', error);
    throw error;
  }
}

/**
 * Get extraction checkpoint for a conversation
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object|null>} Checkpoint object or null
 */
async function getCheckpoint(pool, conversationId) {
  try {
    const result = await pool.query(
      'SELECT * FROM teams.extraction_checkpoints WHERE conversation_id = $1',
      [conversationId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting checkpoint:', error);
    throw error;
  }
}

/**
 * Get all checkpoints with conversation info
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {Promise<Array>} Array of checkpoints with conversation data
 */
async function getAllCheckpoints(pool) {
  try {
    const result = await pool.query(`
      SELECT
        ck.*,
        c.name as conversation_name,
        c.type as conversation_type,
        c.team_name
      FROM teams.extraction_checkpoints ck
      LEFT JOIN teams.conversations c ON ck.conversation_id = c.id
      ORDER BY ck.last_extraction_timestamp DESC
    `);

    return result.rows;
  } catch (error) {
    console.error('Error getting all checkpoints:', error);
    throw error;
  }
}

/**
 * Delete old or inactive checkpoints
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @param {number} daysOld - Delete checkpoints older than this many days
 * @returns {Promise<number>} Number of checkpoints deleted
 */
async function cleanupOldCheckpoints(pool, daysOld = 90) {
  try {
    const result = await pool.query(
      `DELETE FROM teams.extraction_checkpoints
       WHERE last_extraction_timestamp < NOW() - INTERVAL '${daysOld} days'`,
    );

    return result.rowCount;
  } catch (error) {
    console.error('Error cleaning up checkpoints:', error);
    throw error;
  }
}

module.exports = {
  upsertConversation,
  getConversations,
  getConversation,
  getConversationMessages,
  buildThreadStructure,
  updateCheckpoint,
  getCheckpoint,
  getAllCheckpoints,
  cleanupOldCheckpoints
};
