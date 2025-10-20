document.addEventListener('DOMContentLoaded', async () => {
  const webhookInput = document.getElementById('webhook-url');
  const projectInput = document.getElementById('jira-project');
  const saveBtn = document.getElementById('save-btn');
  const statusDiv = document.getElementById('status');
  const msgCountSpan = document.getElementById('msg-count');
  const lastActivitySpan = document.getElementById('last-activity');

  const config = await chrome.storage.sync.get(['n8nWebhookUrl', 'jiraProject']);
  if (config.n8nWebhookUrl) {
    webhookInput.value = config.n8nWebhookUrl;
  }
  if (config.jiraProject) {
    projectInput.value = config.jiraProject;
  }

  const history = await chrome.storage.local.get(['messageHistory']);
  const messages = history.messageHistory || [];
  msgCountSpan.textContent = messages.length;
  
  if (messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    const date = new Date(lastMsg.extractedAt);
    lastActivitySpan.textContent = date.toLocaleTimeString();
  }

  saveBtn.addEventListener('click', async () => {
    const webhookUrl = webhookInput.value.trim();
    const jiraProject = projectInput.value.trim();

    if (!webhookUrl) {
      showStatus('Please enter n8n webhook URL', 'error');
      return;
    }

    if (!jiraProject) {
      showStatus('Please enter Jira project key', 'error');
      return;
    }

    await chrome.storage.sync.set({
      n8nWebhookUrl: webhookUrl,
      jiraProject: jiraProject
    });

    showStatus('Configuration saved successfully!', 'success');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url?.includes('teams.microsoft.com')) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});