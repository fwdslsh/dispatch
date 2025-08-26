<script>
  import { onMount } from 'svelte';
  import AnsiUp from 'ansi-up';

  export let socket = null;
  export let sessionId = null;

  let chatMessages = [];
  let currentInput = '';
  let currentOutput = '';
  let chatContainer;
  let ansiUp;

  onMount(() => {
    ansiUp = new AnsiUp();
    // Configure AnsiUp for better terminal output
    ansiUp.use_classes = true; // Use CSS classes instead of inline styles
    
    // Initialize with welcome message
    chatMessages = [{
      type: 'system',
      content: 'Chat view enabled. Commands will appear as messages below.',
      timestamp: new Date()
    }];

    // Set up socket event listener for output
    if (socket) {
      socket.on('output', handleChatOutput);
    }
  });

  function handleChatOutput(data) {
    // Accumulate output data
    currentOutput += data;
    
    // Check if we have a complete line (ends with newline or carriage return)
    if (data.includes('\n') || data.includes('\r')) {
      // Clean and process the accumulated output
      let cleanOutput = currentOutput
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();
      
      if (cleanOutput) {
        // Convert ANSI codes to HTML
        const htmlOutput = ansiUp.ansi_to_html(cleanOutput);
        
        // Add output as assistant message
        chatMessages = [...chatMessages, {
          type: 'assistant',
          content: htmlOutput,
          isHtml: true, // Flag to indicate this content is HTML
          timestamp: new Date()
        }];
        
        // Scroll to bottom
        setTimeout(() => scrollChatToBottom(), 100);
      }
      
      currentOutput = '';
    }
  }

  function sendChatMessage() {
    if (!currentInput.trim() || !socket) return;
    
    // Add user message to chat
    chatMessages = [...chatMessages, {
      type: 'user',
      content: currentInput,
      timestamp: new Date()
    }];
    
    // Send to PTY
    socket.emit('input', currentInput + '\r');
    
    // Clear input
    currentInput = '';
    
    // Scroll to bottom
    setTimeout(() => scrollChatToBottom(), 100);
  }

  function scrollChatToBottom() {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  function handleChatKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  }

  function sendSpecialKey(key) {
    if (socket) {
      socket.emit('input', key);
    }
  }

  // Cleanup socket listener on destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    if (socket) {
      socket.off('output', handleChatOutput);
    }
  });
</script>

<div class="chat-view">
  <div class="chat-header">
    <div class="chat-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      Chat Mode
    </div>
    <div class="chat-controls">
      <button class="special-key-btn" on:click={() => sendSpecialKey('\t')} title="Send Tab">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="3" y="5" width="18" height="14" rx="2"/>
          <path d="M8 10h6"/>
        </svg>
      </button>
      <button class="special-key-btn" on:click={() => sendSpecialKey('\u0003')} title="Send Ctrl+C">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
      <slot name="toggle-button"></slot>
    </div>
  </div>
  
  <div class="chat-messages" bind:this={chatContainer}>
    {#each chatMessages as message}
      <div class="message {message.type}">
        <div class="message-content">
          {#if message.type === 'system'}
            <div class="system-message">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{message.content}</span>
            </div>
          {:else if message.isHtml}
            <div class="message-html" {@html message.content}></div>
          {:else}
            <pre class="message-text">{message.content}</pre>
          {/if}
        </div>
        <div class="message-time">
          {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      </div>
    {/each}
  </div>
  
  <div class="chat-input-container">
    <div class="chat-input-wrapper">
      <textarea
        bind:value={currentInput}
        on:keydown={handleChatKeydown}
        placeholder="Type your command..."
        class="chat-input"
        rows="1"
        autocomplete="off"
        autocapitalize="none"
        autocorrect="off"
        spellcheck="false"
        inputmode="text"
        enterkeyhint="send"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
      ></textarea>
      <button class="chat-send" on:click={sendChatMessage} disabled={!currentInput.trim()} aria-label="Send message">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>
        </svg>
      </button>
    </div>
  </div>
</div>

<style>
  /* Chat View Styles */
  .chat-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-darker);
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  .chat-title {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-weight: bold;
  }

  .chat-title svg {
    width: 18px;
    height: 18px;
    color: var(--primary);
  }

  .chat-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .special-key-btn {
    background: transparent !important;
    border: 1px solid var(--border) !important;
    border-radius: 6px !important;
    padding: var(--space-xs) !important;
    color: var(--text-secondary) !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 32px;
    min-height: 32px;
  }

  .special-key-btn:hover {
    background: var(--surface-hover) !important;
    color: var(--text-primary) !important;
    border-color: var(--border-light) !important;
  }

  .special-key-btn svg {
    width: 16px;
    height: 16px;
    stroke-width: 2;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .message {
    display: flex;
    flex-direction: column;
    max-width: 85%;
  }

  .message.user {
    align-self: flex-end;
    align-items: flex-end;
  }

  .message.assistant {
    align-self: flex-start;
    align-items: flex-start;
  }

  .message.system {
    align-self: center;
    align-items: center;
    max-width: 100%;
  }

  .message-content {
    background: rgba(26, 26, 26, 0.6);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: var(--space-md);
    backdrop-filter: blur(10px);
    position: relative;
  }

  .message.user .message-content {
    background: rgba(0, 255, 136, 0.1);
    border-color: rgba(0, 255, 136, 0.3);
  }

  .message.assistant .message-content {
    background: rgba(42, 42, 42, 0.6);
    border-color: var(--border-light);
  }

  .message.system .message-content {
    background: rgba(255, 107, 107, 0.1);
    border-color: rgba(255, 107, 107, 0.3);
  }

  .message-text {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    line-height: 1.4;
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    color: var(--text-primary);
  }

  .message-html {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    line-height: 1.4;
    color: var(--text-primary);
  }

  /* ANSI color classes for terminal output */
  .message-html :global(.ansi-black-fg) { color: #000000; }
  .message-html :global(.ansi-red-fg) { color: #ff6b6b; }
  .message-html :global(.ansi-green-fg) { color: #00ff88; }
  .message-html :global(.ansi-yellow-fg) { color: #ffeb3b; }
  .message-html :global(.ansi-blue-fg) { color: #2196f3; }
  .message-html :global(.ansi-magenta-fg) { color: #e91e63; }
  .message-html :global(.ansi-cyan-fg) { color: #00bcd4; }
  .message-html :global(.ansi-white-fg) { color: #ffffff; }
  .message-html :global(.ansi-bright-black-fg) { color: #666666; }
  .message-html :global(.ansi-bright-red-fg) { color: #ff5252; }
  .message-html :global(.ansi-bright-green-fg) { color: #69f0ae; }
  .message-html :global(.ansi-bright-yellow-fg) { color: #ffff00; }
  .message-html :global(.ansi-bright-blue-fg) { color: #448aff; }
  .message-html :global(.ansi-bright-magenta-fg) { color: #ff4081; }
  .message-html :global(.ansi-bright-cyan-fg) { color: #18ffff; }
  .message-html :global(.ansi-bright-white-fg) { color: #ffffff; }
  
  .message-html :global(.ansi-bold) { font-weight: bold; }
  .message-html :global(.ansi-dim) { opacity: 0.7; }
  .message-html :global(.ansi-underline) { text-decoration: underline; }

  .system-message {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-style: italic;
  }

  .system-message svg {
    width: 16px;
    height: 16px;
    color: var(--secondary);
  }

  .message-time {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: var(--space-xs);
    font-family: var(--font-mono);
  }

  .chat-input-container {
    padding: var(--space-md);
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .chat-input-wrapper {
    display: flex;
    align-items: flex-end;
    gap: var(--space-md);
    background: var(--bg-darker);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: var(--space-md);
  }

  .chat-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 1rem;
    line-height: 1.4;
    resize: none;
    min-height: 20px;
    max-height: 120px;
  }

  .chat-input:focus {
    outline: none;
  }

  .chat-input::placeholder {
    color: var(--text-muted);
  }

  .chat-send {
    background: var(--primary) !important;
    color: var(--bg-dark) !important;
    border: none !important;
    border-radius: 8px !important;
    padding: var(--space-sm) !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 36px;
    min-height: 36px;
    flex-shrink: 0;
  }

  .chat-send:hover:not(:disabled) {
    background: var(--text-primary) !important;
  }

  .chat-send:disabled {
    background: var(--text-muted) !important;
    cursor: not-allowed !important;
  }

  .chat-send svg {
    width: 18px;
    height: 18px;
  }

  /* Mobile optimizations for chat */
  @media (max-width: 768px) {
    .chat-messages {
      padding: var(--space-sm);
      gap: var(--space-md);
    }
    
    .message {
      max-width: 90%;
    }
    
    .chat-input-container {
      padding: var(--space-sm);
    }
    
    .special-key-btn {
      min-width: 40px !important;
      min-height: 40px !important;
    }
  }
</style>