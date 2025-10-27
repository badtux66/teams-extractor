#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.MCP_DATABASE_URL || process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.query('SELECT NOW()')
  .then(() => console.error('✅ MCP Server: Database connected'))
  .catch(err => console.error('❌ MCP Server: Database connection failed:', err.message));

// Create MCP server
const server = new Server(
  {
    name: 'teams-extractor-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_messages',
        description: 'List Teams messages with optional filtering by channel, sender, or date range. Returns paginated results.',
        inputSchema: {
          type: 'object',
          properties: {
            channel_id: {
              type: 'string',
              description: 'Filter by channel ID',
            },
            channel_name: {
              type: 'string',
              description: 'Filter by channel name (partial match)',
            },
            sender_name: {
              type: 'string',
              description: 'Filter by sender name (partial match)',
            },
            from_date: {
              type: 'string',
              description: 'Filter messages from this date (ISO 8601 format)',
            },
            to_date: {
              type: 'string',
              description: 'Filter messages until this date (ISO 8601 format)',
            },
            limit: {
              type: 'number',
              description: 'Number of messages to return (default: 50, max: 500)',
              default: 50,
            },
            offset: {
              type: 'number',
              description: 'Number of messages to skip (for pagination)',
              default: 0,
            },
          },
        },
      },
      {
        name: 'search_messages',
        description: 'Search Teams messages using full-text search. Searches in message content and returns results ranked by relevance.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query text',
            },
            channel_name: {
              type: 'string',
              description: 'Optionally filter by channel name',
            },
            sender_name: {
              type: 'string',
              description: 'Optionally filter by sender name',
            },
            limit: {
              type: 'number',
              description: 'Number of results to return (default: 20, max: 100)',
              default: 20,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_statistics',
        description: 'Get comprehensive statistics about Teams messages including total counts, top channels, top senders, and recent activity.',
        inputSchema: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: 'Number of days to include in statistics (default: 30)',
              default: 30,
            },
          },
        },
      },
      {
        name: 'get_message',
        description: 'Get detailed information about a specific message by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            message_id: {
              type: 'string',
              description: 'The message ID to retrieve',
            },
          },
          required: ['message_id'],
        },
      },
      {
        name: 'get_channel_summary',
        description: 'Get a summary of activity in a specific channel including message count, active senders, and recent messages.',
        inputSchema: {
          type: 'object',
          properties: {
            channel_name: {
              type: 'string',
              description: 'Name of the channel to summarize',
            },
            days: {
              type: 'number',
              description: 'Number of days to include (default: 7)',
              default: 7,
            },
          },
          required: ['channel_name'],
        },
      },
      {
        name: 'get_sender_activity',
        description: 'Get activity summary for a specific sender including message count, active channels, and recent messages.',
        inputSchema: {
          type: 'object',
          properties: {
            sender_name: {
              type: 'string',
              description: 'Name of the sender to analyze',
            },
            days: {
              type: 'number',
              description: 'Number of days to include (default: 7)',
              default: 7,
            },
          },
          required: ['sender_name'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_messages':
        return await handleListMessages(args);

      case 'search_messages':
        return await handleSearchMessages(args);

      case 'get_statistics':
        return await handleGetStatistics(args);

      case 'get_message':
        return await handleGetMessage(args);

      case 'get_channel_summary':
        return await handleGetChannelSummary(args);

      case 'get_sender_activity':
        return await handleGetSenderActivity(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Handler: List Messages
async function handleListMessages(args) {
  const {
    channel_id,
    channel_name,
    sender_name,
    from_date,
    to_date,
    limit = 50,
    offset = 0,
  } = args;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (channel_id) {
    conditions.push(`channel_id = $${paramIndex++}`);
    params.push(channel_id);
  }

  if (channel_name) {
    conditions.push(`channel_name ILIKE $${paramIndex++}`);
    params.push(`%${channel_name}%`);
  }

  if (sender_name) {
    conditions.push(`sender_name ILIKE $${paramIndex++}`);
    params.push(`%${sender_name}%`);
  }

  if (from_date) {
    conditions.push(`timestamp >= $${paramIndex++}`);
    params.push(from_date);
  }

  if (to_date) {
    conditions.push(`timestamp <= $${paramIndex++}`);
    params.push(to_date);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(Math.min(limit, 500), offset);

  const query = `
    SELECT
      id,
      message_id,
      content,
      sender_name,
      sender_email,
      channel_name,
      timestamp,
      type,
      url
    FROM teams.messages
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;

  const result = await pool.query(query, params);

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM teams.messages
    ${whereClause}
  `;
  const countResult = await pool.query(countQuery, params.slice(0, -2));
  const total = parseInt(countResult.rows[0].total);

  const messages = result.rows.map(row => ({
    id: row.id,
    messageId: row.message_id,
    content: row.content,
    sender: {
      name: row.sender_name,
      email: row.sender_email,
    },
    channel: row.channel_name,
    timestamp: row.timestamp,
    type: row.type,
    url: row.url,
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          messages,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        }, null, 2),
      },
    ],
  };
}

// Handler: Search Messages
async function handleSearchMessages(args) {
  const { query, channel_name, sender_name, limit = 20 } = args;

  const conditions = ["to_tsvector('english', content) @@ plainto_tsquery('english', $1)"];
  const params = [query];
  let paramIndex = 2;

  if (channel_name) {
    conditions.push(`channel_name ILIKE $${paramIndex++}`);
    params.push(`%${channel_name}%`);
  }

  if (sender_name) {
    conditions.push(`sender_name ILIKE $${paramIndex++}`);
    params.push(`%${sender_name}%`);
  }

  params.push(Math.min(limit, 100));

  const searchQuery = `
    SELECT
      id,
      message_id,
      content,
      sender_name,
      sender_email,
      channel_name,
      timestamp,
      type,
      url,
      ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) as relevance
    FROM teams.messages
    WHERE ${conditions.join(' AND ')}
    ORDER BY relevance DESC, timestamp DESC
    LIMIT $${paramIndex}
  `;

  const result = await pool.query(searchQuery, params);

  const messages = result.rows.map(row => ({
    id: row.id,
    messageId: row.message_id,
    content: row.content,
    sender: {
      name: row.sender_name,
      email: row.sender_email,
    },
    channel: row.channel_name,
    timestamp: row.timestamp,
    type: row.type,
    url: row.url,
    relevance: parseFloat(row.relevance).toFixed(4),
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          query,
          results: messages,
          count: messages.length,
        }, null, 2),
      },
    ],
  };
}

// Handler: Get Statistics
async function handleGetStatistics(args) {
  const { days = 30 } = args;

  const stats = {};

  // Total messages
  const totalResult = await pool.query('SELECT COUNT(*) as total FROM teams.messages');
  stats.totalMessages = parseInt(totalResult.rows[0].total);

  // Messages in period
  const periodResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM teams.messages
    WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
  `);
  stats.messagesInPeriod = parseInt(periodResult.rows[0].count);

  // Top channels
  const channelsResult = await pool.query(`
    SELECT
      channel_name,
      COUNT(*) as message_count
    FROM teams.messages
    WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      AND channel_name IS NOT NULL
    GROUP BY channel_name
    ORDER BY message_count DESC
    LIMIT 10
  `);
  stats.topChannels = channelsResult.rows.map(row => ({
    channel: row.channel_name,
    messageCount: parseInt(row.message_count),
  }));

  // Top senders
  const sendersResult = await pool.query(`
    SELECT
      sender_name,
      sender_email,
      COUNT(*) as message_count
    FROM teams.messages
    WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      AND sender_name IS NOT NULL
    GROUP BY sender_name, sender_email
    ORDER BY message_count DESC
    LIMIT 10
  `);
  stats.topSenders = sendersResult.rows.map(row => ({
    name: row.sender_name,
    email: row.sender_email,
    messageCount: parseInt(row.message_count),
  }));

  // Daily activity
  const dailyResult = await pool.query(`
    SELECT
      DATE(timestamp) as date,
      COUNT(*) as count
    FROM teams.messages
    WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
    GROUP BY DATE(timestamp)
    ORDER BY date DESC
    LIMIT 30
  `);
  stats.dailyActivity = dailyResult.rows.map(row => ({
    date: row.date,
    count: parseInt(row.count),
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          period: `Last ${days} days`,
          statistics: stats,
        }, null, 2),
      },
    ],
  };
}

// Handler: Get Message
async function handleGetMessage(args) {
  const { message_id } = args;

  const result = await pool.query(`
    SELECT
      id,
      message_id,
      content,
      sender_name,
      sender_email,
      sender_id,
      channel_name,
      channel_id,
      timestamp,
      type,
      url,
      thread_id,
      attachments,
      reactions,
      metadata,
      created_at
    FROM teams.messages
    WHERE message_id = $1
  `, [message_id]);

  if (result.rows.length === 0) {
    throw new Error(`Message not found: ${message_id}`);
  }

  const message = result.rows[0];

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          message: {
            id: message.id,
            messageId: message.message_id,
            content: message.content,
            sender: {
              id: message.sender_id,
              name: message.sender_name,
              email: message.sender_email,
            },
            channel: {
              id: message.channel_id,
              name: message.channel_name,
            },
            timestamp: message.timestamp,
            type: message.type,
            url: message.url,
            threadId: message.thread_id,
            attachments: message.attachments,
            reactions: message.reactions,
            metadata: message.metadata,
            createdAt: message.created_at,
          },
        }, null, 2),
      },
    ],
  };
}

// Handler: Get Channel Summary
async function handleGetChannelSummary(args) {
  const { channel_name, days = 7 } = args;

  // Channel stats
  const statsResult = await pool.query(`
    SELECT
      COUNT(*) as message_count,
      COUNT(DISTINCT sender_name) as unique_senders,
      MIN(timestamp) as first_message,
      MAX(timestamp) as last_message
    FROM teams.messages
    WHERE channel_name ILIKE $1
      AND timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
  `, [`%${channel_name}%`]);

  const stats = statsResult.rows[0];

  // Top senders in channel
  const sendersResult = await pool.query(`
    SELECT
      sender_name,
      COUNT(*) as message_count
    FROM teams.messages
    WHERE channel_name ILIKE $1
      AND timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
    GROUP BY sender_name
    ORDER BY message_count DESC
    LIMIT 5
  `, [`%${channel_name}%`]);

  // Recent messages
  const messagesResult = await pool.query(`
    SELECT
      message_id,
      content,
      sender_name,
      timestamp
    FROM teams.messages
    WHERE channel_name ILIKE $1
    ORDER BY timestamp DESC
    LIMIT 10
  `, [`%${channel_name}%`]);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          channel: channel_name,
          period: `Last ${days} days`,
          summary: {
            messageCount: parseInt(stats.message_count),
            uniqueSenders: parseInt(stats.unique_senders),
            firstMessage: stats.first_message,
            lastMessage: stats.last_message,
          },
          topSenders: sendersResult.rows.map(row => ({
            name: row.sender_name,
            messageCount: parseInt(row.message_count),
          })),
          recentMessages: messagesResult.rows.map(row => ({
            messageId: row.message_id,
            content: row.content.substring(0, 100) + (row.content.length > 100 ? '...' : ''),
            sender: row.sender_name,
            timestamp: row.timestamp,
          })),
        }, null, 2),
      },
    ],
  };
}

// Handler: Get Sender Activity
async function handleGetSenderActivity(args) {
  const { sender_name, days = 7 } = args;

  // Sender stats
  const statsResult = await pool.query(`
    SELECT
      COUNT(*) as message_count,
      COUNT(DISTINCT channel_name) as channels_active,
      MIN(timestamp) as first_message,
      MAX(timestamp) as last_message
    FROM teams.messages
    WHERE sender_name ILIKE $1
      AND timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
  `, [`%${sender_name}%`]);

  const stats = statsResult.rows[0];

  // Active channels
  const channelsResult = await pool.query(`
    SELECT
      channel_name,
      COUNT(*) as message_count
    FROM teams.messages
    WHERE sender_name ILIKE $1
      AND timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
    GROUP BY channel_name
    ORDER BY message_count DESC
    LIMIT 5
  `, [`%${sender_name}%`]);

  // Recent messages
  const messagesResult = await pool.query(`
    SELECT
      message_id,
      content,
      channel_name,
      timestamp
    FROM teams.messages
    WHERE sender_name ILIKE $1
    ORDER BY timestamp DESC
    LIMIT 10
  `, [`%${sender_name}%`]);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          sender: sender_name,
          period: `Last ${days} days`,
          summary: {
            messageCount: parseInt(stats.message_count),
            channelsActive: parseInt(stats.channels_active),
            firstMessage: stats.first_message,
            lastMessage: stats.last_message,
          },
          activeChannels: channelsResult.rows.map(row => ({
            channel: row.channel_name,
            messageCount: parseInt(row.message_count),
          })),
          recentMessages: messagesResult.rows.map(row => ({
            messageId: row.message_id,
            content: row.content.substring(0, 100) + (row.content.length > 100 ? '...' : ''),
            channel: row.channel_name,
            timestamp: row.timestamp,
          })),
        }, null, 2),
      },
    ],
  };
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Teams Extractor MCP Server running on stdio');
}

main().catch(console.error);
