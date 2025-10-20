const { OpenAI } = require('openai');

class TeamsJiraAIAgent {
  constructor(config) {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });
    this.jiraProjectKey = config.jiraProjectKey;
    this.contextMemory = [];
    this.maxMemorySize = 50;
  }

  async processMessage(messageData) {
    const context = this.buildContext(messageData);
    
    const analysis = await this.analyzeMessage(messageData.text, context);
    
    if (analysis.requiresAction) {
      const jiraData = await this.createJiraData(messageData, analysis);
      this.updateMemory(messageData, analysis);
      return jiraData;
    }
    
    return null;
  }

  buildContext(messageData) {
    const relevantMemory = this.contextMemory.filter(m => {
      const timeDiff = new Date() - new Date(m.timestamp);
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      return hoursDiff < 24 && 
             (m.sender === messageData.sender || 
              m.relatedTo?.includes(messageData.text));
    });
    
    return {
      channel: messageData.channel,
      recentMessages: relevantMemory.slice(-5),
      sender: messageData.sender
    };
  }

  async analyzeMessage(text, context) {
    const prompt = `
      Analyze the following Teams message and determine if it requires creating a Jira ticket.
      
      Message: "${text}"
      Sender: ${context.sender}
      Channel: ${context.channel}
      
      Context from recent messages:
      ${context.recentMessages.map(m => `- ${m.sender}: ${m.text}`).join('\n')}
      
      Keywords to look for:
      - "Güncellendi" or "Güncellenmiştir" = Update completed
      - "Yaygınlaştırıldı" or "Yaygınlaştırılmıştır" = Spread deployment completed
      - "Güncelleştirme" = Update request
      - "Yaygınlaştırma" = Spread deployment request
      
      Extract:
      1. Action type (completed_update, completed_spread, request_update, request_spread, none)
      2. System or application name
      3. Version number if mentioned
      4. Environment (prod, test, dev)
      5. Priority (low, medium, high, critical)
      6. Any dependencies or related systems
      7. Estimated completion time if mentioned
      8. Whether this is a follow-up to a previous request
      
      Return as JSON.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You are an expert at analyzing technical deployment messages and creating structured data for Jira tickets.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      analysis.requiresAction = analysis.action_type !== 'none';
      return analysis;
    } catch (error) {
      console.error('AI analysis error:', error);
      return this.fallbackAnalysis(text);
    }
  }

  fallbackAnalysis(text) {
    const analysis = {
      action_type: 'none',
      requiresAction: false,
      priority: 'medium'
    };

    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('güncellendi') || lowerText.includes('güncellenmiştir')) {
      analysis.action_type = 'completed_update';
      analysis.requiresAction = true;
      analysis.priority = 'low';
    } else if (lowerText.includes('yaygınlaştırıldı') || lowerText.includes('yaygınlaştırılmıştır')) {
      analysis.action_type = 'completed_spread';
      analysis.requiresAction = true;
      analysis.priority = 'low';
    } else if (lowerText.includes('güncelleştirme')) {
      analysis.action_type = 'request_update';
      analysis.requiresAction = true;
      analysis.priority = 'high';
    } else if (lowerText.includes('yaygınlaştırma')) {
      analysis.action_type = 'request_spread';
      analysis.requiresAction = true;
      analysis.priority = 'high';
    }

    return analysis;
  }

  async createJiraData(messageData, analysis) {
    const issueTypeMap = {
      'completed_update': 'Task',
      'completed_spread': 'Task',
      'request_update': 'Sub-task',
      'request_spread': 'Sub-task'
    };

    const actionDescriptions = {
      'completed_update': 'Update Completed',
      'completed_spread': 'Spread Deployment Completed',
      'request_update': 'Update Request',
      'request_spread': 'Spread Deployment Request'
    };

    const summary = this.generateSummary(messageData, analysis, actionDescriptions);
    const description = this.generateDescription(messageData, analysis);

    const jiraData = {
      project: { key: this.jiraProjectKey },
      issueType: { name: issueTypeMap[analysis.action_type] || 'Task' },
      summary: summary,
      description: description,
      priority: { name: this.mapPriority(analysis.priority) },
      labels: [
        'teams-automation',
        analysis.action_type,
        messageData.channel.replace(/\s+/g, '-')
      ],
      customFields: {}
    };

    if (analysis.system) {
      jiraData.components = [{ name: analysis.system }];
    }

    if (analysis.version) {
      jiraData.customFields.version = analysis.version;
    }

    if (analysis.environment) {
      jiraData.customFields.environment = analysis.environment;
    }

    if (analysis.estimated_completion) {
      jiraData.duedate = analysis.estimated_completion;
    }

    if (analysis.is_followup && this.contextMemory.length > 0) {
      const parentIssue = this.findParentIssue(messageData, analysis);
      if (parentIssue) {
        jiraData.parent = { key: parentIssue };
      }
    }

    return jiraData;
  }

  generateSummary(messageData, analysis, actionDescriptions) {
    let summary = `${actionDescriptions[analysis.action_type]} - ${messageData.sender}`;
    
    if (analysis.system) {
      summary += ` - ${analysis.system}`;
    }
    
    if (analysis.version) {
      summary += ` (v${analysis.version})`;
    }
    
    return summary.substring(0, 250);
  }

  generateDescription(messageData, analysis) {
    let description = `**Original Message:**\n${messageData.text}\n\n`;
    description += `**Sender:** ${messageData.sender}\n`;
    description += `**Channel:** ${messageData.channel}\n`;
    description += `**Timestamp:** ${messageData.timestamp}\n\n`;
    
    if (analysis.system) {
      description += `**System/Application:** ${analysis.system}\n`;
    }
    
    if (analysis.version) {
      description += `**Version:** ${analysis.version}\n`;
    }
    
    if (analysis.environment) {
      description += `**Environment:** ${analysis.environment}\n`;
    }
    
    if (analysis.dependencies) {
      description += `\n**Dependencies:**\n${analysis.dependencies.map(d => `- ${d}`).join('\n')}\n`;
    }
    
    if (analysis.additional_notes) {
      description += `\n**Additional Notes:**\n${analysis.additional_notes}\n`;
    }
    
    description += `\n---\n*This issue was automatically created from Microsoft Teams*`;
    
    return description;
  }

  mapPriority(priority) {
    const priorityMap = {
      'critical': 'Highest',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low',
      'trivial': 'Lowest'
    };
    return priorityMap[priority] || 'Medium';
  }

  findParentIssue(messageData, analysis) {
    for (let i = this.contextMemory.length - 1; i >= 0; i--) {
      const memory = this.contextMemory[i];
      if (memory.jiraIssue && 
          memory.system === analysis.system &&
          memory.action_type.includes('request')) {
        return memory.jiraIssue;
      }
    }
    return null;
  }

  updateMemory(messageData, analysis) {
    this.contextMemory.push({
      timestamp: messageData.timestamp,
      sender: messageData.sender,
      text: messageData.text,
      action_type: analysis.action_type,
      system: analysis.system,
      jiraIssue: analysis.jiraIssue
    });
    
    if (this.contextMemory.length > this.maxMemorySize) {
      this.contextMemory.shift();
    }
  }
}

module.exports = TeamsJiraAIAgent;