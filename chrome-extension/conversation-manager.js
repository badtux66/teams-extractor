/**
 * Conversation Manager
 * Handles conversation detection, state persistence, and checkpoint tracking
 */

class ConversationManager {
  constructor() {
    this.currentConversation = null;
    this.extractedMessageIds = new Set();
    this.checkpoints = new Map();
    this.conversationCache = new Map();
    this.stateLoaded = false;

    // Conversation type detection patterns
    this.typePatterns = {
      channel: /\/channel\//i,
      chat: /\/conversations\//i,
      meeting: /\/meetup-join\//i,
      direct: /\/conversations\/[^/]+$/i
    };

    // Selectors for conversation metadata
    this.selectors = {
      conversationHeader: [
        '[data-tid="channel-name"]',
        '[data-tid="chat-pane-header-title"]',
        '[data-tid="chat-header-title"]',
        'h2[data-tid*="channel"]',
        'h1[data-tid*="channel"]'
      ],
      conversationId: [
        '[data-tid="channel-link"]',
        '[data-tid="conversation-link"]'
      ],
      teamName: [
        '[data-tid="team-name"]',
        '[data-tid="team-title"]'
      ],
      participants: [
        '[data-tid="participant"]',
        '[data-tid="member"]'
      ]
    };
  }

  /**
   * Initialize by loading saved state from storage
   */
  async initialize() {
    if (this.stateLoaded) return;

    try {
      const state = await this.loadState();
      if (state) {
        this.extractedMessageIds = new Set(state.extractedMessageIds || []);
        this.checkpoints = new Map(Object.entries(state.checkpoints || {}));
        console.log('[ConversationManager] Loaded state:', {
          extractedCount: this.extractedMessageIds.size,
          checkpointCount: this.checkpoints.size
        });
      }
      this.stateLoaded = true;
    } catch (error) {
      console.error('[ConversationManager] Failed to load state:', error);
    }
  }

  /**
   * Detect current conversation from page
   * @returns {Object|null} Conversation object or null
   */
  detectCurrentConversation() {
    const url = window.location.href;
    const type = this.detectConversationType(url);

    if (!type) {
      console.log('[ConversationManager] Not on a conversation page');
      return null;
    }

    const conversationId = this.extractConversationId(url, type);
    const conversationName = this.extractConversationName();

    if (!conversationId || !conversationName) {
      console.warn('[ConversationManager] Could not extract conversation info:', {
        id: conversationId,
        name: conversationName
      });
      return null;
    }

    const conversation = {
      id: conversationId,
      name: conversationName,
      type: type,
      teamId: this.extractTeamId(url),
      teamName: this.extractTeamName(),
      url: url,
      participants: this.extractParticipants(),
      metadata: {
        detectedAt: new Date().toISOString(),
        userAgent: navigator.userAgent
      }
    };

    // Cache conversation
    this.conversationCache.set(conversationId, conversation);
    this.currentConversation = conversation;

    console.log('[ConversationManager] Detected conversation:', conversation);
    return conversation;
  }

  /**
   * Detect conversation type from URL
   */
  detectConversationType(url) {
    // Check patterns in priority order
    if (this.typePatterns.meeting.test(url)) {
      return 'meeting';
    }
    if (this.typePatterns.direct.test(url)) {
      return 'direct';
    }
    if (this.typePatterns.channel.test(url)) {
      return 'channel';
    }
    if (this.typePatterns.chat.test(url)) {
      return 'chat';
    }
    return null;
  }

  /**
   * Extract conversation ID from URL
   */
  extractConversationId(url, type) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);

      // For channels: /channel/{channelId}/...
      if (type === 'channel') {
        const channelIndex = pathParts.indexOf('channel');
        if (channelIndex >= 0 && pathParts[channelIndex + 1]) {
          return pathParts[channelIndex + 1];
        }
      }

      // For chats/direct: /conversations/{conversationId}
      if (type === 'chat' || type === 'direct') {
        const convIndex = pathParts.indexOf('conversations');
        if (convIndex >= 0 && pathParts[convIndex + 1]) {
          return pathParts[convIndex + 1];
        }
      }

      // For meetings: extract from query params or path
      if (type === 'meeting') {
        const meetingId = urlObj.searchParams.get('meetingId');
        if (meetingId) return meetingId;

        // Try to find in path
        const meetupIndex = pathParts.indexOf('meetup-join');
        if (meetupIndex >= 0 && pathParts[meetupIndex + 1]) {
          return pathParts[meetupIndex + 1];
        }
      }

      // Fallback: use entire pathname as ID
      return pathParts.join('_');
    } catch (error) {
      console.error('[ConversationManager] Error extracting conversation ID:', error);
      return null;
    }
  }

  /**
   * Extract conversation name from page
   */
  extractConversationName() {
    for (const selector of this.selectors.conversationHeader) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();

        // Validate that this looks like a title
        const rect = element.getBoundingClientRect();
        const isInHeaderArea = rect.top < window.innerHeight * 0.25;
        const isReasonableLength = text.length > 0 && text.length < 150;

        if (isInHeaderArea && isReasonableLength) {
          return text;
        }
      }
    }

    // Fallback: extract from document title
    const title = document.title.split('|')[0].trim();
    if (title && title !== 'Microsoft Teams') {
      return title;
    }

    return 'Unknown Conversation';
  }

  /**
   * Extract team ID from URL
   */
  extractTeamId(url) {
    try {
      const match = url.match(/team\/([^/]+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract team name from page
   */
  extractTeamName() {
    for (const selector of this.selectors.teamName) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }
    return null;
  }

  /**
   * Extract participants (for chats/meetings)
   */
  extractParticipants() {
    const participants = [];

    for (const selector of this.selectors.participants) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const name = el.textContent.trim();
        if (name && !participants.includes(name)) {
          participants.push(name);
        }
      });
    }

    return participants;
  }

  /**
   * Collect possible identifiers for a message
   * @param {Object} message
   * @returns {string[]} identifiers
   */
  getMessageIdentifiers(message) {
    if (!message) return [];
    const candidates = [
      message.id,
      message.messageId,
      message.message_id,
      message.metadata?.messageId,
      message.metadata?.message_id
    ];

    return candidates
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0);
  }

  /**
   * Check if message matches the provided identifier
   */
  isMatchingMessageId(message, identifier) {
    if (!identifier) return false;
    const ids = this.getMessageIdentifiers(message);
    return ids.some((id) => id === identifier);
  }

  /**
   * Safely parse a timestamp-like value
   * @param {string|Date|null|undefined} value
   * @returns {number|null} Timestamp in ms
   */
  getTimestampMillis(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? null : time;
  }

  /**
   * Retrieve comparable timestamp info for a message
   * Falls back to extractedAt when message timestamp is not parsable
   * @param {Object} message
   * @returns {{millis:number, iso:string}|null}
   */
  getMessageTimeInfo(message) {
    if (!message) return null;
    const sources = ['timestamp', 'extractedAt', 'extracted_at'];
    for (const key of sources) {
      const millis = this.getTimestampMillis(message[key]);
      if (millis !== null) {
        return {
          millis,
          iso: new Date(millis).toISOString()
        };
      }
    }
    return null;
  }

  /**
   * Check if a message has already been extracted
   */
  isMessageExtracted(messageId) {
    return this.extractedMessageIds.has(messageId);
  }

  /**
   * Mark a message as extracted
   */
  markMessageExtracted(messageId) {
    this.extractedMessageIds.add(messageId);
  }

  /**
   * Get checkpoint for current conversation
   */
  getCheckpoint(conversationId = null) {
    const convId = conversationId || this.currentConversation?.id;
    if (!convId) return null;

    return this.checkpoints.get(convId) || {
      lastMessageId: null,
      lastTimestamp: null,
      lastExtractionTime: null,
      totalExtracted: 0
    };
  }

  /**
   * Update checkpoint after successful extraction
   */
  updateCheckpoint(conversationId, messages) {
    if (!conversationId || !messages || messages.length === 0) {
      return;
    }

    let latestInfo = null;
    let fallbackMessage = null;
    let identifierForCheckpoint = null;

    messages.forEach(message => {
      if (!fallbackMessage) {
        fallbackMessage = message;
      }
      const info = this.getMessageTimeInfo(message);
      const ids = this.getMessageIdentifiers(message);
      if (!identifierForCheckpoint && ids.length > 0) {
        identifierForCheckpoint = ids[0];
      }
      if (info && (!latestInfo || info.millis > latestInfo.millis)) {
        latestInfo = { ...info, message };
        if (ids.length > 0) {
          identifierForCheckpoint = ids[0];
        }
      }
    });

    const referenceMessage = latestInfo?.message || fallbackMessage;
    const referenceInfo = latestInfo || this.getMessageTimeInfo(referenceMessage);

    const checkpoint = {
      lastMessageId:
        identifierForCheckpoint ||
        this.getMessageIdentifiers(referenceMessage)[0] ||
        null,
      lastTimestamp: referenceInfo?.iso || new Date().toISOString(),
      lastExtractionTime: new Date().toISOString(),
      totalExtracted: (this.checkpoints.get(conversationId)?.totalExtracted || 0) + messages.length
    };

    this.checkpoints.set(conversationId, checkpoint);
    console.log('[ConversationManager] Updated checkpoint:', checkpoint);

    // Save state asynchronously
    this.saveState().catch(err =>
      console.error('[ConversationManager] Failed to save checkpoint:', err)
    );
  }

  /**
   * Filter messages to only new ones based on checkpoints
   */
  filterNewMessages(messages, conversationId = null) {
    const convId = conversationId || this.currentConversation?.id;
    if (!convId) return messages;

    const checkpoint = this.getCheckpoint(convId);
    if (!checkpoint.lastTimestamp && !checkpoint.lastMessageId) {
      // No checkpoint data, all messages are new
      return messages;
    }

    // First try ID-based filtering
    if (checkpoint.lastMessageId) {
      const idFiltered = [];
      let seenLast = false;

      messages.forEach((msg) => {
        if (!seenLast) {
          if (this.isMatchingMessageId(msg, checkpoint.lastMessageId)) {
            seenLast = true;
          }
          return;
        }
        idFiltered.push(msg);
      });

      if (seenLast) {
        console.log('[ConversationManager] Filtered messages by ID checkpoint:', {
          total: messages.length,
          new: idFiltered.length,
          lastMessageId: checkpoint.lastMessageId
        });
        return idFiltered;
      }
    }

    if (!checkpoint.lastTimestamp) {
      return messages;
    }

    const checkpointTime = this.getTimestampMillis(checkpoint.lastTimestamp);
    if (checkpointTime === null) {
      return messages;
    }

    const newMessages = messages.filter(msg => {
      const info = this.getMessageTimeInfo(msg);
      if (!info) {
        return true;
      }
      // Only include messages newer than checkpoint
      return info.millis > checkpointTime;
    });

    console.log('[ConversationManager] Filtered messages by timestamp:', {
      total: messages.length,
      new: newMessages.length,
      checkpoint: checkpoint.lastTimestamp
    });

    return newMessages;
  }

  /**
   * Load state from Chrome storage
   */
  async loadState() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['extractionState'], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.extractionState || null);
        }
      });
    });
  }

  /**
   * Save state to Chrome storage
   */
  async saveState() {
    const state = {
      extractedMessageIds: Array.from(this.extractedMessageIds),
      checkpoints: Object.fromEntries(this.checkpoints),
      lastSaved: new Date().toISOString(),
      version: '2.0'
    };

    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ extractionState: state }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log('[ConversationManager] State saved');
          resolve();
        }
      });
    });
  }

  /**
   * Clear state (for reset/debugging)
   */
  async clearState() {
    this.extractedMessageIds.clear();
    this.checkpoints.clear();
    this.conversationCache.clear();
    this.currentConversation = null;

    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(['extractionState'], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          console.log('[ConversationManager] State cleared');
          resolve();
        }
      });
    });
  }

  /**
   * Get statistics about extracted messages
   */
  getStats() {
    const totalCheckpoints = this.checkpoints.size;
    const totalExtracted = Array.from(this.checkpoints.values())
      .reduce((sum, cp) => sum + (cp.totalExtracted || 0), 0);

    return {
      totalExtractedMessages: this.extractedMessageIds.size,
      totalConversations: totalCheckpoints,
      totalFromCheckpoints: totalExtracted,
      currentConversation: this.currentConversation?.name || null,
      checkpoints: Object.fromEntries(this.checkpoints)
    };
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConversationManager;
}
