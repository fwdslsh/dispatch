<script>
  import { onMount } from 'svelte';
  import { AnsiUp } from 'ansi_up';
  import MobileControls from './MobileControls.svelte';

  export let socket = null;
  export let sessionId = null;
  export let initialHistory = { chatMessages: [], currentInput: '', currentOutput: '' };
  export let onInputEvent = () => {};
  export let onOutputEvent = () => {};
  export let onterminalclick = () => {};
  
  // Export functions for mobile controls
  export let onSendMessage = sendChatMessage;
  export let onKeydown = handleChatKeydown;

  let chatMessages = [{
    type: 'system',
    content: 'Chat view enabled. Commands will appear as messages below.',
    timestamp: new Date()
  }]; // Start with welcome message
  
  let isMobile = false;
  let currentInput = '';
  let chatContainer;
  let ansiUp;

  onMount(() => {
    ansiUp = new AnsiUp();
    // Configure AnsiUp for better terminal output
    ansiUp.use_classes = true; // Use CSS classes instead of inline styles
    
    // Check if we're on mobile
    isMobile = window.innerWidth <= 768;
    
    // Update mobile state on resize
    const handleResize = () => {
      isMobile = window.innerWidth <= 768;
    };
    window.addEventListener('resize', handleResize);
    
    // Scroll to bottom after loading
    setTimeout(() => scrollChatToBottom(), 100);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });
  
  // Reactively update chat messages when history changes
  $: if (initialHistory) {
    console.debug('Chat component reactive update triggered:', initialHistory);
    if (initialHistory.chatMessages && initialHistory.chatMessages.length > 0) {
      console.debug('Setting chat messages:', initialHistory.chatMessages.length, 'messages');
      chatMessages = [...initialHistory.chatMessages]; // Create new array to ensure reactivity
      currentInput = initialHistory.currentInput || '';
      console.debug('Chat messages now:', chatMessages.length);
      // Scroll to bottom when history updates
      setTimeout(() => scrollChatToBottom(), 50);
    } else {
      console.debug('No chat messages in initialHistory, keeping welcome message');
      // Keep the welcome message that was set during initialization
    }
  }

  // Chat component no longer processes socket output directly
  // It only displays messages from the shared history
  // The Terminal component handles socket output and updates shared history

  function sendChatMessage() {
    console.debug('Chat: sendChatMessage called, input:', currentInput);
    if (!currentInput.trim() || !socket) {
      console.debug('Chat send blocked - no input or socket');
      return;
    }
    
    const inputToSend = currentInput;
    console.debug('Chat: sending message:', inputToSend);
    
    // Add to shared input history - this will trigger a reactive update
    onInputEvent(inputToSend);
    
    // Send to PTY
    socket.emit('input', inputToSend + '\r');
    console.debug('Emitted input to socket:', inputToSend + '\\r');
    
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

  // No socket cleanup needed since Chat doesn't listen to socket output
</script>

<div class="chat-view">
  
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
            <div class="message-html">{@html message.content}</div>
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
  
  
  <MobileControls 
    bind:currentInput={currentInput}
    onSendMessage={sendChatMessage}
    onKeydown={handleChatKeydown}
    onSpecialKey={sendSpecialKey}
    onToggleView={onterminalclick}
    isTerminalView={false}
    {isMobile}
  />
</div>

<style>
  /* Chat View Styles */
  .chat-view {
    display: flex;
    flex-direction: column;
    height: 570px;
    overflow-x: hidden; /* Prevent horizontal scroll */
    transition: height 0.3s ease;
  }

  /* Desktop layout - match terminal height */
  @media (min-width: 800px) {
    .chat-view {
      height: 80svh;
    }
  }


  .chat-messages {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden; /* Prevent horizontal scroll */
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    min-height: 0; /* Allow flex child to shrink below content size */
    max-height: 100%; /* Prevent overflow beyond container */
    width: 100%; /* Ensure full width */
  }

  .message {
    display: flex;
    flex-direction: column;
    max-width: 85%;
    word-wrap: break-word; /* Prevent long words from causing horizontal scroll */
    overflow-wrap: break-word;
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
    overflow-wrap: break-word; /* Prevent horizontal overflow */
    word-break: break-word;
    max-width: 100%;
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
    overflow-wrap: break-word;
    word-break: break-word;
    color: var(--text-primary);
    max-width: 100%;
  }

  .message-html {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    line-height: 1.4;
    color: var(--text-primary);
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: pre-wrap;
    max-width: 100%;
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


  /* Mobile optimizations for chat */
  @media (max-width: 768px) {
    .chat-view {
      height: calc(100dvh - 100px); /* Account for header (60px) + mobile controls (120px) */
      overflow: hidden;
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    .chat-messages {
      row-gap: var(--space-md);
      min-height: 0;
      flex: 1;
      box-sizing: border-box;
    }
    
    .message {
      max-width: 95%; /* More space on mobile */
      min-width: 0; /* Allow messages to shrink */
    }
    
    .message-content {
      max-width: 100%;
      overflow-wrap: anywhere; /* Aggressive word breaking on mobile */
    }
  }
  

</style>