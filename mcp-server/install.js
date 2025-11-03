#!/usr/bin/env node

/**
 * Automated installation script for Claude Desktop MCP extension
 * This script is called by Claude Desktop during extension installation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import readline from 'readline';
import pg from 'pg';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Utility functions
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}━━━ ${msg} ━━━${colors.reset}`),
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

// Detect OS and get config path
function getClaudeConfigPath() {
  const platform = process.platform;
  const homeDir = os.homedir();

  let configDir;
  if (platform === 'darwin') {
    configDir = path.join(homeDir, 'Library', 'Application Support', 'Claude');
  } else if (platform === 'win32') {
    configDir = path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Claude');
  } else {
    configDir = path.join(homeDir, '.config', 'Claude');
  }

  return path.join(configDir, 'claude_desktop_config.json');
}

// Test database connection
async function testDatabaseConnection(dbUrl) {
  const pool = new pg.Pool({ connectionString: dbUrl });
  try {
    await pool.query('SELECT 1');
    await pool.end();
    return true;
  } catch (error) {
    await pool.end();
    throw error;
  }
}

// Check if Docker is running
function isDockerRunning() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Check if Teams Extractor containers are running
function checkTeamsExtractorContainers() {
  try {
    const result = execSync('docker ps --format "table {{.Names}}" | grep -E "teams-extractor-(db|redis|backend|frontend)"', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// Main installation function
async function install() {
  console.log(`
${colors.magenta}╔══════════════════════════════════════════════════════╗
║     Teams Message Extractor MCP Server Setup        ║
║           for Claude Desktop Installation           ║
╚══════════════════════════════════════════════════════╝${colors.reset}
`);

  try {
    // Step 1: Check Node.js version
    log.section('Checking Requirements');
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

    if (majorVersion < 18) {
      log.error(`Node.js 18+ required (found ${nodeVersion})`);
      process.exit(1);
    }
    log.success(`Node.js ${nodeVersion} detected`);

    // Step 2: Check Docker status
    const dockerRunning = isDockerRunning();
    if (!dockerRunning) {
      log.warning('Docker is not running');
      log.info('Please ensure Docker Desktop is running and the Teams Extractor containers are started');
      log.info('Run: docker-compose up -d');
    } else {
      log.success('Docker is running');

      // Check for Teams Extractor containers
      const containers = checkTeamsExtractorContainers();
      if (containers.length === 0) {
        log.warning('Teams Extractor containers are not running');
        log.info('Start them with: docker-compose up -d');
      } else {
        log.success(`Found ${containers.length} Teams Extractor containers running`);
        containers.forEach(c => log.info(`  - ${c}`));
      }
    }

    // Step 3: Database configuration
    log.section('Database Configuration');

    // Try to read from .env file first
    let databaseUrl = process.env.MCP_DATABASE_URL;

    if (!databaseUrl) {
      const envPath = path.join(__dirname, '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/MCP_DATABASE_URL=(.+)/);
        if (match) {
          databaseUrl = match[1];
          log.info('Found database URL in .env file');
        }
      }
    }

    // If no URL found, provide default or prompt
    if (!databaseUrl) {
      log.info('No existing database configuration found');
      console.log('\nDatabase URL format: postgresql://username:password@host:port/database');
      console.log('Default (Docker): postgresql://teams_admin:teams_password@localhost:5432/teams_extractor');
      console.log('');

      const input = await question('Enter database URL (or press Enter for default): ');
      databaseUrl = input.trim() || 'postgresql://teams_admin:teams_password@localhost:5432/teams_extractor';
    }

    // Test connection
    log.info('Testing database connection...');
    try {
      await testDatabaseConnection(databaseUrl);
      log.success('Database connection successful');
    } catch (error) {
      log.error(`Database connection failed: ${error.message}`);
      log.info('Please check:');
      log.info('  1. PostgreSQL is running (docker-compose up -d)');
      log.info('  2. Database credentials are correct');
      log.info('  3. Database "teams_extractor" exists');

      const retry = await question('Retry with different URL? (y/n): ');
      if (retry.toLowerCase() === 'y') {
        rl.close();
        return install(); // Recursive retry
      } else {
        process.exit(1);
      }
    }

    // Step 4: Configure Claude Desktop
    log.section('Configuring Claude Desktop');

    const configPath = getClaudeConfigPath();
    const configDir = path.dirname(configPath);

    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      log.info(`Created config directory: ${configDir}`);
    }

    // Backup existing config
    if (fs.existsSync(configPath)) {
      const backupPath = `${configPath}.backup.${Date.now()}`;
      fs.copyFileSync(configPath, backupPath);
      log.info(`Backed up existing config to: ${path.basename(backupPath)}`);
    }

    // Create MCP server configuration
    const config = {
      mcpServers: {
        'teams-extractor': {
          command: 'node',
          args: [path.join(__dirname, 'index.js')],
          env: {
            MCP_DATABASE_URL: databaseUrl
          }
        }
      }
    };

    // Write configuration
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    log.success(`Configuration written to: ${configPath}`);

    // Step 5: Create .env file for local development
    const envPath = path.join(__dirname, '.env');
    const envContent = `# Teams Extractor MCP Server Configuration
# Generated by install script

# Database connection URL
MCP_DATABASE_URL=${databaseUrl}

# Optional: Maximum results per query
# MAX_RESULTS=50

# Optional: Query timeout (milliseconds)
# QUERY_TIMEOUT=30000
`;

    fs.writeFileSync(envPath, envContent);
    log.success('Created .env file for local configuration');

    // Step 6: Final instructions
    log.section('Installation Complete!');

    console.log(`
${colors.green}✨ Teams Message Extractor MCP Server is ready!${colors.reset}

${colors.cyan}Next Steps:${colors.reset}
1. Restart Claude Desktop
2. Look for the 🔨 icon in Claude Desktop
3. You should see "teams-extractor" in the MCP tools list

${colors.cyan}Available Tools:${colors.reset}
• list_messages    - List Teams messages with filtering
• search_messages  - Full-text search in messages
• get_statistics   - Get message statistics
• get_message      - Get specific message details
• get_channel_summary - Summarize channel activity
• get_sender_activity - Analyze sender patterns

${colors.cyan}Example Prompts:${colors.reset}
• "Show me the latest 10 Teams messages"
• "Search for messages about 'project deadline'"
• "What are the message statistics for the last week?"
• "Summarize activity in the Engineering channel"

${colors.cyan}Troubleshooting:${colors.reset}
• If tools don't appear, restart Claude Desktop
• Check Chrome extension is extracting messages
• Verify Docker containers are running: docker ps
• View logs: docker-compose logs -f

${colors.blue}Configuration saved to:${colors.reset} ${configPath}
`);

  } catch (error) {
    log.error(`Installation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run installation
install().catch(console.error);