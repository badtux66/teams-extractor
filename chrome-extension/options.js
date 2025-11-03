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
  document.getElementById('installMcpBtn').addEventListener('click', installMcpExtension);
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
    chrome.tabs.query({ url: ['https://teams.microsoft.com/*', 'https://*.teams.microsoft.com/*'] }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'UPDATE_CONFIG',
          config: settings
        }, () => chrome.runtime.lastError);
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

// MCP Installation
/**
 * Install MCP extension for Claude Desktop
 */
async function installMcpExtension() {
  const apiUrl = document.getElementById('apiUrl').value.trim();
  const mcpStatus = document.getElementById('mcpStatus');

  if (!apiUrl) {
    showMessage('Please save a valid API URL before installing.', 'error');
    return;
  }

  mcpStatus.textContent = 'Installation in progress...';
  mcpStatus.className = 'status-message'; // Reset classes

  try {
    const baseUrl = apiUrl.replace('/api', '');
    const response = await fetch(`${baseUrl}/api/mcp/install`, {
      method: 'POST',
    });

    const result = await response.json();

    if (response.ok) {
      mcpStatus.textContent = `Installation successful: ${result.message}`;
      mcpStatus.classList.add('success');
    } else {
      mcpStatus.textContent = `Installation failed: ${result.error || 'Unknown error'}`;
      mcpStatus.classList.add('error');
    }
  } catch (error) {
    console.error('Error installing MCP extension:', error);
    mcpStatus.textContent = `Failed to connect to backend: ${error.message}`;
    mcpStatus.classList.add('error');
  }
}
