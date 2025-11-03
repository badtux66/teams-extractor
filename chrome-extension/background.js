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

const DEFAULT_API_URL = 'http://localhost:5000/api';

// Configuration
let config = {
  apiUrl: DEFAULT_API_URL,
  apiKey: '',
  syncInterval: 60000, // 1 minute
};

function sanitizeApiUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }
  return url.trim().replace(/\/+$/, '');
}

function getBatchEndpoint(customUrl) {
  const base = sanitizeApiUrl(customUrl) || config.apiUrl || DEFAULT_API_URL;
  return `${base}/messages/batch`;
}

async function handleBatchSendRequest(payload = {}) {
  const { messages, extractionId, metadata, apiUrl, apiKey } = payload;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('No messages to send');
  }

  if (!extractionId) {
    throw new Error('Missing extractionId for batch');
  }

  const endpoint = getBatchEndpoint(apiUrl);
  const headers = {
    'Content-Type': 'application/json',
  };
  const resolvedApiKey = apiKey || config.apiKey;
  if (resolvedApiKey) {
    headers['X-API-Key'] = resolvedApiKey;
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages,
        extractionId,
        metadata: metadata || {},
      }),
    });
  } catch (error) {
    const networkError = new Error(error?.message || 'Failed to reach backend');
    networkError.isNetworkError = true;
    throw networkError;
  }

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
    err.status = response.status;
    err.details = text.slice(0, 500);
    throw err;
  }

  return response.json();
}

// Load config from storage
chrome.storage.sync.get(['apiUrl', 'syncInterval', 'apiKey'], (result) => {
  if (result.apiUrl) config.apiUrl = sanitizeApiUrl(result.apiUrl);
  if (result.apiKey) config.apiKey = result.apiKey;
  if (result.syncInterval) config.syncInterval = Number(result.syncInterval);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') {
    return;
  }

  if (changes.apiUrl) {
    config.apiUrl = sanitizeApiUrl(changes.apiUrl.newValue) || DEFAULT_API_URL;
  }
  if (changes.apiKey) {
    config.apiKey = changes.apiKey.newValue || '';
  }
  if (changes.syncInterval) {
    const value = Number(changes.syncInterval.newValue);
    if (!Number.isNaN(value)) {
      config.syncInterval = value;
    }
  }
});

/**
 * Handle messages from content script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);

  // Use a single listener with a switch statement
  switch (message.type) {
    case 'EXTRACTOR_READY':
      extractorState.isActive = true;
      extractorState.lastSync = new Date().toISOString();
      updateBadge('✓', 'green');
      console.log('Extractor is ready and active');
      sendResponse({ success: true });
      break;

    case 'SEND_BATCH':
      handleBatchSendRequest(message.payload || {})
        .then((result) => {
          sendResponse({ success: true, result });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error.message,
            status: error.status || null,
            details: error.details || null,
            network: Boolean(error.isNetworkError)
          });
        });
      return true; // Indicates that the response is sent asynchronously

    case 'MESSAGES_SENT':
      extractorState.totalMessages += message.count;
      extractorState.lastSync = new Date().toISOString();
      extractorState.lastError = null; // Clear error on success
      extractorState.retrying = false;
      updateBadge(extractorState.totalMessages.toString(), 'blue');
      console.log(`✅ Sent ${message.count} messages. Total: ${extractorState.totalMessages}`);
      sendResponse({ success: true });
      break;

    case 'EXTRACTION_ERROR':
      handleExtractionError(message);
      sendResponse({ success: true });
      break;

    case 'GET_STATE':
    case 'GET_STATUS':
      sendResponse(extractorState);
      break;

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
      break;
  }
  // Return true for async sendResponse, but not for sync cases
  if (message.type !== 'SEND_BATCH') {
    return false;
  }
});

/**
 * Handles logging and state updates for extraction errors.
 */
function handleExtractionError(message) {
  extractorState.lastError = {
    timestamp: new Date().toISOString(),
    error: message.error,
    retrying: message.retrying || false,
    retryCount: message.retryCount || 0
  };
  extractorState.retrying = message.retrying || false;

  if (message.dropped) {
    extractorState.droppedMessages += message.dropped;
  }

  if (!message.retrying) {
    extractorState.errors.push({
      timestamp: new Date().toISOString(),
      error: message.error
    });
    if (extractorState.errors.length > 10) {
      extractorState.errors = extractorState.errors.slice(-10);
    }
  }

  if (message.retrying) {
    updateBadge('⏰', 'orange');
  } else {
    updateBadge('!', 'red');
  }
  console.error('Extraction error reported:', message);
}


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
    const healthUrl = `${sanitizeApiUrl(config.apiUrl || DEFAULT_API_URL)}/health`;
    const response = await fetch(healthUrl);
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
