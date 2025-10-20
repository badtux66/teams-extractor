chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'messageSent') {
    chrome.storage.local.get(['messageHistory'], (result) => {
      const history = result.messageHistory || [];
      history.push(message.data);
      
      if (history.length > 100) {
        history.shift();
      }
      
      chrome.storage.local.set({ messageHistory: history });
    });
  }
});