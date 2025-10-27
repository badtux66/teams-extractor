const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { redis, cacheMiddleware } = require('../config/redis');
const logger = require('../config/logger');

/**
 * GET /api/stats
 * Get comprehensive statistics for dashboard
 */
router.get('/', cacheMiddleware('stats:dashboard', 60), async (req, res) => {
  try {
    const stats = {};

    // Total messages count
    const totalResult = await query('SELECT COUNT(*) as total FROM teams.messages');
    stats.totalMessages = parseInt(totalResult.rows[0].total);

    // Messages today
    const todayResult = await query(`
      SELECT COUNT(*) as count
      FROM teams.messages
      WHERE DATE(timestamp) = CURRENT_DATE
    `);
    stats.messagesToday = parseInt(todayResult.rows[0].count);

    // Messages this week
    const weekResult = await query(`
      SELECT COUNT(*) as count
      FROM teams.messages
      WHERE timestamp >= DATE_TRUNC('week', CURRENT_DATE)
    `);
    stats.messagesThisWeek = parseInt(weekResult.rows[0].count);

    // Messages this month
    const monthResult = await query(`
      SELECT COUNT(*) as count
      FROM teams.messages
      WHERE timestamp >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    stats.messagesThisMonth = parseInt(monthResult.rows[0].count);

    // Unique channels
    const channelsResult = await query(`
      SELECT COUNT(DISTINCT channel_id) as count
      FROM teams.messages
      WHERE channel_id IS NOT NULL
    `);
    stats.totalChannels = parseInt(channelsResult.rows[0].count);

    // Unique senders
    const sendersResult = await query(`
      SELECT COUNT(DISTINCT sender_id) as count
      FROM teams.messages
      WHERE sender_id IS NOT NULL
    `);
    stats.totalSenders = parseInt(sendersResult.rows[0].count);

    // Latest extraction session
    const latestExtractionResult = await query(`
      SELECT
        id,
        started_at,
        completed_at,
        messages_extracted,
        status,
        metadata
      FROM teams.extraction_sessions
      ORDER BY started_at DESC
      LIMIT 1
    `);
    stats.latestExtraction = latestExtractionResult.rows[0] || null;

    // Messages by type
    const typeResult = await query(`
      SELECT type, COUNT(*) as count
      FROM teams.messages
      GROUP BY type
      ORDER BY count DESC
    `);
    stats.messagesByType = typeResult.rows.map(row => ({
      type: row.type,
      count: parseInt(row.count)
    }));

    // Top channels by message count
    const topChannelsResult = await query(`
      SELECT
        channel_id,
        channel_name,
        COUNT(*) as message_count
      FROM teams.messages
      WHERE channel_id IS NOT NULL
      GROUP BY channel_id, channel_name
      ORDER BY message_count DESC
      LIMIT 10
    `);
    stats.topChannels = topChannelsResult.rows.map(row => ({
      channelId: row.channel_id,
      channelName: row.channel_name,
      messageCount: parseInt(row.message_count)
    }));

    // Top senders by message count
    const topSendersResult = await query(`
      SELECT
        sender_id,
        sender_name,
        sender_email,
        COUNT(*) as message_count
      FROM teams.messages
      WHERE sender_id IS NOT NULL
      GROUP BY sender_id, sender_name, sender_email
      ORDER BY message_count DESC
      LIMIT 10
    `);
    stats.topSenders = topSendersResult.rows.map(row => ({
      senderId: row.sender_id,
      senderName: row.sender_name,
      senderEmail: row.sender_email,
      messageCount: parseInt(row.message_count)
    }));

    // Messages per day (last 30 days)
    const dailyResult = await query(`
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as count
      FROM teams.messages
      WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `);
    stats.messagesPerDay = dailyResult.rows.map(row => ({
      date: row.date,
      count: parseInt(row.count)
    }));

    // Database size
    const dbSizeResult = await query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    stats.databaseSize = dbSizeResult.rows[0].size;

    // Table size
    const tableSizeResult = await query(`
      SELECT pg_size_pretty(pg_total_relation_size('teams.messages')) as size
    `);
    stats.messagesTableSize = tableSizeResult.rows[0].size;

    // Average messages per day
    const avgPerDayResult = await query(`
      SELECT
        ROUND(COUNT(*)::numeric / GREATEST(DATE_PART('day', NOW() - MIN(timestamp)), 1), 2) as avg
      FROM teams.messages
    `);
    stats.avgMessagesPerDay = parseFloat(avgPerDayResult.rows[0].avg || 0);

    // Response time statistics
    const responseTimeResult = await query(`
      SELECT
        COUNT(*) as with_replies,
        AVG(EXTRACT(EPOCH FROM (m2.timestamp - m1.timestamp))) as avg_response_time_seconds
      FROM teams.messages m1
      JOIN teams.messages m2 ON m1.thread_id = m2.message_id
      WHERE m1.type = 'reply' AND m1.timestamp > m2.timestamp
    `);
    if (responseTimeResult.rows[0].with_replies) {
      stats.averageResponseTime = {
        count: parseInt(responseTimeResult.rows[0].with_replies),
        seconds: parseFloat(responseTimeResult.rows[0].avg_response_time_seconds || 0)
      };
    }

    return res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Stats endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/stats/channels
 * Get detailed channel statistics
 */
router.get('/channels', cacheMiddleware('stats:channels', 300), async (req, res) => {
  try {
    const result = await query(`
      SELECT
        channel_id,
        channel_name,
        COUNT(*) as message_count,
        COUNT(DISTINCT sender_id) as unique_senders,
        MIN(timestamp) as first_message,
        MAX(timestamp) as last_message,
        AVG(LENGTH(content)) as avg_message_length
      FROM teams.messages
      WHERE channel_id IS NOT NULL
      GROUP BY channel_id, channel_name
      ORDER BY message_count DESC
    `);

    const channels = result.rows.map(row => ({
      channelId: row.channel_id,
      channelName: row.channel_name,
      messageCount: parseInt(row.message_count),
      uniqueSenders: parseInt(row.unique_senders),
      firstMessage: row.first_message,
      lastMessage: row.last_message,
      avgMessageLength: parseFloat(row.avg_message_length).toFixed(2)
    }));

    return res.json({
      success: true,
      channels,
      total: channels.length
    });

  } catch (error) {
    logger.error('Channel stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/stats/senders
 * Get detailed sender statistics
 */
router.get('/senders', cacheMiddleware('stats:senders', 300), async (req, res) => {
  try {
    const result = await query(`
      SELECT
        sender_id,
        sender_name,
        sender_email,
        COUNT(*) as message_count,
        COUNT(DISTINCT channel_id) as channels_active,
        MIN(timestamp) as first_message,
        MAX(timestamp) as last_message,
        AVG(LENGTH(content)) as avg_message_length
      FROM teams.messages
      WHERE sender_id IS NOT NULL
      GROUP BY sender_id, sender_name, sender_email
      ORDER BY message_count DESC
    `);

    const senders = result.rows.map(row => ({
      senderId: row.sender_id,
      senderName: row.sender_name,
      senderEmail: row.sender_email,
      messageCount: parseInt(row.message_count),
      channelsActive: parseInt(row.channels_active),
      firstMessage: row.first_message,
      lastMessage: row.last_message,
      avgMessageLength: parseFloat(row.avg_message_length).toFixed(2)
    }));

    return res.json({
      success: true,
      senders,
      total: senders.length
    });

  } catch (error) {
    logger.error('Sender stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/stats/timeline
 * Get message timeline data
 */
router.get('/timeline', cacheMiddleware('stats:timeline', 300), async (req, res) => {
  try {
    const { period = 'day', days = 30 } = req.query;

    let interval, format;
    switch (period) {
      case 'hour':
        interval = '1 hour';
        format = 'YYYY-MM-DD HH24:00';
        break;
      case 'week':
        interval = '1 week';
        format = 'IYYY-IW';
        break;
      case 'month':
        interval = '1 month';
        format = 'YYYY-MM';
        break;
      default:
        interval = '1 day';
        format = 'YYYY-MM-DD';
    }

    const result = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC($1, timestamp), $2) as period,
        COUNT(*) as count,
        COUNT(DISTINCT channel_id) as active_channels,
        COUNT(DISTINCT sender_id) as active_senders
      FROM teams.messages
      WHERE timestamp >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY period
      ORDER BY period ASC
    `, [period, format]);

    return res.json({
      success: true,
      timeline: result.rows.map(row => ({
        period: row.period,
        count: parseInt(row.count),
        activeChannels: parseInt(row.active_channels),
        activeSenders: parseInt(row.active_senders)
      })),
      period,
      days: parseInt(days)
    });

  } catch (error) {
    logger.error('Timeline stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
