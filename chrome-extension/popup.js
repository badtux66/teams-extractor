// Popup script for Teams Message Extractor

document.addEventListener('DOMContentLoaded', async () => {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const messageCount = document.getElementById('messageCount');
  const queueSize = document.getElementById('queueSize');
  const queueStatus = document.getElementById('queueStatus');
  const lastSync = document.getElementById('lastSync');
  const errorContainer = document.getElementById('errorContainer');
  const errorText = document.getElementById('errorText');

  // Load state
  await updateStatus();

  // Auto-refresh every 2 seconds
  setInterval(updateStatus, 2000);

  // Button handlers
  document.getElementById('extractBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab.url?.includes('teams.microsoft.com')) {
      chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_NOW' }, (response) => {
        if (response?.success) {
          showNotification('Extraction started');
        }
      });
    } else {
      alert('Please navigate to Teams web app first');
    }
  });

  // Force flush button handler
  document.getElementById('forceFlushBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab.url?.includes('teams.microsoft.com')) {
      chrome.tabs.sendMessage(tab.id, { type: 'FORCE_FLUSH' }, (response) => {
        if (response?.success) {
          showNotification(`Force flush initiated. Queue: ${response.queueSize} messages`);
        }
      });
    } else {
      alert('Please navigate to Teams web app first');
    }
  });

  document.getElementById('openGuiBtn').addEventListener('click', () => {
    chrome.storage.sync.get(['apiUrl'], (result) => {
      const guiUrl = result.apiUrl?.replace('/api', '') || 'http://localhost:3000';
      chrome.tabs.create({ url: guiUrl });
    });
  });

  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('viewLogsBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
  });

  /**
   * Update status display
   */
  async function updateStatus() {
    try {
      // Get state from background
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (state) => {
        if (state) {
          // Update indicator based on state
          if (state.retrying) {
            statusIndicator.className = 'indicator retrying';
            statusIndicator.style.backgroundColor = '#FF9800';
            statusText.textContent = 'Retrying...';
          } else if (state.lastError && !state.retrying) {
            statusIndicator.className = 'indicator error';
            statusIndicator.style.backgroundColor = '#ef4444';
            statusText.textContent = 'Error';
          } else if (state.isActive) {
            statusIndicator.className = 'indicator active';
            statusIndicator.style.backgroundColor = '#10b981';
            statusText.textContent = 'Active';
          } else {
            statusIndicator.className = 'indicator inactive';
            statusIndicator.style.backgroundColor = '#ef4444';
            statusText.textContent = 'Inactive';
          }

          // Update counts
          messageCount.textContent = state.totalMessages.toLocaleString();
          if (state.droppedMessages > 0) {
            messageCount.textContent += ` (${state.droppedMessages} dropped)`;
          }

          // Update last sync
          if (state.lastSync) {
            const date = new Date(state.lastSync);
            lastSync.textContent = formatTimeAgo(date);
          }

          // Show error if present
          if (state.lastError) {
            errorContainer.style.display = 'block';
            if (state.retrying) {
              errorText.textContent = `Retrying... (attempt ${state.lastError.retryCount || 1})`;
              errorText.style.color = '#f97316';
            } else {
              errorText.textContent = state.lastError.error.substring(0, 100);
              errorText.style.color = '#ef4444';
            }
          } else {
            errorContainer.style.display = 'none';
          }
        }
      });

      // Get detailed queue status from active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url?.includes('teams.microsoft.com')) {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (response) => {
          if (response) {
            queueSize.textContent = response.queueSize || 0;

            // Add queue status indicator
            if (response.isSending) {
              queueStatus.textContent = ' (sending...)';
              queueStatus.style.color = '#10b981';
            } else if (response.retryCount > 0) {
              queueStatus.textContent = ` (retry ${response.retryCount})`;
              queueStatus.style.color = '#f97316';
            } else if (response.queueSize > 0) {
              queueStatus.textContent = ' (waiting)';
              queueStatus.style.color = '#6b7280';
            } else {
              queueStatus.textContent = '';
            }
          }
        });
      } else {
        queueSize.textContent = '-';
        queueStatus.textContent = '';
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  /**
   * Format time ago
   */
  function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  /**
   * Show notification
   */
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #10b981;
      color: white;
      padding: 10px 15px;
      border-radius: 6px;
      font-size: 14px;
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
});
