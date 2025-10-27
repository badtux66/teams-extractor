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

  // Teams DOM selectors (updated for 2025 Teams UI)
  const SELECTORS = {
    // More comprehensive selectors for different Teams views
    messageContainer: [
      '[data-tid="messageBodyContent"]',
      '[class*="message-body"]',
      '[role="log"]',
      '[role="list"][aria-label*="message"]',
      '.ts-message-list'
    ],
    messageItem: [
      '[role="listitem"]',
      '.ui-chat__item',
      '[data-tid="chat-pane-item"]',
      '[class*="message-item"]',
      '[id^="message-"]'
    ],
    messageText: [
      '[data-tid="messageBodyContent"]',
      '.ui-chat__messagecontent',
      '[class*="message-body-content"]',
      'p[class*="message"]',
      'div[class*="message-text"]'
    ],
    author: [
      '[data-tid="message-author-name"]',
      '.ui-chat__message__author',
      '[class*="author-name"]',
      '[aria-label*="said"]',
      'span[class*="author"]'
    ],
    timestamp: [
      'time',
      '[data-tid="message-timestamp"]',
      '[class*="timestamp"]',
      'span[class*="time"]'
    ],
    channel: [
      '[data-tid="channel-name"]',
      '.channel-header',
      'h2[class*="channel"]',
      '[role="heading"]'
    ],
    thread: [
      '[data-tid="message-thread"]',
      '[class*="thread"]'
    ],
  };

  /**
   * Query selector with multiple options
   */
  function querySelector(element, selectorArray) {
    if (typeof selectorArray === 'string') {
      return element.querySelector(selectorArray);
    }
    for (const selector of selectorArray) {
      const el = element.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  /**
   * Query all with multiple options
   */
  function querySelectorAll(element, selectorArray) {
    if (typeof selectorArray === 'string') {
      return element.querySelectorAll(selectorArray);
    }
    for (const selector of selectorArray) {
      const els = element.querySelectorAll(selector);
      if (els.length > 0) return els;
    }
    return [];
  }

  /**
   * Extract message data from DOM element
   */
  function extractMessageData(element) {
    try {
      const messageId = element.getAttribute('id') || generateId();
      const textElement = querySelector(element, SELECTORS.messageText);
      const authorElement = querySelector(element, SELECTORS.author);
      const timestampElement = querySelector(element, SELECTORS.timestamp);

      // Log extraction attempt for debugging
      console.log('Extracting message:', {
        hasText: !!textElement,
        hasAuthor: !!authorElement,
        hasTimestamp: !!timestampElement,
        text: textElement?.textContent.substring(0, 50),
        author: authorElement?.textContent
      });

      if (!textElement) {
        console.log('No text element found, trying alternate extraction');
        // Try to get text from any child elements
        const textContent = element.textContent.trim();
        if (textContent.length < 10) {
          return null; // Too short to be a real message
        }
      }

      if (!authorElement) {
        console.log('No author element found in message');
        // Some system messages don't have authors
      }

      const text = textElement ? textElement.textContent.trim() : element.textContent.trim();
      const author = authorElement ? authorElement.textContent.trim() : 'Unknown';

      // Skip empty or very short messages
      if (text.length < 5) {
        return null;
      }

      const message = {
        id: messageId,
        text: text,
        author: author,
        timestamp: timestampElement
          ? timestampElement.getAttribute('datetime') || timestampElement.textContent
          : new Date().toISOString(),
        channel: extractChannelName(),
        url: window.location.href,
        extractedAt: new Date().toISOString(),
        type: detectMessageType(element),
      };

      // Extract thread information if available
      const threadElement = element.closest(SELECTORS.thread.join(','));
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
      console.error('Error extracting message:', error, element);
      return null;
    }
  }

  /**
   * Extract channel/chat name from page
   */
  function extractChannelName() {
    const channelElement = querySelector(document, SELECTORS.channel);
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
      console.log('Extraction skipped:', { enabled: config.enabled, isExtracting });
      return;
    }

    isExtracting = true;
    const messages = [];

    try {
      // Find all message elements using flexible selectors
      const messageElements = querySelectorAll(document, SELECTORS.messageItem);

      console.log(`[Teams Extractor] Found ${messageElements.length} message elements`);
      console.log(`[Teams Extractor] Current URL: ${window.location.href}`);
      console.log(`[Teams Extractor] Channel: ${extractChannelName()}`);

      // If no messages found, log the page structure for debugging
      if (messageElements.length === 0) {
        console.warn('[Teams Extractor] No messages found! Debugging info:');
        console.log('- Document body classes:', document.body.className);
        console.log('- Role=listitem count:', document.querySelectorAll('[role="listitem"]').length);
        console.log('- Any divs with "message":', document.querySelectorAll('[class*="message"]').length);

        // Try to find any potential message containers
        const potentialContainers = document.querySelectorAll('[role="list"], [role="log"], [class*="message"]');
        console.log(`- Found ${potentialContainers.length} potential message containers`);
      }

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
        console.log(`[Teams Extractor] ✓ Extracted ${messages.length} new messages`);
        console.log('Sample message:', messages[0]);
        messageQueue.push(...messages);

        // Send batch if queue is large enough
        if (messageQueue.length >= config.batchSize) {
          sendMessages();
        }
      } else {
        console.log('[Teams Extractor] No new messages to extract');
      }
    } catch (error) {
      console.error('[Teams Extractor] Error extracting messages:', error);
    } finally {
      isExtracting = false;
    }
  }

  /**
   * Transform message to backend API format
   */
  function transformMessage(msg) {
    return {
      messageId: msg.id,
      channelId: msg.channelId || null,
      channelName: msg.channel || null,
      content: msg.text,
      sender: {
        id: msg.authorId || null,
        name: msg.author,
        email: msg.authorEmail || null
      },
      timestamp: msg.timestamp,
      url: msg.url,
      type: msg.type || 'message',
      threadId: msg.threadId || null,
      attachments: msg.attachments || [],
      reactions: msg.reactions || [],
      metadata: {
        extractedAt: msg.extractedAt,
        source: 'chrome-extension'
      }
    };
  }

  /**
   * Send messages to backend
   */
  async function sendMessages() {
    if (messageQueue.length === 0) {
      return;
    }

    const batch = messageQueue.splice(0, config.batchSize);

    // Transform messages to backend format
    const transformedMessages = batch.map(transformMessage);

    // Get or create extraction ID
    let extractionId = sessionStorage.getItem('extractionId');
    if (!extractionId) {
      extractionId = generateId();
      sessionStorage.setItem('extractionId', extractionId);
    }

    try {
      const response = await fetch(`${config.apiUrl}/messages/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: transformedMessages,
          extractionId: extractionId,
          metadata: {
            userAgent: navigator.userAgent,
            teamsUrl: window.location.href,
            timestamp: new Date().toISOString()
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Successfully sent ${batch.length} messages:`, result);

        // Notify background script
        chrome.runtime.sendMessage({
          type: 'MESSAGES_SENT',
          count: batch.length,
          inserted: result.inserted,
          duplicates: result.duplicates
        });
      } else {
        const errorText = await response.text();
        console.error('Failed to send messages:', response.statusText, errorText);
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
    console.log('[Teams Extractor] Initializing Teams Message Extractor v1.0.1');
    console.log('[Teams Extractor] URL:', window.location.href);

    let attempts = 0;
    const maxAttempts = 30;

    // Wait for Teams to load
    const checkTeamsLoaded = setInterval(() => {
      attempts++;
      const container = querySelector(document, SELECTORS.messageContainer);

      if (container) {
        clearInterval(checkTeamsLoaded);
        console.log('[Teams Extractor] ✓ Teams loaded, starting extraction');

        // Initial extraction
        setTimeout(() => extractVisibleMessages(), 2000); // Wait 2s for content to render

        // Setup observers and timers
        setupMutationObserver();
        setupPeriodicExtraction();

        notifyReady();
      } else {
        console.log(`[Teams Extractor] Waiting for Teams to load... (attempt ${attempts}/${maxAttempts})`);
        if (attempts >= maxAttempts) {
          clearInterval(checkTeamsLoaded);
          console.warn('[Teams Extractor] Timeout: Could not detect Teams messages container');
          console.warn('[Teams Extractor] Page may not be fully loaded or selectors need updating');

          // Still setup listeners in case Teams loads later
          setupMutationObserver();
          setupPeriodicExtraction();
          notifyReady();
        }
      }
    }, 1000);
  }

  function notifyReady() {
    chrome.runtime.sendMessage({ type: 'EXTRACTOR_READY' }, () => chrome.runtime.lastError);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
