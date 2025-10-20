const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const TeamsJiraAIAgent = require('./ai-agent.js');
const fetch = require('node-fetch');

class TeamsJiraMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'teams-jira-automation',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );
    
    this.aiAgent = null;
    this.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'process_teams_message',
          description: 'Process a Teams message and create Jira ticket if needed',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Message text' },
              sender: { type: 'string', description: 'Message sender' },
              channel: { type: 'string', description: 'Teams channel' },
              timestamp: { type: 'string', description: 'Message timestamp' },
            },
            required: ['text', 'sender'],
          },
        },
        {
          name: 'configure_automation',
          description: 'Configure the automation settings',
          inputSchema: {
            type: 'object',
            properties: {
              n8nWebhookUrl: { type: 'string', description: 'n8n webhook URL' },
              jiraProjectKey: { type: 'string', description: 'Jira project key' },
              openaiApiKey: { type: 'string', description: 'OpenAI API key' },
            },
          },
        },
        {
          name: 'get_automation_status',
          description: 'Get current automation status and statistics',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'test_jira_connection',
          description: 'Test Jira connection through n8n',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'process_teams_message':
          return await this.processTeamsMessage(args);
        
        case 'configure_automation':
          return await this.configureAutomation(args);
        
        case 'get_automation_status':
          return await this.getAutomationStatus();
        
        case 'test_jira_connection':
          return await this.testJiraConnection();
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    this.server.setRequestHandler('resources/list', async () => ({
      resources: [
        {
          uri: 'teams://messages/processed',
          name: 'Processed Messages',
          description: 'List of processed Teams messages',
          mimeType: 'application/json',
        },
        {
          uri: 'jira://tickets/created',
          name: 'Created Jira Tickets',
          description: 'List of Jira tickets created from Teams messages',
          mimeType: 'application/json',
        },
      ],
    }));

    this.server.setRequestHandler('resources/read', async (request) => {
      const { uri } = request.params;

      if (uri === 'teams://messages/processed') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(this.getProcessedMessages(), null, 2),
            },
          ],
        };
      }

      if (uri === 'jira://tickets/created') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(this.getCreatedTickets(), null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    });
  }

  async processTeamsMessage(args) {
    try {
      if (!this.aiAgent) {
        throw new Error('AI Agent not configured. Please run configure_automation first.');
      }

      const messageData = {
        text: args.text,
        sender: args.sender,
        channel: args.channel || 'Güncelleme Planlama',
        timestamp: args.timestamp || new Date().toISOString(),
        messageId: `msg-${Date.now()}`,
      };

      const jiraData = await this.aiAgent.processMessage(messageData);

      if (jiraData) {
        const response = await fetch(this.n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...messageData,
            jiraData,
            processedBy: 'mcp-server',
          }),
        });

        const result = await response.json();

        this.storeProcessedMessage(messageData, jiraData, result);

        return {
          content: [
            {
              type: 'text',
              text: `Successfully processed message and created Jira ticket: ${result.jiraIssue?.key || 'Unknown'}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: 'Message analyzed but no Jira ticket needed based on content.',
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error processing message: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async configureAutomation(args) {
    try {
      if (args.n8nWebhookUrl) {
        this.n8nWebhookUrl = args.n8nWebhookUrl;
      }

      if (args.openaiApiKey && args.jiraProjectKey) {
        this.aiAgent = new TeamsJiraAIAgent({
          openaiApiKey: args.openaiApiKey,
          jiraProjectKey: args.jiraProjectKey,
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: 'Automation configured successfully.',
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Configuration error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getAutomationStatus() {
    const status = {
      configured: this.aiAgent !== null,
      n8nWebhookUrl: this.n8nWebhookUrl ? 'Configured' : 'Not configured',
      aiAgent: this.aiAgent ? 'Active' : 'Inactive',
      processedMessages: this.getProcessedMessages().length,
      createdTickets: this.getCreatedTickets().length,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }

  async testJiraConnection() {
    try {
      const testMessage = {
        text: 'Test message for Jira connection',
        sender: 'MCP Test',
        channel: 'Test Channel',
        timestamp: new Date().toISOString(),
        test: true,
      };

      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testMessage),
      });

      if (response.ok) {
        return {
          content: [
            {
              type: 'text',
              text: 'Jira connection test successful!',
            },
          ],
        };
      } else {
        throw new Error(`Connection failed: ${response.status}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Connection test failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  storeProcessedMessage(messageData, jiraData, result) {
    if (!this.processedMessages) {
      this.processedMessages = [];
    }
    this.processedMessages.push({
      ...messageData,
      jiraData,
      result,
      processedAt: new Date().toISOString(),
    });
  }

  getProcessedMessages() {
    return this.processedMessages || [];
  }

  getCreatedTickets() {
    if (!this.processedMessages) return [];
    return this.processedMessages
      .filter(m => m.result?.jiraIssue)
      .map(m => ({
        key: m.result.jiraIssue.key,
        summary: m.jiraData?.summary,
        createdAt: m.processedAt,
        fromMessage: m.text,
      }));
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Teams-Jira MCP Server running...');
  }
}

const server = new TeamsJiraMCPServer();
server.run().catch(console.error);