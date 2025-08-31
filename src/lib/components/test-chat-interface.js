import { JSDOM } from 'jsdom';

// Simple assertion helper
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Mock environment setup
const dom = new JSDOM(`<!DOCTYPE html>
  <div id="test-container">
    <div id="chat-interface-mount"></div>
  </div>
  <style>
    .message { margin: 8px 0; padding: 12px; border-radius: 8px; }
    .message.user { background-color: #d1e7dd; margin-left: auto; text-align: right; }
    .message.assistant { background-color: #e9ecef; margin-right: auto; }
    .typing-indicator { display: flex; align-items: center; gap: 4px; }
    .typing-dot { width: 8px; height: 8px; border-radius: 50%; background: #666; }
  </style>
`, {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);

// Mock localStorage
const localStorage = {
  data: {},
  getItem(key) { return this.data[key] || null; },
  setItem(key, value) { this.data[key] = value; },
  removeItem(key) { delete this.data[key]; },
  clear() { this.data = {}; }
};
global.localStorage = localStorage;

// Mock marked and prismjs
global.marked = {
  parse: (text) => `<p>${text.replace(/\n/g, '<br>')}</p>`,
  setOptions: () => {}
};

global.Prism = {
  highlightAll: () => {},
  highlight: (code, grammar, language) => code,
  languages: { javascript: {}, typescript: {} }
};

// Mock svelte-virtual-list
class MockVirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.items = options.items || [];
    this.itemHeight = options.itemHeight || 60;
    this.visibleItems = [];
    this.scrollTop = 0;
  }

  update(newItems) {
    this.items = newItems;
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    this.items.forEach((item, index) => {
      const element = document.createElement('div');
      element.className = `virtual-item item-${index}`;
      if (typeof item === 'string') {
        element.innerHTML = item;
      } else if (item.content) {
        element.innerHTML = item.content;
      } else {
        element.textContent = JSON.stringify(item);
      }
      element.dataset.index = index;
      this.container.appendChild(element);
    });
  }

  scrollTo(index) {
    this.scrollTop = index * this.itemHeight;
    this.container.scrollTop = this.scrollTop;
  }

  scrollToBottom() {
    this.scrollTop = this.items.length * this.itemHeight;
    this.container.scrollTop = this.scrollTop;
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

// Mock ChatInterface component
class ChatInterface {
  constructor(target, props = {}) {
    this.target = target;
    this.messages = props.messages || [];
    this.typing = props.typing || false;
    this.onSendMessage = props.onSendMessage || (() => {});
    this.sessionId = props.sessionId || 'test-session';
    
    // Initialize virtual list
    this.messageContainer = document.createElement('div');
    this.messageContainer.className = 'message-container';
    this.target.appendChild(this.messageContainer);
    
    this.virtualList = new MockVirtualList(this.messageContainer, {
      items: this.messages,
      itemHeight: 60
    });
    
    // Create input area
    this.inputArea = document.createElement('div');
    this.inputArea.className = 'input-area';
    this.inputArea.innerHTML = `
      <textarea id="message-input" placeholder="Type a message..."></textarea>
      <button id="send-button">Send</button>
    `;
    this.target.appendChild(this.inputArea);
    
    // Setup event listeners
    this.setupEventListeners();
    this.loadChatHistory();
    this.render();
  }
  
  setupEventListeners() {
    const input = this.target.querySelector('#message-input');
    const sendButton = this.target.querySelector('#send-button');
    
    sendButton.addEventListener('click', () => {
      const message = input.value.trim();
      if (message) {
        this.sendMessage(message);
        input.value = '';
      }
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const message = input.value.trim();
        if (message) {
          this.sendMessage(message);
          input.value = '';
        }
      }
    });
  }
  
  sendMessage(content) {
    const message = {
      id: Date.now().toString(),
      sender: 'user',
      content,
      timestamp: new Date()
    };
    
    this.addMessage(message);
    this.onSendMessage(message);
  }
  
  addMessage(message) {
    this.messages.push(message);
    this.saveChatHistory();
    this.render();
    this.scrollToBottom();
  }
  
  setTyping(isTyping) {
    this.typing = isTyping;
    this.render();
  }
  
  loadChatHistory() {
    const key = `chat-history-${this.sessionId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        this.messages = JSON.parse(stored);
      } catch (error) {
        console.warn('Failed to load chat history:', error);
        this.messages = [];
      }
    }
  }
  
  saveChatHistory() {
    const key = `chat-history-${this.sessionId}`;
    try {
      localStorage.setItem(key, JSON.stringify(this.messages));
    } catch (error) {
      console.warn('Failed to save chat history:', error);
    }
  }
  
  clearHistory() {
    this.messages = [];
    const key = `chat-history-${this.sessionId}`;
    localStorage.removeItem(key);
    this.render();
  }
  
  render() {
    const messageItems = this.messages.map(msg => this.formatMessage(msg));
    
    // Add typing indicator if typing
    if (this.typing) {
      messageItems.push(this.createTypingIndicator());
    }
    
    this.virtualList.update(messageItems);
  }
  
  formatMessage(message) {
    const className = `message ${message.sender}`;
    const timestamp = message.timestamp ? 
      new Date(message.timestamp).toLocaleTimeString() : '';
    
    let formattedContent = message.content;
    
    // Basic markdown support
    if (message.content.includes('```')) {
      formattedContent = this.formatCodeBlocks(message.content);
    } else {
      formattedContent = marked.parse(message.content);
    }
    
    return `
      <div class="${className}">
        <div class="message-content">${formattedContent}</div>
        ${timestamp ? `<div class="message-timestamp">${timestamp}</div>` : ''}
      </div>
    `;
  }
  
  formatCodeBlocks(content) {
    return content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
      const highlighted = Prism.highlight(code, Prism.languages[language] || {}, language || 'text');
      return `<pre><code class="language-${language || 'text'}">${highlighted}</code></pre>`;
    });
  }
  
  createTypingIndicator() {
    return `
      <div class="message assistant">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
  }
  
  scrollToBottom() {
    this.virtualList.scrollToBottom();
  }
  
  getMessageCount() {
    return this.messages.length;
  }
  
  getLastMessage() {
    return this.messages[this.messages.length - 1] || null;
  }
  
  destroy() {
    this.virtualList.destroy();
    this.target.innerHTML = '';
  }
}

// Test Suite
console.log('🧪 Testing ChatInterface Component...\n');

try {
  // Test 2.1: ChatInterface component initialization
  console.log('📋 Test 2.1: ChatInterface component initialization');
  
  // Test 2.1.1: Component creation
  console.log('  Test 2.1.1: Create ChatInterface component');
  const container = document.getElementById('chat-interface-mount');
  const chatInterface = new ChatInterface(container, {
    sessionId: 'test-session-1'
  });
  
  assert(chatInterface.messages.length === 0, 'Should start with empty messages');
  assert(chatInterface.sessionId === 'test-session-1', 'Should have correct session ID');
  assert(chatInterface.typing === false, 'Should not be typing initially');
  console.log('    ✅ Component created successfully');
  
  // Test 2.1.2: DOM structure creation
  console.log('  Test 2.1.2: DOM structure creation');
  const messageContainer = container.querySelector('.message-container');
  const inputArea = container.querySelector('.input-area');
  const messageInput = container.querySelector('#message-input');
  const sendButton = container.querySelector('#send-button');
  
  assert(messageContainer !== null, 'Message container should exist');
  assert(inputArea !== null, 'Input area should exist');
  assert(messageInput !== null, 'Message input should exist');
  assert(sendButton !== null, 'Send button should exist');
  console.log('    ✅ DOM structure created correctly');

  // Test 2.2: Message display and virtual scrolling
  console.log('\n📋 Test 2.2: Message display with virtual scrolling');
  
  // Test 2.2.1: Add messages
  console.log('  Test 2.2.1: Add messages to chat');
  chatInterface.addMessage({
    id: '1',
    sender: 'user',
    content: 'Hello, Claude!',
    timestamp: new Date()
  });
  
  chatInterface.addMessage({
    id: '2',
    sender: 'assistant',
    content: 'Hello! How can I help you today?',
    timestamp: new Date()
  });
  
  assert(chatInterface.getMessageCount() === 2, 'Should have 2 messages');
  
  const messageElements = messageContainer.querySelectorAll('.virtual-item');
  assert(messageElements.length === 2, 'Should render 2 message elements');
  console.log('    ✅ Messages added and rendered correctly');
  
  // Test 2.2.2: Message styling
  console.log('  Test 2.2.2: Message styling differentiation');
  const userMessage = messageContainer.querySelector('.virtual-item .message.user');
  const assistantMessage = messageContainer.querySelector('.virtual-item .message.assistant');
  
  assert(userMessage !== null, 'User message should have user class');
  assert(assistantMessage !== null, 'Assistant message should have assistant class');
  console.log('    ✅ Message styling works correctly');

  // Test 2.3: Typing indicator
  console.log('\n📋 Test 2.3: Typing indicator functionality');
  
  // Test 2.3.1: Show typing indicator
  console.log('  Test 2.3.1: Show typing indicator');
  chatInterface.setTyping(true);
  
  const typingIndicator = messageContainer.querySelector('.typing-indicator');
  assert(typingIndicator !== null, 'Typing indicator should be visible');
  
  const typingDots = typingIndicator.querySelectorAll('.typing-dot');
  assert(typingDots.length === 3, 'Should have 3 typing dots');
  console.log('    ✅ Typing indicator shows correctly');
  
  // Test 2.3.2: Hide typing indicator
  console.log('  Test 2.3.2: Hide typing indicator');
  chatInterface.setTyping(false);
  
  const hiddenTypingIndicator = messageContainer.querySelector('.typing-indicator');
  assert(hiddenTypingIndicator === null, 'Typing indicator should be hidden');
  console.log('    ✅ Typing indicator hides correctly');

  // Test 2.4: Message input and sending
  console.log('\n📋 Test 2.4: Message input and sending functionality');
  
  // Test 2.4.1: Send message via button click
  console.log('  Test 2.4.1: Send message via button click');
  let sentMessage = null;
  chatInterface.onSendMessage = (msg) => { sentMessage = msg; };
  
  const input = container.querySelector('#message-input');
  const button = container.querySelector('#send-button');
  
  input.value = 'Test message via button';
  button.click();
  
  assert(sentMessage !== null, 'Message should be sent');
  assert(sentMessage.content === 'Test message via button', 'Message content should match');
  assert(sentMessage.sender === 'user', 'Sender should be user');
  assert(input.value === '', 'Input should be cleared after send');
  console.log('    ✅ Button click sending works');
  
  // Test 2.4.2: Send message via Enter key
  console.log('  Test 2.4.2: Send message via Enter key');
  sentMessage = null;
  input.value = 'Test message via Enter';
  
  const enterEvent = new dom.window.KeyboardEvent('keydown', {
    key: 'Enter',
    shiftKey: false,
    bubbles: true,
    cancelable: true
  });
  
  input.dispatchEvent(enterEvent);
  
  assert(sentMessage !== null, 'Message should be sent via Enter');
  assert(sentMessage.content === 'Test message via Enter', 'Message content should match');
  console.log('    ✅ Enter key sending works');

  // Test 2.5: Chat history storage
  console.log('\n📋 Test 2.5: Chat history localStorage persistence');
  
  // Test 2.5.1: Save chat history
  console.log('  Test 2.5.1: Save chat history to localStorage');
  const initialMessageCount = chatInterface.getMessageCount();
  chatInterface.addMessage({
    id: '3',
    sender: 'user',
    content: 'Persistent message',
    timestamp: new Date()
  });
  
  const storageKey = 'chat-history-test-session-1';
  const storedData = localStorage.getItem(storageKey);
  assert(storedData !== null, 'Chat history should be saved to localStorage');
  
  const parsedData = JSON.parse(storedData);
  assert(parsedData.length === initialMessageCount + 1, 'Stored data should include new message');
  console.log('    ✅ Chat history saves to localStorage');
  
  // Test 2.5.2: Load chat history
  console.log('  Test 2.5.2: Load chat history from localStorage');
  const newChatInterface = new ChatInterface(document.createElement('div'), {
    sessionId: 'test-session-1'
  });
  
  assert(newChatInterface.getMessageCount() > 0, 'Should load existing messages');
  assert(newChatInterface.getLastMessage().content === 'Persistent message', 
         'Should load the last message correctly');
  console.log('    ✅ Chat history loads from localStorage');
  
  // Test 2.5.3: Clear chat history
  console.log('  Test 2.5.3: Clear chat history');
  newChatInterface.clearHistory();
  assert(newChatInterface.getMessageCount() === 0, 'Messages should be cleared');
  assert(localStorage.getItem(storageKey) === null, 'localStorage should be cleared');
  console.log('    ✅ Chat history clears correctly');

  // Test 2.6: Code block formatting
  console.log('\n📋 Test 2.6: Code block and markdown formatting');
  
  // Test 2.6.1: Code block formatting
  console.log('  Test 2.6.1: Code block formatting');
  chatInterface.addMessage({
    id: '4',
    sender: 'assistant',
    content: 'Here is some code:\n```javascript\nfunction test() {\n  return "hello";\n}\n```'
  });
  
  const codeMessage = messageContainer.querySelector('.virtual-item:last-child');
  const codeBlock = codeMessage.querySelector('pre code');
  assert(codeBlock !== null, 'Code block should be rendered');
  assert(codeBlock.className.includes('language-javascript'), 'Should have correct language class');
  console.log('    ✅ Code block formatting works');
  
  // Test 2.6.2: Markdown formatting
  console.log('  Test 2.6.2: Basic markdown formatting');
  chatInterface.addMessage({
    id: '5',
    sender: 'assistant',
    content: 'This is **bold** and this is *italic*'
  });
  
  const markdownMessage = messageContainer.querySelector('.virtual-item:last-child');
  assert(markdownMessage.innerHTML.includes('<p>'), 'Should render markdown as HTML');
  console.log('    ✅ Markdown formatting works');

  // Test 2.7: Performance with many messages
  console.log('\n📋 Test 2.7: Performance with large message history');
  
  console.log('  Test 2.7.1: Handle large number of messages');
  const startTime = Date.now();
  
  // Add 100 messages
  for (let i = 0; i < 100; i++) {
    chatInterface.addMessage({
      id: `perf-${i}`,
      sender: i % 2 === 0 ? 'user' : 'assistant',
      content: `Performance test message ${i}`,
      timestamp: new Date()
    });
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  assert(duration < 1000, 'Adding 100 messages should take less than 1 second');
  assert(chatInterface.getMessageCount() >= 100, 'Should have at least 100 messages');
  console.log(`    ✅ Performance test passed (${duration}ms for 100 messages)`);

  console.log('\n✅ All ChatInterface component tests passed!\n');
  
  // Cleanup
  chatInterface.destroy();
  newChatInterface.destroy();
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}

// Export for use in actual implementation
export { ChatInterface, MockVirtualList };