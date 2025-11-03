// Background service worker for Teams Message Extractor

console.log('Background service worker loaded');

// State management
let extractorState = {
  isActive: false,
  totalMessages: 0,
  lastSync: null,
  errors: [],
  lastError: null,
  retrying: false,
  droppedMessages: 0,
};

// Configuration
let config = {
  apiUrl: 'http://localhost:5000/api',
  syncInterval: 60000, // 1 minute
};

// Load config from storage
chrome.storage.sync.get(['apiUrl', 'syncInterval'], (result) => {
  if (result.apiUrl) config.apiUrl = result.apiUrl;
  if (result.syncInterval) config.syncInterval = result.syncInterval;
});

/**
 * Handle messages from content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);

  switch (message.type) {
    case 'EXTRACTOR_READY':
      extractorState.isActive = true;
      extractorState.lastSync = new Date().toISOString();
      updateBadge('✓', 'green');
      console.log('Extractor is ready and active');
      break;

    case 'MESSAGES_SENT':
      extractorState.totalMessages += message.count;
      extractorState.lastSync = new Date().toISOString();
      extractorState.lastError = null; // Clear error on success
      extractorState.retrying = false;
      updateBadge(extractorState.totalMessages.toString(), 'blue');
      console.log(`✅ Sent ${message.count} messages. Total: ${extractorState.totalMessages}`);
      break;

    case 'EXTRACTION_ERROR':
      extractorState.lastError = {
        timestamp: new Date().toISOString(),
        error: message.error,
        retrying: message.retrying || false,
        retryCount: message.retryCount || 0
      };
      extractorState.retrying = message.retrying || false;

      // Track dropped messages
      if (message.dropped) {
        extractorState.droppedMessages += message.dropped;
      }

      // Only add to errors array if it's a permanent failure
      if (!message.retrying) {
        extractorState.errors.push({
          timestamp: new Date().toISOString(),
          error: message.error
        });
        // Keep only last 10 errors
        if (extractorState.errors.length > 10) {
          extractorState.errors = extractorState.errors.slice(-10);
        }
      }

      // Update badge based on retry status
      if (message.retrying) {
        updateBadge('⏰', 'orange');
      } else {
        updateBadge('!', 'red');
      }
      console.error('Extraction error:', message);
      break;

    case 'GET_STATE':
      sendResponse(extractorState);
      return true;
  }

  sendResponse({ success: true });
  return true;
});

/**
 * Update extension badge
 */
function updateBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({
    color: color === 'green' ? '#4CAF50' :
           color === 'blue' ? '#2196F3' :
           color === 'red' ? '#F44336' :
           color === 'orange' ? '#FF9800' : '#9E9E9E'
  });
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);

  if (details.reason === 'install') {
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }

  // Set default badge
  updateBadge('0', 'gray');
});

/**
 * Periodic sync alarm
 */
chrome.alarms.create('periodicSync', {
  periodInMinutes: 1
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'periodicSync') {
    // Trigger extraction in all Teams tabs
    chrome.tabs.query(
      { url: ['https://teams.microsoft.com/*', 'https://*.teams.microsoft.com/*'] },
      (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_NOW' });
        });
      }
    );
  }
});

/**
 * Handle tab updates (navigate to Teams)
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && /https:\/\/([\w.-]+\.)?teams\.microsoft\.com/i.test(tab.url || '')) {
    console.log('Teams tab loaded:', tabId);
    updateBadge('⟳', 'gray');
  }
});

/**
 * Check backend connectivity
 */
async function checkBackendHealth() {
  try {
    const response = await fetch(`${config.apiUrl}/health`);
    return response.ok;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
}

// Check backend on startup
checkBackendHealth().then(isHealthy => {
  if (!isHealthy) {
    console.warn('Backend is not responding');
    updateBadge('!', 'red');
  }
});
