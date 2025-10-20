const SETTINGS_KEY = "teamsJiraSettings";
const QUEUE_KEY = "teamsJiraQueue";
const RETRY_LIMIT = 5;

async function loadSettings() {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return stored[SETTINGS_KEY] || null;
}

async function loadQueue() {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  return stored[QUEUE_KEY] || [];
}

async function saveQueue(queue) {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

async function enqueue(payload) {
  const queue = await loadQueue();
  queue.push({ payload, attempts: 0, enqueuedAt: Date.now() });
  await saveQueue(queue);
  processQueue();
}

async function processQueue() {
  const settings = await loadSettings();
  if (!settings || !settings.webhookUrl) {
    return;
  }

  const queue = await loadQueue();
  if (!queue.length) return;

  const remaining = [];

  for (const item of queue) {
    try {
      await postToWebhook(settings, item.payload);
    } catch (err) {
      console.error("[Teams Jira] webhook dispatch failed", err);
      const attempts = item.attempts + 1;
      if (attempts < RETRY_LIMIT) {
        remaining.push({ ...item, attempts });
      } else {
        console.error("[Teams Jira] dropping event after retries", item);
      }
    }
  }

  await saveQueue(remaining);
}

async function postToWebhook(settings, payload) {
  const body = JSON.stringify({
    ...payload,
    receivedAt: new Date().toISOString()
  });

  const headers = {
    "Content-Type": "application/json"
  };
  if (settings.apiKey) {
    headers["X-API-Key"] = settings.apiKey;
  }

  const res = await fetch(settings.webhookUrl, {
    method: "POST",
    mode: "cors",
    headers,
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webhook ${res.status}: ${text}`);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "resolution_detected") {
    enqueue(msg.payload).catch((err) => console.error("[Teams Jira] failed to enqueue", err));
  }
});

chrome.alarms.create("teamsJiraFlush", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "teamsJiraFlush") {
    processQueue().catch((err) => console.error("[Teams Jira] alarm flush failed", err));
  }
});

chrome.runtime.onInstalled.addListener(() => {
  processQueue().catch(() => {});
});
