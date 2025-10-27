// Teams Message Extractor - Content Script
// Runs on teams.microsoft.com to extract messages

(function() {
  'use strict';

  console.log('Teams Message Extractor loaded');

  // Configuration
  let config = {
    apiUrl: 'http://localhost:5000/api',
    enabled: true,
    batchSize: 50,
    extractInterval: 5000, // 5 seconds
  };

  // Load config from storage
  chrome.storage.sync.get(['apiUrl', 'enabled'], (result) => {
    if (result.apiUrl) config.apiUrl = result.apiUrl;
    if (result.enabled !== undefined) config.enabled = result.enabled;
  });

  // Message queue
  let messageQueue = [];
  let lastExtractTime = Date.now();
  let isExtracting = false;

  // Teams DOM selectors (may need updates as Teams changes)
  const SELECTORS = {
    messageContainer: '[data-tid="messageBodyContent"]',
    messageItem: '.ui-chat__item, [role="listitem"]',
    messageText: '.ui-chat__messagecontent, [data-tid="messageBodyContent"]',
    author: '[data-tid="message-author-name"], .ui-chat__message__author',
    timestamp: 'time, [data-tid="message-timestamp"]',
    channel: '[data-tid="channel-name"], .channel-header',
    thread: '[data-tid="message-thread"]',
  };

  /**
   * Extract message data from DOM element
   */
  function extractMessageData(element) {
    try {
      const messageId = element.getAttribute('id') || generateId();
      const textElement = element.querySelector(SELECTORS.messageText);
      const authorElement = element.querySelector(SELECTORS.author);
      const timestampElement = element.querySelector(SELECTORS.timestamp);

      if (!textElement || !authorElement) {
        return null;
      }

      const message = {
        id: messageId,
        text: textElement.textContent.trim(),
        author: authorElement.textContent.trim(),
        timestamp: timestampElement
          ? timestampElement.getAttribute('datetime') || timestampElement.textContent
          : new Date().toISOString(),
        channel: extractChannelName(),
        url: window.location.href,
        extractedAt: new Date().toISOString(),
        type: detectMessageType(element),
      };

      // Extract thread information if available
      const threadElement = element.closest(SELECTORS.thread);
      if (threadElement) {
        message.threadId = threadElement.getAttribute('data-tid') || null;
      }

      // Extract reactions if present
      const reactions = extractReactions(element);
      if (reactions.length > 0) {
        message.reactions = reactions;
      }

      return message;
    } catch (error) {
      console.error('Error extracting message:', error);
      return null;
    }
  }

  /**
   * Extract channel/chat name from page
   */
  function extractChannelName() {
    const channelElement = document.querySelector(SELECTORS.channel);
    return channelElement ? channelElement.textContent.trim() : 'Unknown';
  }

  /**
   * Detect message type (regular, reply, system, etc.)
   */
  function detectMessageType(element) {
    if (element.querySelector('[data-tid="system-message"]')) {
      return 'system';
    }
    if (element.closest('[data-tid="message-thread"]')) {
      return 'reply';
    }
    return 'message';
  }

  /**
   * Extract reactions from message
   */
  function extractReactions(element) {
    const reactions = [];
    const reactionElements = element.querySelectorAll('[data-tid="message-reaction"]');

    reactionElements.forEach(el => {
      reactions.push({
        emoji: el.textContent.trim(),
        count: parseInt(el.getAttribute('data-count') || '1')
      });
    });

    return reactions;
  }

  /**
   * Generate unique ID for messages without one
   */
  function generateId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract all visible messages from current view
   */
  function extractVisibleMessages() {
    if (!config.enabled || isExtracting) {
      return;
    }

    isExtracting = true;
    const messages = [];

    try {
      // Find all message elements
      const messageElements = document.querySelectorAll(SELECTORS.messageItem);

      console.log(`Found ${messageElements.length} message elements`);

      messageElements.forEach(element => {
        // Skip if already processed (check data attribute)
        if (element.getAttribute('data-extracted') === 'true') {
          return;
        }

        const message = extractMessageData(element);
        if (message) {
          messages.push(message);
          element.setAttribute('data-extracted', 'true');
        }
      });

      if (messages.length > 0) {
        console.log(`Extracted ${messages.length} new messages`);
        messageQueue.push(...messages);

        // Send batch if queue is large enough
        if (messageQueue.length >= config.batchSize) {
          sendMessages();
        }
      }
    } catch (error) {
      console.error('Error extracting messages:', error);
    } finally {
      isExtracting = false;
    }
  }

  /**
   * Send messages to backend
   */
  async function sendMessages() {
    if (messageQueue.length === 0) {
      return;
    }

    const batch = messageQueue.splice(0, config.batchSize);

    try {
      const response = await fetch(`${config.apiUrl}/messages/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: batch }),
      });

      if (response.ok) {
        console.log(`Successfully sent ${batch.length} messages`);

        // Notify background script
        chrome.runtime.sendMessage({
          type: 'MESSAGES_SENT',
          count: batch.length
        });
      } else {
        console.error('Failed to send messages:', response.statusText);
        // Re-add to queue for retry
        messageQueue.unshift(...batch);
      }
    } catch (error) {
      console.error('Error sending messages:', error);
      // Re-add to queue for retry
      messageQueue.unshift(...batch);
    }
  }

  /**
   * Observe DOM changes for new messages
   */
  function setupMutationObserver() {
    const targetNode = document.body;
    const config = { childList: true, subtree: true };

    const observer = new MutationObserver((mutations) => {
      // Debounce: only extract after mutations stop for 1 second
      clearTimeout(window.extractTimeout);
      window.extractTimeout = setTimeout(() => {
        extractVisibleMessages();
      }, 1000);
    });

    observer.observe(targetNode, config);
    console.log('Mutation observer started');
  }

  /**
   * Setup periodic extraction
   */
  function setupPeriodicExtraction() {
    setInterval(() => {
      extractVisibleMessages();

      // Send any queued messages
      if (messageQueue.length > 0) {
        sendMessages();
      }
    }, config.extractInterval);
  }

  /**
   * Listen for messages from extension
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_NOW') {
      extractVisibleMessages();
      sendMessages();
      sendResponse({ success: true });
    } else if (message.type === 'GET_STATUS') {
      sendResponse({
        queueSize: messageQueue.length,
        enabled: config.enabled,
        channel: extractChannelName()
      });
    } else if (message.type === 'UPDATE_CONFIG') {
      config = { ...config, ...message.config };
      sendResponse({ success: true });
    }
    return true;
  });

  /**
   * Initialize extraction
   */
  function initialize() {
    console.log('Initializing Teams Message Extractor');

    // Wait for Teams to load
    const checkTeamsLoaded = setInterval(() => {
      if (document.querySelector(SELECTORS.messageContainer)) {
        clearInterval(checkTeamsLoaded);
        console.log('Teams loaded, starting extraction');

        // Initial extraction
        extractVisibleMessages();

        // Setup observers and timers
        setupMutationObserver();
        setupPeriodicExtraction();

        // Notify background script
        chrome.runtime.sendMessage({ type: 'EXTRACTOR_READY' });
      }
    }, 1000);

    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(checkTeamsLoaded);
    }, 30000);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
