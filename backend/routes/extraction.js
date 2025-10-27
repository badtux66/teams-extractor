const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { query, transaction } = require('../config/database');
const { redis } = require('../config/redis');
const logger = require('../config/logger');

/**
 * POST /api/extraction/trigger
 * Manually trigger extraction (creates session, signals extension)
 */
router.post('/trigger', async (req, res) => {
  try {
    const schema = Joi.object({
      metadata: Joi.object().default({})
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { metadata } = value;

    // Create extraction session
    const result = await query(`
      INSERT INTO teams.extraction_sessions (status, metadata)
      VALUES ('in_progress', $1)
      RETURNING id, started_at, status
    `, [JSON.stringify(metadata)]);

    const session = result.rows[0];

    logger.info(`Extraction session started: ${session.id}`);

    // Emit WebSocket event to notify connected clients
    if (req.app.get('io')) {
      req.app.get('io').emit('extraction:started', {
        sessionId: session.id,
        startedAt: session.started_at
      });
    }

    // Set session ID in Redis for extension to pick up
    await redis.setex('extraction:active', 3600, session.id);

    return res.json({
      success: true,
      session: {
        id: session.id,
        startedAt: session.started_at,
        status: session.status
      }
    });

  } catch (error) {
    logger.error('Extraction trigger error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/extraction/sessions
 * List extraction sessions with filtering
 */
router.get('/sessions', async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      status
    } = req.query;

    let whereClause = '';
    let params = [];
    let paramIndex = 1;

    if (status) {
      whereClause = `WHERE status = $${paramIndex++}`;
      params.push(status);
    }

    const queryText = `
      SELECT
        id,
        started_at,
        completed_at,
        messages_extracted,
        status,
        metadata,
        EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)) as duration_seconds
      FROM teams.extraction_sessions
      ${whereClause}
      ORDER BY started_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM teams.extraction_sessions
      ${whereClause}
    `;
    const countResult = await query(countQuery, status ? [status] : []);

    return res.json({
      success: true,
      sessions: result.rows.map(row => ({
        id: row.id,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        messagesExtracted: row.messages_extracted,
        status: row.status,
        metadata: row.metadata,
        durationSeconds: parseFloat(row.duration_seconds)
      })),
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    logger.error('List extraction sessions error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/extraction/sessions/:id
 * Get single extraction session details
 */
router.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT
        id,
        started_at,
        completed_at,
        messages_extracted,
        status,
        metadata,
        EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at)) as duration_seconds
      FROM teams.extraction_sessions
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Extraction session not found'
      });
    }

    const session = result.rows[0];

    return res.json({
      success: true,
      session: {
        id: session.id,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        messagesExtracted: session.messages_extracted,
        status: session.status,
        metadata: session.metadata,
        durationSeconds: parseFloat(session.duration_seconds)
      }
    });

  } catch (error) {
    logger.error('Get extraction session error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PATCH /api/extraction/sessions/:id
 * Update extraction session (complete, fail, etc.)
 */
router.patch('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const schema = Joi.object({
      status: Joi.string().valid('in_progress', 'completed', 'failed').required(),
      messagesExtracted: Joi.number().integer().min(0),
      metadata: Joi.object()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const { status, messagesExtracted, metadata } = value;

    // Build update query dynamically
    const updates = ['status = $1'];
    const params = [status];
    let paramIndex = 2;

    if (status === 'completed' || status === 'failed') {
      updates.push(`completed_at = NOW()`);
    }

    if (messagesExtracted !== undefined) {
      updates.push(`messages_extracted = $${paramIndex++}`);
      params.push(messagesExtracted);
    }

    if (metadata) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(metadata));
    }

    params.push(id);

    const result = await query(`
      UPDATE teams.extraction_sessions
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, started_at, completed_at, messages_extracted, status, metadata
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Extraction session not found'
      });
    }

    const session = result.rows[0];

    logger.info(`Extraction session updated: ${id} - ${status}`);

    // Emit WebSocket event
    if (req.app.get('io')) {
      req.app.get('io').emit('extraction:updated', {
        sessionId: session.id,
        status: session.status,
        messagesExtracted: session.messages_extracted
      });
    }

    return res.json({
      success: true,
      session: {
        id: session.id,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        messagesExtracted: session.messages_extracted,
        status: session.status,
        metadata: session.metadata
      }
    });

  } catch (error) {
    logger.error('Update extraction session error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/extraction/active
 * Get currently active extraction session
 */
router.get('/active', async (req, res) => {
  try {
    // Check Redis for active session
    const activeSessionId = await redis.get('extraction:active');

    if (!activeSessionId) {
      return res.json({
        success: true,
        active: false,
        session: null
      });
    }

    // Get session details
    const result = await query(`
      SELECT
        id,
        started_at,
        completed_at,
        messages_extracted,
        status,
        metadata,
        EXTRACT(EPOCH FROM (NOW() - started_at)) as duration_seconds
      FROM teams.extraction_sessions
      WHERE id = $1
    `, [activeSessionId]);

    if (result.rows.length === 0) {
      // Clean up stale Redis key
      await redis.del('extraction:active');
      return res.json({
        success: true,
        active: false,
        session: null
      });
    }

    const session = result.rows[0];

    return res.json({
      success: true,
      active: session.status === 'in_progress',
      session: {
        id: session.id,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        messagesExtracted: session.messages_extracted,
        status: session.status,
        metadata: session.metadata,
        durationSeconds: parseFloat(session.duration_seconds)
      }
    });

  } catch (error) {
    logger.error('Get active extraction error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/extraction/sessions/:id
 * Delete extraction session
 */
router.delete('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM teams.extraction_sessions WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Extraction session not found'
      });
    }

    logger.info(`Extraction session deleted: ${id}`);

    return res.json({
      success: true,
      message: 'Extraction session deleted'
    });

  } catch (error) {
    logger.error('Delete extraction session error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
