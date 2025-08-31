<script>
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import VirtualList from 'svelte-virtual-list';
  import { marked } from 'marked';
  import Prism from 'prismjs';
  import 'prismjs/components/prism-javascript.js';
  import 'prismjs/components/prism-typescript.js';
  import 'prismjs/components/prism-python.js';
  import 'prismjs/components/prism-bash.js';
  import 'prismjs/components/prism-json.js';
  import { getClaudeAuthContext } from '$lib/contexts/claude-auth-context.svelte.js';

  // Props
  export let sessionId = 'default';
  export let onSendMessage = () => {};
  export let height = '400px';

  // Chat state
  let messages = $state([]);
  let typing = $state(false);
  let messageInput = $state('');
  let messageContainer;
  let virtualList;
  
  // Get Claude auth context
  const claudeAuth = getClaudeAuthContext();

  // Initialize marked configuration
  onMount(() => {
    marked.setOptions({
      highlight: function(code, lang) {
        if (lang && Prism.languages[lang]) {
          return Prism.highlight(code, Prism.languages[lang], lang);
        }
        return code;
      },
      breaks: true,
      gfm: true
    });

    loadChatHistory();
  });

  // Auto-scroll to bottom after updates
  afterUpdate(() => {
    if (virtualList) {
      scrollToBottom();
    }
  });

  /**
   * Load chat history from localStorage
   */
  function loadChatHistory() {
    if (typeof window === 'undefined') return;
    
    const key = `chat-history-${sessionId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        messages = JSON.parse(stored);
      } catch (error) {
        console.warn('Failed to load chat history:', error);
        messages = [];
      }
    }
  }

  /**
   * Save chat history to localStorage
   */
  function saveChatHistory() {
    if (typeof window === 'undefined') return;
    
    const key = `chat-history-${sessionId}`;
    try {
      localStorage.setItem(key, JSON.stringify(messages));
    } catch (error) {
      console.warn('Failed to save chat history:', error);
    }
  }

  /**
   * Add a message to the chat
   */
  export function addMessage(message) {
    const newMessage = {
      id: message.id || Date.now().toString(),
      sender: message.sender,
      content: message.content,
      timestamp: message.timestamp || new Date(),
      ...message
    };
    
    messages = [...messages, newMessage];
    saveChatHistory();
  }

  /**
   * Set typing indicator state
   */
  export function setTyping(isTyping) {
    typing = isTyping;
  }

  /**
   * Send a message
   */
  function sendMessage() {
    const content = messageInput.trim();
    if (!content) return;

    const message = {
      id: Date.now().toString(),
      sender: 'user',
      content,
      timestamp: new Date()
    };

    addMessage(message);
    onSendMessage(message);
    messageInput = '';
  }

  /**
   * Handle Enter key in textarea
   */
  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  /**
   * Format message content with markdown and syntax highlighting
   */
  function formatMessageContent(content) {
    // Handle code blocks with syntax highlighting
    if (content.includes('```')) {
      return formatCodeBlocks(content);
    }
    
    // Regular markdown parsing
    return marked.parse(content);
  }

  /**
   * Format code blocks with syntax highlighting
   */
  function formatCodeBlocks(content) {
    return content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
      const lang = language || 'text';
      let highlighted = code;
      
      if (lang && Prism.languages[lang]) {
        highlighted = Prism.highlight(code, Prism.languages[lang], lang);
      }
      
      return `<pre class="code-block"><code class="language-${lang}">${highlighted}</code></pre>`;
    });
  }

  /**
   * Format timestamp for display
   */
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Scroll to bottom of message list
   */
  function scrollToBottom() {
    if (virtualList) {
      virtualList.scrollTo(messages.length - 1);
    }
  }

  /**
   * Clear chat history
   */
  export function clearHistory() {
    messages = [];
    const key = `chat-history-${sessionId}`;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  }

  /**
   * Query Claude with the given prompt
   */
  async function queryClaude(prompt) {
    if (!claudeAuth.authenticated) {
      addMessage({
        sender: 'assistant',
        content: 'Not authenticated with Claude CLI. Please run: `claude-code login`'
      });
      return;
    }

    setTyping(true);
    
    try {
      const response = await claudeAuth.query(prompt);
      addMessage({
        sender: 'assistant',
        content: response
      });
    } catch (error) {
      console.error('Claude query failed:', error);
      addMessage({
        sender: 'assistant',
        content: `Error: ${error.message}`
      });
    } finally {
      setTyping(false);
    }
  }

  // Prepare items for virtual list
  $: virtualItems = [
    ...messages.map(msg => ({ type: 'message', data: msg })),
    ...(typing ? [{ type: 'typing', data: {} }] : [])
  ];
</script>

<div class="chat-interface" style="height: {height}">
  <!-- Messages container with virtual scrolling -->
  <div class="messages-container" bind:this={messageContainer}>
    <VirtualList 
      bind:this={virtualList}
      items={virtualItems} 
      let:item 
      itemHeight={60}
    >
      {#if item.type === 'message'}
        <div class="message-wrapper">
          <div class="message {item.data.sender}">
            <div class="message-content">
              {@html formatMessageContent(item.data.content)}
            </div>
            <div class="message-timestamp">
              {formatTimestamp(item.data.timestamp)}
            </div>
          </div>
        </div>
      {:else if item.type === 'typing'}
        <div class="message-wrapper">
          <div class="message assistant">
            <div class="typing-indicator">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>
          </div>
        </div>
      {/if}
    </VirtualList>
  </div>

  <!-- Input area -->
  <div class="input-area" data-augmented-ui="tl-clip br-clip border">
    <textarea
      bind:value={messageInput}
      on:keydown={handleKeyDown}
      placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
      class="message-input"
      rows="1"
    ></textarea>
    <button
      on:click={sendMessage}
      disabled={!messageInput.trim() || !claudeAuth.authenticated}
      class="send-button"
      data-augmented-ui="tl-clip br-clip border"
    >
      Send
    </button>
  </div>

  <!-- Authentication status -->
  {#if !claudeAuth.authenticated}
    <div class="auth-warning" data-augmented-ui="border">
      <span>⚠️ Not authenticated with Claude CLI</span>
      <small>Run <code>claude-code login</code> to enable chat</small>
    </div>
  {/if}
</div>

<style>
  .chat-interface {
    display: flex;
    flex-direction: column;
    background: var(--bg-darker);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    font-family: var(--font-sans);
  }

  .messages-container {
    flex: 1;
    overflow: hidden;
    background: var(--bg-dark);
  }

  :global(.chat-interface .svelte-virtual-list-viewport) {
    height: 100% !important;
  }

  :global(.chat-interface .svelte-virtual-list-contents) {
    padding: var(--space-sm);
  }

  .message-wrapper {
    margin-bottom: var(--space-sm);
    min-height: 60px;
    display: flex;
    align-items: flex-start;
  }

  .message {
    max-width: 80%;
    padding: var(--space-sm) var(--space-md);
    border-radius: 12px;
    position: relative;
    word-wrap: break-word;
    hyphens: auto;
  }

  .message.user {
    background: var(--primary);
    color: var(--bg-dark);
    margin-left: auto;
    text-align: right;
  }

  .message.assistant {
    background: var(--surface);
    color: var(--text-primary);
    margin-right: auto;
  }

  .message-content :global(p) {
    margin: 0;
    line-height: 1.4;
  }

  .message-content :global(pre) {
    margin: var(--space-xs) 0;
    padding: var(--space-sm);
    background: var(--bg-darker);
    border-radius: 6px;
    overflow-x: auto;
    border: 1px solid var(--border);
  }

  .message-content :global(code) {
    font-family: var(--font-mono);
    font-size: 0.9em;
  }

  .message-content :global(p code) {
    background: var(--bg-darker);
    padding: 2px 4px;
    border-radius: 3px;
    border: 1px solid var(--border);
  }

  .message-timestamp {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: var(--space-xs);
  }

  .message.user .message-timestamp {
    text-align: right;
  }

  .typing-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-sm);
  }

  .typing-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--primary);
    animation: typing-pulse 1.4s infinite ease-in-out;
  }

  .typing-dot:nth-child(1) { animation-delay: -0.32s; }
  .typing-dot:nth-child(2) { animation-delay: -0.16s; }

  @keyframes typing-pulse {
    0%, 80%, 100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .input-area {
    display: flex;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: var(--surface);
    align-items: flex-end;
  }

  .message-input {
    flex: 1;
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: var(--space-sm) var(--space-md);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 0.9rem;
    line-height: 1.4;
    resize: vertical;
    min-height: 38px;
    max-height: 120px;
  }

  .message-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-muted);
  }

  .message-input::placeholder {
    color: var(--text-muted);
  }

  .send-button {
    background: var(--primary-gradient);
    color: var(--bg-dark);
    border: none;
    padding: var(--space-sm) var(--space-lg);
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: var(--font-sans);
  }

  .send-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--primary-muted);
  }

  .send-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .auth-warning {
    background: var(--secondary-muted);
    color: var(--text-primary);
    padding: var(--space-sm) var(--space-md);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .auth-warning code {
    background: var(--bg-darker);
    padding: 2px 4px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }

  .auth-warning small {
    color: var(--text-secondary);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .message {
      max-width: 90%;
    }
    
    .input-area {
      padding: var(--space-sm);
    }
    
    .send-button {
      padding: var(--space-sm);
    }
  }
</style>