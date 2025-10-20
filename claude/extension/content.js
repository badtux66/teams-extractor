class TeamsMessageExtractor {
  constructor() {
    this.channelName = 'Güncelleme Planlama';
    this.n8nWebhookUrl = '';
    this.observerActive = false;
    this.processedMessages = new Set();
    this.keywords = {
      completed: ['Güncellendi', 'Güncellenmiştir'],
      spread: ['Yaygınlaştırıldı', 'Yaygınlaştırılmıştır'],
      requestUpdate: ['Güncelleştirme'],
      requestSpread: ['Yaygınlaştırma']
    };
    this.init();
  }

  async init() {
    const config = await chrome.storage.sync.get(['n8nWebhookUrl']);
    this.n8nWebhookUrl = config.n8nWebhookUrl || '';
    
    if (!this.n8nWebhookUrl) {
      console.log('Please configure n8n webhook URL in extension settings');
      return;
    }

    this.waitForChannel();
  }

  waitForChannel() {
    const checkInterval = setInterval(() => {
      const channelElement = this.findChannelElement();
      if (channelElement) {
        clearInterval(checkInterval);
        console.log(`Found channel: ${this.channelName}`);
        this.startObserver();
      }
    }, 2000);
  }

  findChannelElement() {
    const elements = document.querySelectorAll('[data-tid="channel-name"], [aria-label*="Güncelleme Planlama"]');
    for (const el of elements) {
      if (el.textContent?.includes(this.channelName)) {
        return el;
      }
    }
    return null;
  }

  startObserver() {
    if (this.observerActive) return;
    
    const messageContainer = document.querySelector('[data-tid="chat-pane-list"], [role="main"], .ts-message-list-container');
    if (!messageContainer) {
      console.log('Message container not found, retrying...');
      setTimeout(() => this.startObserver(), 3000);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              this.processNewMessage(node);
            }
          });
        }
      }
    });

    observer.observe(messageContainer, {
      childList: true,
      subtree: true
    });

    this.observerActive = true;
    console.log('Message observer started');
    
    this.processExistingMessages();
  }

  processExistingMessages() {
    const messages = document.querySelectorAll('[data-tid*="message"], .ts-message-thread-body, [role="article"]');
    messages.forEach(msg => this.processNewMessage(msg));
  }

  processNewMessage(element) {
    const messageId = this.getMessageId(element);
    if (!messageId || this.processedMessages.has(messageId)) {
      return;
    }

    const messageText = this.extractMessageText(element);
    const sender = this.extractSender(element);
    const timestamp = this.extractTimestamp(element);

    if (!messageText) return;

    const messageType = this.classifyMessage(messageText);
    if (messageType) {
      this.processedMessages.add(messageId);
      this.sendToN8N({
        messageId,
        text: messageText,
        sender,
        timestamp,
        type: messageType,
        channel: this.channelName,
        extractedAt: new Date().toISOString()
      });
    }
  }

  getMessageId(element) {
    return element.getAttribute('data-message-id') || 
           element.getAttribute('id') || 
           element.querySelector('[data-message-id]')?.getAttribute('data-message-id') ||
           Date.now().toString();
  }

  extractMessageText(element) {
    const textElement = element.querySelector('[data-tid="message-content"], .message-body, [role="presentation"]');
    return textElement?.textContent?.trim() || element.textContent?.trim();
  }

  extractSender(element) {
    const senderElement = element.querySelector('[data-tid="message-author-name"], .ts-message-sender-name, [data-tid*="sender"]');
    return senderElement?.textContent?.trim() || 'Unknown';
  }

  extractTimestamp(element) {
    const timeElement = element.querySelector('[data-tid="message-timestamp"], time, [datetime]');
    return timeElement?.getAttribute('datetime') || 
           timeElement?.textContent?.trim() || 
           new Date().toISOString();
  }

  classifyMessage(text) {
    for (const [type, keywords] of Object.entries(this.keywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return type;
      }
    }
    return null;
  }

  async sendToN8N(data) {
    try {
      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        console.error('Failed to send to n8n:', response.status);
      } else {
        console.log('Message sent to n8n:', data.type);
        chrome.runtime.sendMessage({
          action: 'messageSent',
          data: data
        });
      }
    } catch (error) {
      console.error('Error sending to n8n:', error);
    }
  }
}

new TeamsMessageExtractor();