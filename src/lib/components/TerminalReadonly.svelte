<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { AnsiUp } from 'ansi_up';
  import MobileControls from './MobileControls.svelte';

  export let socket = null;
  export let sessionId = null;
  export let onchatclick = () => {};
  export let initialHistory = '';
  export let onInputEvent = () => {};
  export let onOutputEvent = () => {};
  export let onBufferUpdate = () => {};

  // State for unified mobile input
  let mobileInput = '';

  let terminalElement;
  let isMobile = false;
  let initialViewportHeight = 0;
  let ansiUp;

  const LS_KEY = 'dispatch-session-id';
  const LS_HISTORY_KEY = 'dispatch-session-history';
  const MAX_HISTORY_ENTRIES = 5000; // Maximum number of history entries to keep
  const MAX_BUFFER_LENGTH = 500000; // Maximum buffer length in characters (~500KB)

  let currentInputBuffer = ''; // Buffer to accumulate input until Enter is pressed
  let currentOutputBuffer = ''; // Buffer to accumulate output until complete lines
  let sessionTerminalHistory = []; // Deduplicated terminal history for this session
  let terminalContent = ''; // HTML content for display
  let rawTerminalBuffer = ''; // Raw ANSI content buffer

  onMount(() => {
    console.debug('TerminalReadonly component has mounted');

    // Initialize AnsiUp
    ansiUp = new AnsiUp();
    ansiUp.use_classes = true;

    // Check if we're on mobile
    isMobile = window.innerWidth <= 768;
    initialViewportHeight = window.innerHeight;
    
    // Update mobile state on resize
    const handleResize = () => {
      isMobile = window.innerWidth <= 768;
    };
    window.addEventListener('resize', handleResize);

    // Set up keyboard dismiss detection
    if (isMobile) {
      setupKeyboardDetection();
    }

    // Set up socket listeners if socket is provided
    if (socket) {
      setupSocketListeners();
    }
    
    // Load session history from localStorage first
    const storedHistory = loadSessionHistory();
    
    // Restore terminal history - prefer stored history over initial history
    const historyToRestore = storedHistory || initialHistory || '';
    if (historyToRestore) {
      console.debug('Restoring terminal history, length:', historyToRestore.length);
      rawTerminalBuffer = historyToRestore;
      displayContent(historyToRestore);
      
      // If we used stored history, also reconstruct the terminal buffer
      if (storedHistory) {
        const reconstructedBuffer = reconstructTerminalBuffer();
        if (onBufferUpdate) {
          onBufferUpdate(reconstructedBuffer);
        }
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  function displayContent(content) {
    if (ansiUp && content) {
      // Store raw content
      rawTerminalBuffer = content;
      
      // Process terminal control sequences
      let processedContent = processTerminalSequences(content);
      
      // Convert ANSI to HTML
      terminalContent = ansiUp.ansi_to_html(processedContent);
      
      // Auto-scroll to bottom after content update
      setTimeout(() => {
        if (terminalElement) {
          terminalElement.scrollTop = terminalElement.scrollHeight;
        }
      }, 10);
    }
  }

  function processTerminalSequences(content) {
    // More sophisticated terminal sequence processing
    
    // Step 1: Handle carriage return overwrites (for progress indicators)
    let lines = content.split('\n');
    let processedLines = [];
    
    for (let line of lines) {
      // Handle carriage return overwrites within a line
      if (line.includes('\r')) {
        // Simulate terminal behavior: \r moves cursor to beginning of line
        let segments = line.split('\r');
        let processedLine = '';
        
        for (let i = 0; i < segments.length; i++) {
          if (i === 0) {
            processedLine = segments[i];
          } else {
            // Overwrite from beginning of line
            let overwrite = segments[i];
            if (overwrite.length >= processedLine.length) {
              processedLine = overwrite;
            } else {
              // Partial overwrite
              processedLine = overwrite + processedLine.slice(overwrite.length);
            }
          }
        }
        
        processedLines.push(processedLine);
      } else {
        processedLines.push(line);
      }
    }
    
    let result = processedLines.join('\n');
    
    // Step 2: Clean up excess whitespace and control characters
    result = result
      // Remove excessive repeated characters (like progress dots)
      .replace(/([⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏])\s*\1{10,}/g, '$1') // Limit spinner repetition
      // Clean up multiple consecutive newlines (keep max 2)
      .replace(/\n{3,}/g, '\n\n');
    
    return result;
  }

  function sendSpecialKey(key) {
    if (socket) {
      socket.emit('input', key);
      // Accumulate input characters until command is complete
      handleInputAccumulation(key);
    }
  }

  function sendMobileInput() {
    console.debug('TerminalReadonly: sendMobileInput called, input:', mobileInput, 'socket:', !!socket, 'socket.connected:', socket?.connected);
    if (!socket) {
      console.debug('TerminalReadonly: sendMobileInput blocked - no socket');
      return;
    }
    
    // Only check for input content if we have some, otherwise allow empty sends (for Enter key)
    if (mobileInput.trim()) {
      const inputToSend = mobileInput;
      console.debug('TerminalReadonly: sending to PTY:', inputToSend);
      
      // Add to shared input history
      onInputEvent(inputToSend);
      
      // Send to PTY with carriage return
      socket.emit('input', inputToSend + '\r');
      handleInputAccumulation(inputToSend + '\r');
      
      // Clear input
      mobileInput = '';
      console.debug('TerminalReadonly: input cleared, new value:', mobileInput);
    } else {
      // No input content, just send enter key
      console.debug('TerminalReadonly: sending empty enter key');
      socket.emit('input', '\r');
      handleInputAccumulation('\r');
    }
  }

  function handleMobileKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMobileInput();
    }
  }
  
  function handleInputAccumulation(data) {
    if (data === '\r' || data === '\n') {
      // Command completed - save the accumulated input
      if (currentInputBuffer.trim()) {
        onInputEvent(currentInputBuffer);
        addToSessionHistory(currentInputBuffer + '\r', 'input');
      }
      currentInputBuffer = '';
    } else if (data === '\b') {
      // Backspace - remove last character from buffer
      currentInputBuffer = currentInputBuffer.slice(0, -1);
    } else if (data === '\u001b[A' || data === '\u001b[B' || data === '\u001b[C' || data === '\u001b[D') {
      // Arrow keys - don't add to input buffer, but save to history for special keys
      addToSessionHistory(data, 'input');
      return;
    } else if (data === '\t' || data === '\u0003') {
      // Tab or Ctrl+C - special commands that should be saved immediately
      if (data === '\u0003') {
        onInputEvent('Ctrl+C');
        addToSessionHistory(data, 'input');
      } else if (data === '\t') {
        onInputEvent('Tab');
        addToSessionHistory(data, 'input');
      }
    } else if (data.length === 1 && data >= ' ') {
      // Regular printable character - add to buffer
      currentInputBuffer += data;
    }
  }

  function setupKeyboardDetection() {
    let keyboardVisible = false;
    
    // Try to use Visual Viewport API first (most reliable)
    if (window.visualViewport) {
      const handleViewportChange = () => {
        const heightDiff = window.innerHeight - window.visualViewport.height;
        const wasKeyboardVisible = keyboardVisible;
        keyboardVisible = heightDiff > 150; // Threshold for keyboard detection
        
        if (keyboardVisible && !wasKeyboardVisible) {
          // Keyboard opened
          document.body.classList.add('keyboard-open');
        } else if (wasKeyboardVisible && !keyboardVisible) {
          // Keyboard was dismissed
          handleKeyboardDismiss();
        }
      };
      
      window.visualViewport.addEventListener('resize', handleViewportChange);
    } else {
      // Fallback to window resize detection
      const handleWindowResize = () => {
        const currentHeight = window.innerHeight;
        const heightDiff = initialViewportHeight - currentHeight;
        const wasKeyboardVisible = keyboardVisible;
        keyboardVisible = heightDiff > 150;
        
        if (keyboardVisible && !wasKeyboardVisible) {
          // Keyboard opened
          document.body.classList.add('keyboard-open');
        } else if (wasKeyboardVisible && !keyboardVisible) {
          // Keyboard was dismissed
          handleKeyboardDismiss();
        }
      };
      
      window.addEventListener('resize', handleWindowResize);
    }
  }

  function handleKeyboardDismiss() {
    console.debug('Keyboard dismissed');
    // Remove keyboard-open class and restore page scrolling
    document.body.classList.remove('keyboard-open');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
  }


  // Session history management functions
  function getStorageKey() {
    return `${LS_HISTORY_KEY}-${sessionId}`;
  }

  function loadSessionHistory() {
    if (!sessionId) return '';
    
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) {
        const history = JSON.parse(stored);
        if (Array.isArray(history)) {
          sessionTerminalHistory = history;
          console.debug('Loaded session history:', sessionTerminalHistory.length, 'items');
          // Reconstruct the terminal content from stored history entries
          return reconstructTerminalBuffer();
        }
      }
    } catch (error) {
      console.warn('Failed to load session history:', error);
    }
    return '';
  }

  function saveSessionHistory() {
    if (!sessionId) return;
    
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(sessionTerminalHistory));
      console.debug('Saved session history:', sessionTerminalHistory.length, 'items');
    } catch (error) {
      console.warn('Failed to save session history:', error);
    }
  }

  function addToSessionHistory(data, type = 'output') {
    if (!data || !sessionId) return;
    
    // Create a unique entry with content and metadata
    const entry = {
      type,
      content: data,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    };
    
    // Check for duplicate content (avoid adding the same data twice)
    const lastEntry = sessionTerminalHistory[sessionTerminalHistory.length - 1];
    if (lastEntry && lastEntry.content === data && lastEntry.type === type) {
      console.debug('Skipping duplicate history entry');
      return;
    }
    
    sessionTerminalHistory.push(entry);
    
    // Trim history if it exceeds limits
    trimHistoryIfNeeded();
    
    saveSessionHistory();
  }

  function trimHistoryIfNeeded() {
    // Trim by number of entries
    if (sessionTerminalHistory.length > MAX_HISTORY_ENTRIES) {
      const entriesToRemove = sessionTerminalHistory.length - MAX_HISTORY_ENTRIES;
      sessionTerminalHistory = sessionTerminalHistory.slice(entriesToRemove);
      console.debug(`Trimmed ${entriesToRemove} history entries, now have ${sessionTerminalHistory.length} entries`);
    }
    
    // Trim by total content size
    let totalSize = sessionTerminalHistory.reduce((size, entry) => size + entry.content.length, 0);
    if (totalSize > MAX_BUFFER_LENGTH) {
      // Remove entries from the beginning until we're under the limit
      while (totalSize > MAX_BUFFER_LENGTH && sessionTerminalHistory.length > 0) {
        const removedEntry = sessionTerminalHistory.shift();
        totalSize -= removedEntry.content.length;
      }
      console.debug(`Trimmed history by size, now have ${sessionTerminalHistory.length} entries (${totalSize} chars)`);
    }
  }

  function clearSessionHistory() {
    if (!sessionId) return;
    
    try {
      localStorage.removeItem(getStorageKey());
      sessionTerminalHistory = [];
      console.debug('Cleared session history');
    } catch (error) {
      console.warn('Failed to clear session history:', error);
    }
  }

  function reconstructTerminalBuffer() {
    // Rebuild terminal buffer from stored history in chronological order
    let buffer = '';
    
    // Sort by timestamp to ensure correct order
    const sortedHistory = [...sessionTerminalHistory].sort((a, b) => a.timestamp - b.timestamp);
    
    for (const entry of sortedHistory) {
      // Only include output content for terminal display
      // Input is handled by the terminal itself and shouldn't be duplicated
      if (entry.type === 'output') {
        buffer += entry.content;
      }
    }
    return buffer;
  }

  function setupSocketListeners() {
    if (!socket) {
      console.debug('TerminalReadonly: setupSocketListeners called but no socket');
      return;
    }

    console.debug('TerminalReadonly: setting up socket listeners, socket connected:', socket.connected);

    socket.on('connect_error', (err) => {
      const errorMsg = `\r\n[connection error] ${err.message}\r\n`;
      rawTerminalBuffer += errorMsg;
      displayContent(rawTerminalBuffer);
    });

    socket.on('output', (data) => {
      console.debug('TerminalReadonly: received output from socket:', data.length, 'chars, first 50:', data.substring(0, 50));
      
      // Save to localStorage history for persistence
      addToSessionHistory(data, 'output');
      
      // Add to raw buffer and display the entire reconstructed content
      rawTerminalBuffer += data;
      
      // Trim raw buffer if it gets too large
      if (rawTerminalBuffer.length > MAX_BUFFER_LENGTH) {
        // Keep the last portion of the buffer
        const keepLength = Math.floor(MAX_BUFFER_LENGTH * 0.8); // Keep 80% when trimming
        rawTerminalBuffer = rawTerminalBuffer.slice(-keepLength);
        console.debug(`Trimmed raw terminal buffer to ${rawTerminalBuffer.length} characters`);
      }
      
      displayContent(rawTerminalBuffer);
      
      // Accumulate output data for chat history
      currentOutputBuffer += data;
      
      // Check if we have complete lines (ends with newline or carriage return)
      if (data.includes('\n') || data.includes('\r')) {
        // Clean and process the accumulated output
        let cleanOutput = currentOutputBuffer
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .trim();
        
        if (cleanOutput) {
          // Add to shared output history
          onOutputEvent(cleanOutput);
        }
        
        currentOutputBuffer = '';
      }
      
      // Update terminal buffer cache
      if (onBufferUpdate) {
        const reconstructedBuffer = reconstructTerminalBuffer();
        onBufferUpdate(reconstructedBuffer);
      }
    });

    socket.on('ended', () => {
      const endMsg = '\r\n[session ended]\r\n';
      rawTerminalBuffer += endMsg;
      displayContent(rawTerminalBuffer);
      localStorage.removeItem(LS_KEY);
      // Clear session history when session ends
      clearSessionHistory();
      // Redirect to sessions page when session ends
      setTimeout(() => goto('/sessions'), 1000); // Small delay to show the message
    });
  }

  onDestroy(() => {
    
    // Clean up any remaining listeners
  });
</script>

<div class="terminal-container">
  
  <div class="terminal" bind:this={terminalElement}>
    <div class="terminal-content">
      {@html terminalContent}
    </div>
  </div>
  
  <MobileControls 
    bind:currentInput={mobileInput}
    onSendMessage={sendMobileInput}
    onKeydown={handleMobileKeydown}
    onSpecialKey={sendSpecialKey}
    onToggleView={onchatclick}
    isTerminalView={true}
    {isMobile}
  />
</div>

<style>
  .terminal-container {
    display: flex;
    flex-direction: column;
    position: relative;
    height: 570px; /* Consistent height with chat view */
  }
  
  /* Desktop layout */
  @media (min-width: 769px) {
    .terminal-container {
      height: calc(100dvh - 200px); /* Account for header + controls with grid layout */
    }
  }
  
  /* Handle mobile viewport and keyboard */
  @media (max-width: 768px) {
    .terminal-container {
      height: calc(100dvh - 100px); /* Simplified calculation for grid layout */
      position: relative;
      width: 100vw;
      max-width: 100vw;
      box-sizing: border-box;
    }
    
    .terminal {
      /* Enable proper touch scrolling on mobile */
      -webkit-overflow-scrolling: touch;
      touch-action: pan-y;
      width: 100%;
      max-width: 100%;
    }
    
    /* When mobile keyboard is open, adjust layout but preserve scrolling */
    :global(body.keyboard-open) .terminal-container {
      height: calc(100vh - 200px); /* Use viewport height when keyboard is open */
      max-height: calc(100vh - 200px);
      overflow: hidden;
    }

    /* Ensure terminal stays visible above keyboard but remains scrollable */
    :global(body.keyboard-open) .terminal {
      height: 100%;
      min-height: 200px;
      overflow-y: auto;
    }
  }
  
  /* Desktop keyboard handling */
  @media (min-width: 769px) {
    :global(body.keyboard-open) .terminal-container {
      height: calc(100vh - 200px); /* Same calculation for consistency */
      max-height: calc(100vh - 200px);
    }

    /* Ensure terminal stays visible above keyboard but remains scrollable */
    :global(body.keyboard-open) .terminal {
      height: 100%;
      min-height: 200px;
      overflow-y: auto;
    }
  }

  .terminal {
    flex: 1;
    background: var(--bg-darker);
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.2;
    padding: var(--space-md);
    color: #ffffff;
    scrollbar-width: thin;
  }

  .terminal-content {
    white-space: pre-wrap;
    word-wrap: break-word;
    min-height: 100%;
  }

  /* ANSI color classes - AnsiUp generates these */
  .terminal-content :global(.ansi-black-fg) { color: #0a0a0a; }
  .terminal-content :global(.ansi-red-fg) { color: #ff6b6b; }
  .terminal-content :global(.ansi-green-fg) { color: #00ff88; }
  .terminal-content :global(.ansi-yellow-fg) { color: #ffeb3b; }
  .terminal-content :global(.ansi-blue-fg) { color: #2196f3; }
  .terminal-content :global(.ansi-magenta-fg) { color: #e91e63; }
  .terminal-content :global(.ansi-cyan-fg) { color: #00bcd4; }
  .terminal-content :global(.ansi-white-fg) { color: #ffffff; }
  .terminal-content :global(.ansi-bright-black-fg) { color: #666666; }
  .terminal-content :global(.ansi-bright-red-fg) { color: #ff5252; }
  .terminal-content :global(.ansi-bright-green-fg) { color: #69f0ae; }
  .terminal-content :global(.ansi-bright-yellow-fg) { color: #ffff00; }
  .terminal-content :global(.ansi-bright-blue-fg) { color: #448aff; }
  .terminal-content :global(.ansi-bright-magenta-fg) { color: #ff4081; }
  .terminal-content :global(.ansi-bright-cyan-fg) { color: #18ffff; }
  .terminal-content :global(.ansi-bright-white-fg) { color: #ffffff; }

  /* Background colors */
  .terminal-content :global(.ansi-black-bg) { background-color: #0a0a0a; }
  .terminal-content :global(.ansi-red-bg) { background-color: #ff6b6b; }
  .terminal-content :global(.ansi-green-bg) { background-color: #00ff88; }
  .terminal-content :global(.ansi-yellow-bg) { background-color: #ffeb3b; }
  .terminal-content :global(.ansi-blue-bg) { background-color: #2196f3; }
  .terminal-content :global(.ansi-magenta-bg) { background-color: #e91e63; }
  .terminal-content :global(.ansi-cyan-bg) { background-color: #00bcd4; }
  .terminal-content :global(.ansi-white-bg) { background-color: #ffffff; }

  /* Text styling */
  .terminal-content :global(.ansi-bold) { font-weight: bold; }
  .terminal-content :global(.ansi-dim) { opacity: 0.7; }
  .terminal-content :global(.ansi-italic) { font-style: italic; }
  .terminal-content :global(.ansi-underline) { text-decoration: underline; }
  .terminal-content :global(.ansi-reverse) { 
    color: #0a0a0a; 
    background-color: #ffffff; 
  }

  .controls {
    padding: var(--space-sm) var(--space-md);
    background: rgba(26, 26, 26, 0.6);
    border-bottom: 1px solid var(--border);
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .public-url {
    font-family: var(--font-mono);
  }
</style>