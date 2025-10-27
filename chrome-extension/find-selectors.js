/**
 * Teams DOM Selector Finder
 * Run this script in the Chrome console on teams.microsoft.com to find the correct selectors
 */

(function findTeamsSelectors() {
  console.log('=== Teams Selector Finder ===');
  console.log('URL:', window.location.href);

  // Test various possible message container selectors
  const containerTests = [
    '[role="log"]',
    '[role="list"]',
    '[data-tid="messageBodyContent"]',
    '[class*="message-list"]',
    '[class*="chat-list"]',
    '[class*="conversation"]',
    '.ts-message-list',
    '[id*="message"]',
    '[id*="chat"]'
  ];

  console.log('\n--- Testing Container Selectors ---');
  containerTests.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`✓ Found ${elements.length} elements for: ${selector}`);
      console.log('  First element:', elements[0]);
    }
  });

  // Test message item selectors
  const itemTests = [
    '[role="listitem"]',
    '[role="article"]',
    '[data-tid="chat-pane-item"]',
    '[data-tid="message-pane-item"]',
    '[class*="message"]',
    '[class*="chat-item"]',
    '[id^="message-"]',
    '.ui-chat__item'
  ];

  console.log('\n--- Testing Message Item Selectors ---');
  itemTests.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`✓ Found ${elements.length} elements for: ${selector}`);
      console.log('  Sample:', elements[0]);
    }
  });

  // Try to find any element with "message" in class or id
  console.log('\n--- Elements with "message" in class ---');
  const messageClasses = document.querySelectorAll('[class*="message" i]');
  console.log(`Found ${messageClasses.length} elements`);
  if (messageClasses.length > 0) {
    const classNames = new Set();
    for (let i = 0; i < Math.min(20, messageClasses.length); i++) {
      messageClasses[i].classList.forEach(c => {
        if (c.toLowerCase().includes('message')) {
          classNames.add(c);
        }
      });
    }
    console.log('Unique message classes:', Array.from(classNames));
  }

  // Check for common Teams UI elements
  console.log('\n--- Common Teams Elements ---');
  console.log('role=listitem:', document.querySelectorAll('[role="listitem"]').length);
  console.log('role=article:', document.querySelectorAll('[role="article"]').length);
  console.log('role=log:', document.querySelectorAll('[role="log"]').length);
  console.log('role=list:', document.querySelectorAll('[role="list"]').length);

  // Try to analyze the DOM structure around visible text
  console.log('\n--- Analyzing DOM Structure ---');
  const allText = document.querySelectorAll('p, div, span');
  let potentialMessages = [];

  allText.forEach(el => {
    const text = el.textContent.trim();
    // Look for elements with substantial text (likely messages)
    if (text.length > 20 && text.length < 500) {
      // Check if it's in the main content area (not sidebar)
      const rect = el.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 10) {
        potentialMessages.push({
          element: el,
          text: text.substring(0, 50) + '...',
          tag: el.tagName,
          classes: Array.from(el.classList).join(' '),
          parent: el.parentElement?.tagName,
          parentClasses: Array.from(el.parentElement?.classList || []).join(' ')
        });
      }
    }
  });

  console.log(`Found ${potentialMessages.length} potential message elements`);
  if (potentialMessages.length > 0) {
    console.log('Sample potential messages:', potentialMessages.slice(0, 5));
  }

  // Specific check for current chat messages
  console.log('\n--- Direct DOM Inspection ---');
  console.log('Right-click on a message in Teams and select "Inspect"');
  console.log('Then look for:');
  console.log('1. The outer container element (usually has role="listitem" or role="article")');
  console.log('2. What data-tid or data-* attributes it has');
  console.log('3. What classes it has');
  console.log('\nPaste the HTML here or tell me the attributes you see');

  return {
    containerTests,
    itemTests,
    messageClasses: messageClasses.length,
    potentialMessages: potentialMessages.length
  };
})();
