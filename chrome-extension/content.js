// Teams Message Extractor - Content Script
// Runs on teams.microsoft.com to extract messages

(function () {
  'use strict';

  console.log('Teams Message Extractor loaded');

  // Configuration
  let config = {
    apiUrl: 'http://localhost:5000/api',
    enabled: true,
    batchSize: 50,
    extractInterval: 5000, // milliseconds
    apiKey: '',
  };

  function normalizeInterval(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return fallback;
    }
    return numeric >= 1000 ? numeric : numeric * 1000;
  }

  function applyConfigUpdate(update = {}) {
    if (!update || typeof update !== 'object') {
      return;
    }

    if (typeof update.apiUrl === 'string' && update.apiUrl.trim()) {
      config.apiUrl = update.apiUrl.trim();
    }
    if (typeof update.enabled === 'boolean') {
      config.enabled = update.enabled;
    }
    if (update.batchSize !== undefined) {
      const numeric = Number(update.batchSize);
      if (Number.isFinite(numeric) && numeric > 0) {
        config.batchSize = numeric;
      }
    }
    if (update.extractInterval !== undefined) {
      config.extractInterval = normalizeInterval(update.extractInterval, config.extractInterval);
    }
    if (typeof update.apiKey === 'string') {
      config.apiKey = update.apiKey;
    }
  }

  // Load config from storage
  chrome.storage.sync.get(
    ['apiUrl', 'enabled', 'batchSize', 'extractInterval', 'apiKey'],
    (result) => applyConfigUpdate(result)
  );

  // Message queue
  let messageQueue = [];
  let lastExtractTime = Date.now();
  let isExtracting = false;
  let isSending = false;
  let retryCount = 0;
  let maxRetries = 5;
  let retryDelay = 1000; // Start with 1 second
  let extractedMessagesCount = 0;

  // Conversation tracking
  const conversationManager =
    typeof ConversationManager === 'function' ? new ConversationManager() : null;
  let currentConversationId = null;

  if (conversationManager) {
    conversationManager
      .initialize()
      .then(() => console.log('[Teams Extractor] Conversation manager initialized'))
      .catch((err) =>
        console.error('[Teams Extractor] Failed to initialize conversation manager:', err)
      );

    if (typeof window !== 'undefined') {
      window.conversationManager = conversationManager;
    }
  } else {
    console.warn('[Teams Extractor] ConversationManager not available - dedup enhancements disabled');
  }

  // Teams DOM selectors (updated for 2025 Teams UI)
  const SELECTORS = {
    // More comprehensive selectors for different Teams views
    messageContainer: [
      '[data-tid="messageBodyContent"]',
      '[class*="message-body"]',
      '[role="log"]',
      '[role="list"][aria-label*="message"]',
      '.ts-message-list',
      'div[role="list"]'
    ],
    messageItem: [
      '[role="listitem"]',
      '.ui-chat__item',
      '[data-tid="chat-pane-item"]',
      '[class*="message-item"]',
      '[id^="message-"]',
      'div[role="listitem"]'
    ],
    messageText: [
      '[data-tid="messageBodyContent"]',
      '.ui-chat__messagecontent',
      '[class*="message-body-content"]',
      'p[class*="message"]',
      'div[class*="message-text"]',
      'div[data-tid="message-body"]'
    ],
    author: [
      '[data-tid="message-author-name"]',
      '.ui-chat__message__author',
      '[class*="author-name"]',
      '[aria-label*="said"]',
      'span[class*="author"]',
      'div[data-tid="message-author"]'
    ],
    timestamp: [
      'time',
      '[data-tid="message-timestamp"]',
      '[class*="timestamp"]',
      'span[class*="time"]',
      'div[data-tid="message-timestamp"]'
    ],
    channel: [
      '[data-tid="channel-name"]',
      '[data-tid="chat-pane-header-title"]',
      '[data-tid="chat-header-title"]',
      'h2[data-tid*="channel"]',
      'h1[data-tid*="channel"]',
      '.channel-header h2',
      '.channel-header h1',
      'h2[class*="channel-name"]',
      'h1[class*="channel-name"]',
      '[role="heading"][data-tid*="channel"]',
      '[data-tid="header-title"]'
    ],
    thread: [
      '[data-tid="message-thread"]',
      '[class*="thread"]'
    ],
  };

  /**
   * Send a message to the background service worker without surfacing no-listener errors.
   */
  function safeSendMessage(message) {
    chrome.runtime.sendMessage(message, () => chrome.runtime.lastError);
  }

  /**
   * Ask the background service worker to deliver a batch to the backend.
   */
  function dispatchBatchToBackground(batchPayload) {
    const MAX_RETRIES = 3;
    const payload = {
      ...batchPayload,
      apiUrl: config.apiUrl,
      apiKey: config.apiKey
    };

    return new Promise((resolve, reject) => {
      const send = (attempt) => {
        chrome.runtime.sendMessage(
          {
            type: 'SEND_BATCH',
            payload: payload
          },
          (response) => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
              const message = lastError.message || '';
              const transient =
                /Receiving end does not exist|context invalidated|message port closed/i.test(
                  message
                );
              if (transient && attempt < MAX_RETRIES) {
                const delay = 200 * (attempt + 1);
                console.warn(
                  `[Teams Extractor] Background unavailable (attempt ${attempt + 1}). Retrying in ${delay}ms`
                );
                setTimeout(() => send(attempt + 1), delay);
                return;
              }
              console.error('sendMessage failed:', lastError);
              reject(new Error(message || 'Background unavailable'));
              return;
            }

            if (!response) {
              if (attempt < MAX_RETRIES) {
                const delay = 200 * (attempt + 1);
                console.warn(
                  `[Teams Extractor] No response from background (attempt ${attempt + 1}). Retrying in ${delay}ms`
                );
                setTimeout(() => send(attempt + 1), delay);
                return;
              }
              const error = new Error('No response from background script. Is it running?');
              error.isNetworkError = true;
              reject(error);
              return;
            }

            if (!response.success) {
              const error = new Error(response?.error || 'Unknown error sending batch');
              if (response?.status) {
                error.status = response.status;
              }
              if (response?.details) {
                error.details = response.details;
              }
              if (response?.network) {
                error.isNetworkError = true;
              }
              reject(error);
              return;
            }

            resolve(response.result);
          }
        );
      };

      send(0);
    });
  }

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
   * Extract channel ID from URL
   */
  function extractChannelId() {
    // Try to extract from URL
    // Teams URLs often have format: /channel/<channel-id>/<channel-name>
    const urlMatch = window.location.pathname.match(/\/channel\/([^/]+)\//);
    if (urlMatch) {
      return decodeURIComponent(urlMatch[1]);
    }

    // Check for chat/conversation ID
    const chatMatch = window.location.pathname.match(/\/conversations\/([^/?]+)/);
    if (chatMatch) {
      return chatMatch[1];
    }

    return null;
  }

  /**
   * Generate a stable ID based on message content
   */
  function generateStableId(text, author, timestamp) {
    const str = `${text}|${author}|${timestamp}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `gen_${Math.abs(hash)}`;
  }

  /**
   * Generate unique ID for messages without one
   */
  function generateId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract message data from DOM element
   */
  function extractMessageData(element) {
    try {
      const textElement = querySelector(element, SELECTORS.messageText);
      const authorElement = querySelector(element, SELECTORS.author);
      const timestampElement = querySelector(element, SELECTORS.timestamp);

      if (!textElement) {
        // Try to get text from any child elements
        const textContent = element.textContent.trim();
        if (textContent.length < 1) { // Allow short messages like "Ok"
          return null;
        }
      }

      const text = textElement ? textElement.textContent.trim() : element.textContent.trim();
      const author = authorElement ? authorElement.textContent.trim() : 'Unknown';
      const timestamp = timestampElement
        ? timestampElement.getAttribute('datetime') || timestampElement.getAttribute('title') || timestampElement.textContent
        : new Date().toISOString();

      // Skip empty messages
      if (text.length === 0) {
        return null;
      }

      // Use DOM ID if available, otherwise generate stable ID
      let messageId = element.getAttribute('id');
      if (!messageId) {
        messageId = generateStableId(text, author, timestamp);
      }

      const message = {
        id: messageId,
        text: text,
        author: author,
        timestamp: timestamp,
        channel: extractChannelName(),
        channelId: extractChannelId(),
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
    // Try to find channel name with specific selectors
    const channelElement = querySelector(document, SELECTORS.channel);

    if (channelElement) {
      const text = channelElement.textContent.trim();

      // Validate that this looks like a channel name, not message content
      // Channel names are typically:
      // - Shorter (< 100 chars)
      // - Don't contain "kullanıcısından" (from user) or similar phrases
      // - Don't look like dates
      // - Are in the header area (top 25% of viewport)

      const rect = channelElement.getBoundingClientRect();
      const isInHeaderArea = rect.top < window.innerHeight * 0.25;
      const looksLikeMessage = text.includes('kullanıcısından') || text.length > 100;
      const looksLikeDate = /^\d{1,2}\s+\w+\s+\w+$/.test(text); // e.g., "23 Temmuz Çarşamba"

      if (isInHeaderArea && !looksLikeMessage && !looksLikeDate) {
        // console.log('[Teams Extractor] Found channel name:', text);
        return text;
      } else {
        // console.warn('[Teams Extractor] Rejected potential channel name:', {
        //   text: text.substring(0, 50),
        //   isInHeaderArea,
        //   looksLikeMessage,
        //   looksLikeDate
        // });
      }
    }

    // Fallback: try to extract from URL
    // Teams URLs often have format: /channel/<channel-id>/<channel-name>
    // or /conversations/<conversation-id>?ctx=chat
    const urlMatch = window.location.pathname.match(/\/channel\/[^/]+\/([^/]+)/);
    if (urlMatch) {
      const nameFromUrl = decodeURIComponent(urlMatch[1]).replace(/-/g, ' ');
      // console.log('[Teams Extractor] Extracted channel name from URL:', nameFromUrl);
      return nameFromUrl;
    }

    // Check for chat context
    if (window.location.href.includes('/conversations/')) {
      // Try to find chat title from document title or specific chat header
      const chatTitle = document.title.split('|')[0].trim();
      if (chatTitle && chatTitle !== 'Microsoft Teams') {
        return chatTitle;
      }
    }

    // console.warn('[Teams Extractor] Could not determine channel name, using "Unknown"');
    return 'Unknown';
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
      let conversation = null;
      if (conversationManager) {
        conversation = conversationManager.detectCurrentConversation();
        currentConversationId = conversation?.id || null;
      }

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
          let isDuplicate = false;

          if (conversationManager && message.id) {
            isDuplicate = conversationManager.isMessageExtracted(message.id);
          }

          if (isDuplicate) {
            console.log(`[Teams Extractor] Skipping duplicate message: ${message.id}`);
            element.setAttribute('data-extracted', 'true');
            return;
          }

          if (conversationManager && message.id) {
            conversationManager.markMessageExtracted(message.id);
          }

          messages.push(message);
          element.setAttribute('data-extracted', 'true');
        }
      });

      let filteredMessages = messages;
      if (conversationManager && currentConversationId) {
        const candidateMessages = conversationManager.filterNewMessages(
          messages,
          currentConversationId
        );
        if (candidateMessages.length === 0 && messages.length > 0) {
          console.warn(
            '[Teams Extractor] Checkpoint filtering removed all messages, falling back to raw batch'
          );
          filteredMessages = messages;
        } else {
          filteredMessages = candidateMessages;
        }
      }

      if (filteredMessages.length > 0) {
        const filteredInfo =
          filteredMessages.length !== messages.length
            ? ` (filtered from ${messages.length})`
            : '';
        console.log(
          `[Teams Extractor] ✓ Extracted ${filteredMessages.length} new messages${filteredInfo}`
        );
        console.log('Sample message:', filteredMessages[0]);
        messageQueue.push(...filteredMessages);

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
   * Send messages to backend with retry logic
   */
  async function sendMessages() {
    if (messageQueue.length === 0 || isSending) {
      return;
    }

    isSending = true;
    const batch = messageQueue.splice(0, config.batchSize);
    const conversation = conversationManager?.currentConversation || null;

    console.log(`[Teams Extractor] Attempting to send ${batch.length} messages to backend...`);

    // Transform messages to backend format
    const transformedMessages = batch.map(transformMessage);

    // Get or create extraction ID
    let extractionId = sessionStorage.getItem('extractionId');
    if (!extractionId) {
      extractionId = generateId();
      sessionStorage.setItem('extractionId', extractionId);
    }

    try {
      const result = await dispatchBatchToBackground({
        messages: transformedMessages,
        extractionId,
        conversationId: conversation?.id || extractChannelId() || null,
        conversationName: conversation?.name || extractChannelName(),
        conversationType: conversation?.type || 'channel',
        teamId: conversation?.teamId || null,
        teamName: conversation?.teamName || null,
        metadata: {
          userAgent: navigator.userAgent,
          teamsUrl: window.location.href,
          timestamp: new Date().toISOString(),
          conversationDetected: Boolean(conversation)
        }
      });

      console.log(`✅ Successfully sent ${batch.length} messages:`, result);

      if (conversation && conversationManager) {
        conversationManager.updateCheckpoint(conversation.id, batch);
        console.log(
          '[Teams Extractor] Updated checkpoint for conversation:',
          conversation.name || conversation.id
        );
      }

      // Update local counter
      extractedMessagesCount += batch.length;
      retryCount = 0; // Reset retry count on success
      retryDelay = 1000; // Reset delay

      // Notify background script
      safeSendMessage({
        type: 'MESSAGES_SENT',
        count: batch.length,
        inserted: result?.inserted || batch.length,
        duplicates: result?.duplicates || 0,
        totalExtracted: extractedMessagesCount,
        conversationId: conversation?.id || null
      });

      // Send remaining messages if any
      if (messageQueue.length > 0) {
        setTimeout(() => sendMessages(), 100);
      }
    } catch (error) {
      console.error('❌ Failed to deliver messages:', error);

      if (error.isNetworkError || /Failed to fetch|NetworkError/i.test(error.message)) {
        console.error(`
🔧 BACKEND CONNECTION ISSUE DETECTED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The extension cannot reach the backend at: ${config.apiUrl}

Possible causes:
1. Backend server is not running
   → Start it with: docker-compose up -d

2. Wrong API URL configured
   → Check extension settings

3. CORS not properly configured
   → Backend should allow origin: chrome-extension://*

Current queue size: ${messageQueue.length + batch.length} messages waiting
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
      } else if (error.details) {
        console.error('Backend response details:', error.details);
      }

      // Re-add to queue for retry
      messageQueue.unshift(...batch);
      const detailSnippet = error.details ? String(error.details).slice(0, 400) : null;
      const detailMessage = detailSnippet ? `${error.message}: ${detailSnippet}` : error.message;
      handleSendFailure(batch, detailMessage);
    } finally {
      isSending = false;
    }
  }

  /**
   * Handle send failure with exponential backoff
   */
  function handleSendFailure(batch, errorDetails) {
    retryCount++;

    if (retryCount <= maxRetries) {
      console.log(`⏰ Will retry in ${retryDelay / 1000} seconds (attempt ${retryCount}/${maxRetries})`);

      // Notify background about the error but with retry pending
      safeSendMessage({
        type: 'EXTRACTION_ERROR',
        error: errorDetails,
        retrying: true,
        retryCount: retryCount,
        queueSize: messageQueue.length
      });

      // Schedule retry with exponential backoff
      setTimeout(() => {
        console.log(`🔄 Retrying batch send (attempt ${retryCount}/${maxRetries})...`);
        sendMessages();
      }, retryDelay);

      // Increase delay for next retry (exponential backoff)
      retryDelay = Math.min(retryDelay * 2, 30000); // Max 30 seconds
    } else {
      console.error(`❌ Failed to send batch after ${maxRetries} retries. Giving up on ${batch.length} messages.`);

      // Notify background about permanent failure
      safeSendMessage({
        type: 'EXTRACTION_ERROR',
        error: `Failed after ${maxRetries} retries: ${errorDetails}`,
        retrying: false,
        dropped: batch.length
      });

      // Reset retry counters
      retryCount = 0;
      retryDelay = 1000;
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
   * Setup periodic extraction and queue processing
   */
  function setupPeriodicExtraction() {
    // Extract new messages periodically
    setInterval(() => {
      extractVisibleMessages();
    }, config.extractInterval);

    // Process queue more frequently (every 2 seconds)
    setInterval(() => {
      if (messageQueue.length > 0 && !isSending) {
        console.log(`[Teams Extractor] Queue processor: ${messageQueue.length} messages waiting`);
        sendMessages();
      }
    }, 2000);

    // Force flush every 30 seconds if there are any messages
    setInterval(() => {
      if (messageQueue.length > 0 && !isSending) {
        console.log(`[Teams Extractor] Force flush: sending ${messageQueue.length} queued messages`);
        sendMessages();
      }
    }, 30000);
  }

  /**
   * Listen for messages from extension
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_NOW') {
      extractVisibleMessages();
      sendMessages();
      sendResponse({
        success: true,
        queueSize: messageQueue.length,
        extracted: extractedMessagesCount
      });
    } else if (message.type === 'GET_STATUS') {
      const conversation = conversationManager?.currentConversation || null;
      sendResponse({
        queueSize: messageQueue.length,
        enabled: config.enabled,
        channel: extractChannelName(),
        isExtracting: isExtracting,
        isSending: isSending,
        extractedCount: extractedMessagesCount,
        retryCount: retryCount,
        apiUrl: config.apiUrl,
        conversation,
        conversationStats: conversationManager ? conversationManager.getStats() : null,
        checkpoint: conversation && conversationManager
          ? conversationManager.getCheckpoint(conversation.id)
          : null
      });
    } else if (message.type === 'GET_STATS') {
      if (!conversationManager) {
        sendResponse({ success: false, error: 'Conversation tracking unavailable' });
        return true;
      }
      sendResponse({ success: true, stats: conversationManager.getStats() });
    } else if (message.type === 'CLEAR_STATE') {
      if (!conversationManager) {
        sendResponse({ success: false, error: 'Conversation tracking unavailable' });
        return true;
      }
      conversationManager
        .clearState()
        .then(() => {
          extractedMessagesCount = 0;
          sendResponse({ success: true });
        })
        .catch((err) => {
          sendResponse({ success: false, error: err.message });
        });
      return true;
    } else if (message.type === 'UPDATE_CONFIG') {
      applyConfigUpdate(message.config);
      sendResponse({ success: true });
    } else if (message.type === 'FORCE_FLUSH') {
      // Force send all queued messages
      console.log('[Teams Extractor] Force flush requested');
      if (!isSending && messageQueue.length > 0) {
        sendMessages();
      }
      sendResponse({
        success: true,
        queueSize: messageQueue.length
      });
    } else if (message.type === 'CLEAR_QUEUE') {
      // Clear the message queue (for debugging)
      const clearedCount = messageQueue.length;
      messageQueue = [];
      retryCount = 0;
      retryDelay = 1000;
      sendResponse({
        success: true,
        cleared: clearedCount
      });
    }
    return true;
  });

  /**
   * Initialize extraction
   */
  function initialize() {
    console.log('[Teams Extractor] Initializing Teams Message Extractor v1.0.2');
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
