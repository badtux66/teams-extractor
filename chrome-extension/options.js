// Options script for Teams Message Extractor

// Default settings
const defaultSettings = {
  apiUrl: 'http://localhost:5000/api',
  apiKey: '',
  enabled: true,
  extractInterval: 5,
  batchSize: 50,
  extractReactions: false,
  extractThreads: true,
  extractAttachments: false,
  debugMode: false,
};

// Load settings on page load
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // Button handlers
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('testBtn').addEventListener('click', testConnection);
  document.getElementById('resetBtn').addEventListener('click', resetSettings);
});

/**
 * Load settings from storage
 */
function loadSettings() {
  chrome.storage.sync.get(defaultSettings, (settings) => {
    document.getElementById('apiUrl').value = settings.apiUrl;
    document.getElementById('apiKey').value = settings.apiKey;
    document.getElementById('enabled').checked = settings.enabled;
    document.getElementById('extractInterval').value = settings.extractInterval;
    document.getElementById('batchSize').value = settings.batchSize;
    document.getElementById('extractReactions').checked = settings.extractReactions;
    document.getElementById('extractThreads').checked = settings.extractThreads;
    document.getElementById('extractAttachments').checked = settings.extractAttachments;
    document.getElementById('debugMode').checked = settings.debugMode;
  });
}

/**
 * Save settings to storage
 */
function saveSettings() {
  const settings = {
    apiUrl: document.getElementById('apiUrl').value.trim(),
    apiKey: document.getElementById('apiKey').value.trim(),
    enabled: document.getElementById('enabled').checked,
    extractInterval: parseInt(document.getElementById('extractInterval').value),
    batchSize: parseInt(document.getElementById('batchSize').value),
    extractReactions: document.getElementById('extractReactions').checked,
    extractThreads: document.getElementById('extractThreads').checked,
    extractAttachments: document.getElementById('extractAttachments').checked,
    debugMode: document.getElementById('debugMode').checked,
  };

  // Validate settings
  if (!settings.apiUrl) {
    showMessage('Please enter a valid API URL', 'error');
    return;
  }

  // Save to storage
  chrome.storage.sync.set(settings, () => {
    showMessage('Settings saved successfully!', 'success');

    // Update all content scripts
    chrome.tabs.query({ url: 'https://teams.microsoft.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'UPDATE_CONFIG',
          config: settings
        });
      });
    });
  });
}

/**
 * Test backend connection
 */
async function testConnection() {
  const apiUrl = document.getElementById('apiUrl').value.trim();

  if (!apiUrl) {
    showMessage('Please enter an API URL first', 'error');
    return;
  }

  try {
    const baseUrl = apiUrl.replace('/api', '');
    const response = await fetch(`${baseUrl}/api/health`);

    if (response.ok) {
      const data = await response.json();
      showMessage(`Connection successful! Backend is healthy.`, 'success');
    } else {
      showMessage(`Connection failed: ${response.statusText}`, 'error');
    }
  } catch (error) {
    showMessage(`Connection error: ${error.message}`, 'error');
  }
}

/**
 * Reset to default settings
 */
function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    chrome.storage.sync.set(defaultSettings, () => {
      loadSettings();
      showMessage('Settings reset to defaults', 'success');
    });
  }
}

/**
 * Show status message
 */
function showMessage(message, type) {
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;

  setTimeout(() => {
    statusMessage.className = 'status-message';
  }, 5000);
}
