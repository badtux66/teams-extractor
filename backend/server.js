const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const logger = require('./config/logger');
const { pool } = require('./config/database');
const { redis } = require('./config/redis');

// Import routes
const messagesRoutes = require('./routes/messages');
const statsRoutes = require('./routes/stats');
const healthRoutes = require('./routes/health');
const extractionRoutes = require('./routes/extraction');
const mcpRoutes = require('./routes/mcp');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Make io available to routes
app.set('io', io);

// Middleware
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Allow localhost and chrome-extension origins
    if (origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1') ||
        origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    // Allow configured CORS_ORIGIN
    if (process.env.CORS_ORIGIN && origin === process.env.CORS_ORIGIN) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Request ID middleware
app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Mount routes
app.use('/api/messages', messagesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/extraction', extractionRoutes);
app.use('/api/mcp', mcpRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Teams Message Extractor Backend',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    path: req.path
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    requestId: req.id,
    path: req.path
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    requestId: req.id
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Join extraction room
  socket.on('join:extraction', (extractionId) => {
    socket.join(`extraction:${extractionId}`);
    logger.info(`Client ${socket.id} joined extraction ${extractionId}`);
  });

  // Leave extraction room
  socket.on('leave:extraction', (extractionId) => {
    socket.leave(`extraction:${extractionId}`);
    logger.info(`Client ${socket.id} left extraction ${extractionId}`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close database pool
      await pool.end();
      logger.info('Database pool closed');

      // Close Redis connection
      await redis.quit();
      logger.info('Redis connection closed');

      // Close Socket.IO
      io.close(() => {
        logger.info('Socket.IO server closed');
        process.exit(0);
      });
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
});

module.exports = { app, server, io };
