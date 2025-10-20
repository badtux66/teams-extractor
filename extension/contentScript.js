const STORAGE_KEY = "teamsJiraSettings";
const MESSAGE_SELECTOR = "[data-tid='messageBodyContent'], div[data-tid='messageBody']";
const HEADER_SELECTOR = "[data-tid='channel-header-title-text']";

const processedMessages = new Set();
let settingsCache = null;

function sanitizeText(node) {
  return node ? node.innerText.replace(/\s+/g, " ").trim() : "";
}

function getCurrentChannelName() {
  const header = document.querySelector(HEADER_SELECTOR);
  if (header) {
    return header.textContent.trim();
  }
  return "";
}

function classifyResolution(text, keywords) {
  const lowered = text.toLocaleLowerCase("tr");
  const localized = keywords.localized || [];
  const global = keywords.global || [];

  for (const word of localized) {
    if (lowered.includes(word.toLocaleLowerCase("tr"))) {
      return { type: "localized", keyword: word };
    }
  }
  for (const word of global) {
    if (lowered.includes(word.toLocaleLowerCase("tr"))) {
      return { type: "global", keyword: word };
    }
  }
  return null;
}

function extractAuthor(node) {
  const authorNode =
    node.closest("[data-tid='messageMainContent']")?.querySelector("[data-tid='messageAuthorName']") ||
    node.closest("[data-tid='chat-message']")?.querySelector("[data-tid='messageAuthorName']");
  return sanitizeText(authorNode);
}

function extractTimestamp(node) {
  const timeNode =
    node.closest("[data-tid='messageMainContent']")?.querySelector("time") ||
    node.closest("[data-tid='chat-message']")?.querySelector("time");
  return timeNode?.getAttribute("datetime") || sanitizeText(timeNode);
}

function extractMessageId(node) {
  const wrapper = node.closest("[data-tid='messageMainContent'], [data-tid='chat-message']");
  if (!wrapper) return null;
  return wrapper.getAttribute("data-item-id") || wrapper.getAttribute("id");
}

function extractQuotedRequest(node) {
  const quoteNode =
    node.closest("[data-tid='messageMainContent']")?.querySelector("[data-tid='quotedMessage']") ||
    node.closest("[data-tid='chat-message']")?.querySelector("[data-tid='quotedMessage']") ||
    node.querySelector("blockquote");
  if (!quoteNode) {
    return null;
  }
  const author =
    quoteNode.querySelector("[data-tid='messageAuthorName']") ||
    quoteNode.querySelector("[data-tid='replyMessageAuthor']");
  const text =
    quoteNode.querySelector("[data-tid='replyMessageBody']") ||
    quoteNode.querySelector("[data-tid='messageBodyContent']");
  return {
    author: sanitizeText(author),
    text: sanitizeText(text || quoteNode)
  };
}

function findMessageElements(mutation) {
  const nodes = [];
  mutation.addedNodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    if (node.matches && node.matches(MESSAGE_SELECTOR)) {
      nodes.push(node);
      return;
    }
    node.querySelectorAll?.(MESSAGE_SELECTOR).forEach((el) => nodes.push(el));
  });
  return nodes;
}

async function loadSettings() {
  if (settingsCache) {
    return settingsCache;
  }
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  settingsCache = {
    processorUrl: "http://localhost:8090/ingest",
    apiKey: "",
    userName: "",
    channelName: "Güncelleme Planlama",
    keywords: {
      localized: ["Güncellendi", "Güncellenmiştir"],
      global: ["Yaygınlaştırıldı", "Yaygınlaştırılmıştır"]
    },
    ...(stored[STORAGE_KEY] || {})
  };
  return settingsCache;
}

async function handlePotentialMessage(node) {
  const settings = await loadSettings();
  if (!settings.processorUrl || !settings.userName) {
    return;
  }
  const channel = getCurrentChannelName();
  if (!channel || channel !== settings.channelName) {
    return;
  }

  const author = extractAuthor(node);
  if (!author || author.toLocaleLowerCase("tr") !== settings.userName.toLocaleLowerCase("tr")) {
    return;
  }

  const text = sanitizeText(node);
  if (!text) return;

  const classification = classifyResolution(text, settings.keywords || {});
  if (!classification) return;

  const messageId = extractMessageId(node);
  if (messageId && processedMessages.has(messageId)) {
    return;
  }

  const quotedRequest = extractQuotedRequest(node);
  const timestamp = extractTimestamp(node);

  const payload = {
    channel,
    messageId,
    author,
    timestamp,
    classification,
    resolutionText: text,
    quotedRequest,
    permalink: messageId
      ? `https://teams.microsoft.com/l/message/${encodeURIComponent(messageId)}`
      : null
  };

  chrome.runtime.sendMessage({ type: "resolution_detected", payload });

  if (messageId) {
    processedMessages.add(messageId);
  }
}

function bootstrapObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const targets = findMessageElements(mutation);
      targets.forEach((node) => {
        handlePotentialMessage(node).catch((err) =>
          console.warn("[Teams Jira] failed to process message", err)
        );
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

bootstrapObserver();

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== "sync") return;
  if (changes[STORAGE_KEY]) {
    settingsCache = changes[STORAGE_KEY].newValue;
  }
});
