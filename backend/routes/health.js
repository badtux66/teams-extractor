const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { redis } = require('../config/redis');
const logger = require('../config/logger');

/**
 * GET /api/health
 * Comprehensive health check endpoint
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {}
  };

  // Check PostgreSQL
  try {
    const pgStart = Date.now();
    const result = await pool.query('SELECT NOW()');
    const pgTime = Date.now() - pgStart;

    health.services.postgresql = {
      status: 'healthy',
      responseTime: pgTime,
      serverTime: result.rows[0].now
    };
  } catch (error) {
    logger.error('PostgreSQL health check failed:', error);
    health.services.postgresql = {
      status: 'unhealthy',
      error: error.message
    };
    health.status = 'degraded';
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    await redis.ping();
    const redisTime = Date.now() - redisStart;

    // Get Redis info
    const info = await redis.info('server');
    const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);
    const redisUptime = uptimeMatch ? parseInt(uptimeMatch[1]) : null;

    health.services.redis = {
      status: 'healthy',
      responseTime: redisTime,
      uptime: redisUptime
    };
  } catch (error) {
    logger.error('Redis health check failed:', error);
    health.services.redis = {
      status: 'unhealthy',
      error: error.message
    };
    health.status = 'degraded';
  }

  // Get database statistics
  try {
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM teams.messages) as total_messages,
        (SELECT COUNT(*) FROM teams.extraction_sessions) as total_sessions,
        (SELECT pg_database_size(current_database())) as db_size
    `);

    health.database = {
      totalMessages: parseInt(statsResult.rows[0].total_messages),
      totalSessions: parseInt(statsResult.rows[0].total_sessions),
      databaseSize: parseInt(statsResult.rows[0].db_size)
    };
  } catch (error) {
    logger.error('Database stats check failed:', error);
  }

  // System memory
  const memUsage = process.memoryUsage();
  health.memory = {
    rss: Math.round(memUsage.rss / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    external: Math.round(memUsage.external / 1024 / 1024) // MB
  };

  // Process info
  health.process = {
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  };

  // Total response time
  health.responseTime = Date.now() - startTime;

  // Add fields expected by frontend
  health.model = 'N/A'; // No LLM model in this backend
  health.db = health.services.postgresql?.status === 'healthy'
    ? `PostgreSQL (${health.database?.totalMessages || 0} messages)`
    : 'Disconnected';
  health.n8n_connected = false; // No n8n integration

  // Set HTTP status based on health status
  const statusCode = health.status === 'healthy' ? 200 : 503;

  return res.status(statusCode).json(health);
});

/**
 * GET /api/health/ready
 * Readiness probe for container orchestration
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if database is ready
    await pool.query('SELECT 1');

    // Check if Redis is ready
    await redis.ping();

    return res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    return res.status(503).json({
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/live
 * Liveness probe for container orchestration
 */
router.get('/live', (req, res) => {
  // Simple liveness check - process is running
  return res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * GET /api/health/metrics
 * Prometheus-compatible metrics endpoint
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = [];

    // Process metrics
    const memUsage = process.memoryUsage();
    metrics.push(`# HELP process_memory_rss_bytes Resident Set Size in bytes`);
    metrics.push(`# TYPE process_memory_rss_bytes gauge`);
    metrics.push(`process_memory_rss_bytes ${memUsage.rss}`);

    metrics.push(`# HELP process_memory_heap_bytes Heap memory in bytes`);
    metrics.push(`# TYPE process_memory_heap_bytes gauge`);
    metrics.push(`process_memory_heap_bytes ${memUsage.heapUsed}`);

    metrics.push(`# HELP process_uptime_seconds Process uptime in seconds`);
    metrics.push(`# TYPE process_uptime_seconds counter`);
    metrics.push(`process_uptime_seconds ${process.uptime()}`);

    // Database metrics
    const dbStats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM teams.messages) as total_messages,
        (SELECT COUNT(*) FROM teams.extraction_sessions) as total_sessions
    `);

    metrics.push(`# HELP teams_messages_total Total number of messages`);
    metrics.push(`# TYPE teams_messages_total counter`);
    metrics.push(`teams_messages_total ${dbStats.rows[0].total_messages}`);

    metrics.push(`# HELP teams_extraction_sessions_total Total number of extraction sessions`);
    metrics.push(`# TYPE teams_extraction_sessions_total counter`);
    metrics.push(`teams_extraction_sessions_total ${dbStats.rows[0].total_sessions}`);

    // Connection pool metrics
    metrics.push(`# HELP db_pool_total_count Database pool total connections`);
    metrics.push(`# TYPE db_pool_total_count gauge`);
    metrics.push(`db_pool_total_count ${pool.totalCount}`);

    metrics.push(`# HELP db_pool_idle_count Database pool idle connections`);
    metrics.push(`# TYPE db_pool_idle_count gauge`);
    metrics.push(`db_pool_idle_count ${pool.idleCount}`);

    metrics.push(`# HELP db_pool_waiting_count Database pool waiting count`);
    metrics.push(`# TYPE db_pool_waiting_count gauge`);
    metrics.push(`db_pool_waiting_count ${pool.waitingCount}`);

    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    return res.send(metrics.join('\n') + '\n');

  } catch (error) {
    logger.error('Metrics endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
