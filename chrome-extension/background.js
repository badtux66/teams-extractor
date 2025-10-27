// Background service worker for Teams Message Extractor

console.log('Background service worker loaded');

// State management
let extractorState = {
  isActive: false,
  totalMessages: 0,
  lastSync: null,
  errors: [],
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
      break;

    case 'MESSAGES_SENT':
      extractorState.totalMessages += message.count;
      extractorState.lastSync = new Date().toISOString();
      updateBadge(extractorState.totalMessages.toString(), 'blue');
      break;

    case 'EXTRACTION_ERROR':
      extractorState.errors.push({
        timestamp: new Date().toISOString(),
        error: message.error
      });
      updateBadge('!', 'red');
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
           color === 'red' ? '#F44336' : '#9E9E9E'
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
    chrome.tabs.query({ url: 'https://teams.microsoft.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_NOW' });
      });
    });
  }
});

/**
 * Handle tab updates (navigate to Teams)
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('teams.microsoft.com')) {
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
