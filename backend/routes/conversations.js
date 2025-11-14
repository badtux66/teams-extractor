/**
 * Conversations Routes
 * API endpoints for managing conversations (channels, chats, meetings)
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { getPool } = require('../config/database');
const { redis } = require('../config/redis');
const logger = require('../config/logger');
const {
  getConversations,
  getConversation,
  getConversationMessages,
  buildThreadStructure,
  getCheckpoint,
  getAllCheckpoints
} = require('../utils/conversations');

/**
 * GET /api/conversations
 * List all conversations with message counts
 */
router.get('/', async (req, res) => {
  try {
    const {
      type,
      limit = 100,
      offset = 0
    } = req.query;

    // Check cache first
    const cacheKey = `conversations:list:${type || 'all'}:${limit}:${offset}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      logger.debug('Returning cached conversations list');
      return res.json(JSON.parse(cached));
    }

    const pool = getPool();
    const conversations = await getConversations(pool, {
      type,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const response = {
      success: true,
      conversations,
      total: conversations.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // Cache for 60 seconds
    await redis.setex(cacheKey, 60, JSON.stringify(response));

    return res.json(response);

  } catch (error) {
    logger.error('List conversations error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/conversations/:id
 * Get a single conversation with details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check cache
    const cacheKey = `conversation:${id}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      logger.debug('Returning cached conversation');
      return res.json(JSON.parse(cached));
    }

    const pool = getPool();
    const conversation = await getConversation(pool, id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    const response = {
      success: true,
      conversation
    };

    // Cache for 120 seconds
    await redis.setex(cacheKey, 120, JSON.stringify(response));

    return res.json(response);

  } catch (error) {
    logger.error('Get conversation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/conversations/:id/messages
 * Get messages for a specific conversation
 */
router.get('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      limit = 100,
      offset = 0,
      orderBy = 'timestamp',
      orderDir = 'ASC',
      threaded = 'false'
    } = req.query;

    const pool = getPool();
    const result = await getConversationMessages(pool, id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy,
      orderDir
    });

    // Build threaded structure if requested
    let response;
    if (threaded === 'true') {
      const threads = buildThreadStructure(result.messages);
      response = {
        success: true,
        conversationId: id,
        threads,
        threadCount: threads.length,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        conversation: result.conversation
      };
    } else {
      response = {
        success: true,
        conversationId: id,
        messages: result.messages,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        conversation: result.conversation
      };
    }

    return res.json(response);

  } catch (error) {
    logger.error('Get conversation messages error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/conversations/:id/checkpoint
 * Get extraction checkpoint for a conversation
 */
router.get('/:id/checkpoint', async (req, res) => {
  try {
    const { id } = req.params;

    const pool = getPool();
    const checkpoint = await getCheckpoint(pool, id);

    if (!checkpoint) {
      return res.status(404).json({
        success: false,
        error: 'Checkpoint not found'
      });
    }

    return res.json({
      success: true,
      checkpoint
    });

  } catch (error) {
    logger.error('Get checkpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/conversations/checkpoints/all
 * Get all extraction checkpoints (must be before /:id route)
 */
router.get('/checkpoints/all', async (req, res) => {
  try {
    const pool = getPool();
    const checkpoints = await getAllCheckpoints(pool);

    return res.json({
      success: true,
      checkpoints,
      total: checkpoints.length
    });

  } catch (error) {
    logger.error('Get all checkpoints error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/conversations/stats/summary
 * Get conversation statistics (must be before /:id route)
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const pool = getPool();

    // Get conversation type breakdown
    const typeStatsResult = await pool.query(`
      SELECT
        type,
        COUNT(*) as count,
        SUM(message_count) as total_messages,
        MAX(last_activity) as most_recent_activity
      FROM teams.conversations
      GROUP BY type
      ORDER BY count DESC
    `);

    // Get overall stats
    const overallResult = await pool.query(`
      SELECT
        COUNT(*) as total_conversations,
        SUM(message_count) as total_messages,
        AVG(message_count) as avg_messages_per_conversation,
        COUNT(*) FILTER (WHERE last_activity >= NOW() - INTERVAL '7 days') as active_last_week,
        COUNT(*) FILTER (WHERE last_activity >= NOW() - INTERVAL '30 days') as active_last_month
      FROM teams.conversations
    `);

    // Get most active conversations
    const mostActiveResult = await pool.query(`
      SELECT
        id,
        name,
        type,
        message_count,
        last_activity,
        team_name
      FROM teams.conversations
      ORDER BY message_count DESC
      LIMIT 10
    `);

    return res.json({
      success: true,
      byType: typeStatsResult.rows,
      overall: overallResult.rows[0],
      mostActive: mostActiveResult.rows
    });

  } catch (error) {
    logger.error('Get conversation stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
