const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { query, transaction, getPool } = require('../config/database');
const { redis, invalidatePattern } = require('../config/redis');
const logger = require('../config/logger');
const { deduplicateMessages, incrementExtractionCount, getDeduplicationStats } = require('../utils/deduplication');
const { upsertConversation, updateCheckpoint } = require('../utils/conversations');

// Validation schema for batch messages
const messageSchema = Joi.object({
  messageId: Joi.string().required(),
  channelId: Joi.string().allow(null, ''),
  channelName: Joi.string().allow(null, ''),
  content: Joi.string().required(),
  sender: Joi.object({
    id: Joi.string().allow(null, ''),
    name: Joi.string().required(),
    email: Joi.string().email().allow(null, '')
  }).required(),
  timestamp: Joi.date().iso().required(),
  url: Joi.string().uri().allow(null, ''),
  type: Joi.string().valid('message', 'reply', 'system').default('message'),
  threadId: Joi.string().allow(null, ''),
  attachments: Joi.array().default([]),
  reactions: Joi.array().default([]),
  metadata: Joi.object().default({})
});

const batchSchema = Joi.object({
  messages: Joi.array().items(messageSchema).min(1).max(1000).required(),
  extractionId: Joi.string().required(),
  metadata: Joi.object().default({}),
  // New conversation fields
  conversationId: Joi.string().allow(null, ''),
  conversationName: Joi.string().allow(null, ''),
  conversationType: Joi.string().valid('channel', 'chat', 'meeting', 'direct').allow(null, ''),
  teamId: Joi.string().allow(null, ''),
  teamName: Joi.string().allow(null, ''),
  threadStructure: Joi.array().default([])
});

/**
 * POST /api/messages/batch
 * Bulk message ingestion from Chrome extension
 * Now supports conversation grouping and hash-based deduplication
 */
router.post('/batch', async (req, res) => {
  const startTime = Date.now();

  try {
    // Validate request body
    const { error, value } = batchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const {
      messages,
      extractionId,
      metadata,
      conversationId,
      conversationName,
      conversationType,
      teamId,
      teamName
    } = value;

    logger.info(`Processing batch of ${messages.length} messages`, {
      extractionId,
      conversationId,
      conversationName
    });

    const pool = getPool();

    // 1. Create or update conversation if provided
    if (conversationId && conversationName && conversationType) {
      try {
        await upsertConversation(pool, {
          id: conversationId,
          name: conversationName,
          type: conversationType,
          teamId,
          teamName,
          metadata
        });
        logger.info(`Upserted conversation: ${conversationName}`, { conversationId });
      } catch (convError) {
        logger.error('Failed to upsert conversation:', convError);
        // Continue processing messages even if conversation upsert fails
      }
    } else {
      // Fallback: Try to upsert conversation from message channelId if available
      const channelIds = [...new Set(messages.map(m => m.channelId).filter(Boolean))];
      if (channelIds.length === 1 && !conversationId) {
        // If all messages are from same channel, treat it as conversation
        const fallbackId = channelIds[0];
        const fallbackName = messages[0].channelName || 'Unknown Channel';
        try {
          await upsertConversation(pool, {
            id: fallbackId,
            name: fallbackName,
            type: 'channel',
            teamId: null,
            teamName: null,
            metadata: { createdFrom: 'fallback' }
          });
          logger.info(`Upserted fallback conversation: ${fallbackName}`, { conversationId: fallbackId });
          // Update conversationId for the batch context
          // Note: We can't easily update the const conversationId variable, 
          // but the insert logic below uses m.channelId as fallback for conversation_id column
        } catch (err) {
          logger.warn('Failed to upsert fallback conversation:', err);
        }
      }
    }

    // 2. Deduplicate using message hashes (database check)
    const deduplicationResult = await deduplicateMessages(pool, messages);
    const { newMessages, duplicates } = deduplicationResult;

    logger.info(`Deduplication: ${newMessages.length} new, ${duplicates.length} duplicates`);

    // 3. Update extraction count for duplicates
    if (duplicates.length > 0) {
      try {
        const duplicateHashes = duplicates.map(m => m.message_hash);
        await incrementExtractionCount(pool, duplicateHashes);
        logger.info(`Incremented extraction count for ${duplicates.length} duplicates`);
      } catch (countError) {
        logger.warn('Failed to increment extraction count:', countError);
      }
    }

    // 4. Batch insert new messages to PostgreSQL
    let insertedCount = 0;
    let errorCount = 0;

    if (newMessages.length > 0) {
      try {
        const result = await transaction(async (client) => {
          // Now includes conversation_id and message_hash
          const insertQuery = `
            INSERT INTO teams.messages (
              message_id, channel_id, channel_name, content,
              sender_id, sender_name, sender_email, timestamp,
              url, type, thread_id, attachments, reactions, metadata,
              conversation_id, message_hash, first_extracted_at
            ) VALUES ${newMessages.map((_, i) => {
            const base = i * 17;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17})`;
          }).join(', ')}
            ON CONFLICT (message_id) DO UPDATE SET
              content = EXCLUDED.content,
              conversation_id = EXCLUDED.conversation_id,
              extraction_count = teams.messages.extraction_count + 1,
              updated_at = NOW()
            RETURNING id
          `;

          const values = newMessages.flatMap(m => [
            m.messageId,
            m.channelId || conversationId || null,
            m.channelName || conversationName || null,
            m.content,
            m.sender.id || null,
            m.sender.name,
            m.sender.email || null,
            m.timestamp,
            m.url || null,
            m.type,
            m.threadId || null,
            JSON.stringify(m.attachments),
            JSON.stringify(m.reactions),
            JSON.stringify(m.metadata),
            conversationId || m.channelId || null,
            m.message_hash,
            new Date()
          ]);

          return await client.query(insertQuery, values);
        });

        insertedCount = result.rowCount;
        logger.info(`Inserted ${insertedCount} messages to database`);

        // 5. Update extraction checkpoint
        if (conversationId && newMessages.length > 0) {
          try {
            await updateCheckpoint(pool, conversationId, newMessages);
            logger.info(`Updated checkpoint for conversation: ${conversationId}`);
          } catch (checkpointError) {
            logger.warn('Failed to update checkpoint:', checkpointError);
          }
        }

        // 6. Invalidate related caches
        await invalidatePattern('messages:list:*');
        await invalidatePattern('messages:stats:*');
        await invalidatePattern('conversations:*');

        // 7. Emit WebSocket event
        if (req.app.get('io')) {
          req.app.get('io').emit('messages:batch', {
            count: insertedCount,
            conversationId,
            conversationName,
            extractionId,
            timestamp: new Date()
          });
        }

      } catch (dbError) {
        logger.error('Database insert error:', dbError);
        errorCount = newMessages.length;
      }
    }

    const processingTime = Date.now() - startTime;

    return res.json({
      success: true,
      processed: messages.length,
      new: newMessages.length,
      inserted: insertedCount,
      duplicates: duplicates.length,
      errors: errorCount,
      processingTime,
      extractionId,
      conversationId: conversationId || null
    });

  } catch (error) {
    logger.error('Batch processing failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/messages
 * List messages with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const {
      limit = 100,
      offset = 0,
      channelId,
      senderId,
      startDate,
      endDate,
      search
    } = req.query;

    let whereClause = [];
    let params = [];
    let paramIndex = 1;

    if (channelId) {
      whereClause.push(`channel_id = $${paramIndex++}`);
      params.push(channelId);
    }

    if (senderId) {
      whereClause.push(`sender_id = $${paramIndex++}`);
      params.push(senderId);
    }

    if (startDate) {
      whereClause.push(`timestamp >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      whereClause.push(`timestamp <= $${paramIndex++}`);
      params.push(endDate);
    }

    if (search) {
      whereClause.push(`to_tsvector('english', content) @@ plainto_tsquery('english', $${paramIndex++})`);
      params.push(search);
    }

    const whereSQL = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    const queryText = `
      SELECT
        id,
        message_id,
        channel_id,
        channel_name,
        content,
        sender_id,
        sender_name,
        sender_email,
        timestamp,
        url,
        type,
        thread_id,
        attachments,
        reactions,
        metadata,
        extracted_at,
        created_at,
        updated_at
      FROM teams.messages
      ${whereSQL}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM teams.messages
      ${whereSQL}
    `;
    const countResult = await query(countQuery, params.slice(0, -2));

    return res.json({
      success: true,
      messages: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error('List messages error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/messages/search
 * Full-text search
 * IMPORTANT: This route must be defined BEFORE the /:id route
 */
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 50 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query required'
      });
    }

    const result = await query(`
      SELECT
        id, message_id, channel_name, sender_name, content, timestamp,
        ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) AS relevance
      FROM teams.messages
      WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
      ORDER BY relevance DESC, timestamp DESC
      LIMIT $2
    `, [q, limit]);

    return res.json({
      success: true,
      results: result.rows,
      count: result.rowCount
    });

  } catch (error) {
    logger.error('Search error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/messages/:id
 * Get single message by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM teams.messages WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    return res.json({
      success: true,
      message: result.rows[0]
    });

  } catch (error) {
    logger.error('Get message error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
