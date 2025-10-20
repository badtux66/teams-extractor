const STORAGE_KEY = "teamsJiraSettings";

const defaults = {
  webhookUrl: "",
  apiKey: "",
  userName: "",
  channelName: "Güncelleme Planlama",
  keywords: {
    localized: ["Güncellendi", "Güncellenmiştir"],
    global: ["Yaygınlaştırıldı", "Yaygınlaştırılmıştır"]
  }
};

async function load() {
  const saved = await chrome.storage.sync.get(STORAGE_KEY);
  const settings = { ...defaults, ...(saved[STORAGE_KEY] || {}) };
  document.getElementById("webhookUrl").value = settings.webhookUrl;
  document.getElementById("apiKey").value = settings.apiKey;
  document.getElementById("userName").value = settings.userName;
  document.getElementById("channelName").value = settings.channelName;
  document.getElementById("keywords").value =
    settings.keywords &&
    JSON.stringify(settings.keywords, null, 2);
}

async function save() {
  const status = document.getElementById("status");
  status.textContent = "";

  try {
    const rawKeywords = document.getElementById("keywords").value.trim();
    const payload = {
      webhookUrl: document.getElementById("webhookUrl").value.trim(),
      apiKey: document.getElementById("apiKey").value.trim(),
      userName: document.getElementById("userName").value.trim(),
      channelName: document.getElementById("channelName").value.trim() || defaults.channelName,
      keywords: rawKeywords ? JSON.parse(rawKeywords) : defaults.keywords
    };

    if (!payload.webhookUrl) {
      throw new Error("Webhook URL is required");
    }
    if (!payload.userName) {
      throw new Error("Teams display name is required");
    }

    await chrome.storage.sync.set({ [STORAGE_KEY]: payload });
    status.textContent = "Saved.";
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  }
}

document.getElementById("saveBtn").addEventListener("click", save);
document.addEventListener("DOMContentLoaded", load);
