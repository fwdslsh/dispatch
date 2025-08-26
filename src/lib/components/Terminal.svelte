<script>
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { Xterm, XtermAddon } from '@battlefieldduck/xterm-svelte';
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

  let terminal;
  let publicUrl = null;
  let authenticated = false;
  let authKey = '';
  let isMobile = false;
  let initialViewportHeight = 0;

  const LS_KEY = 'dispatch-session-id';
  const LS_HISTORY_KEY = 'dispatch-session-history';

  let options = {
    convertEol: true,
    cursorBlink: true, // Disable cursor blinking since it's read-only
    fontFamily: 'Courier New, monospace',
    scrollback: 10000, // Enable scrollback buffer
    disableStdin: true, // Make terminal read-only
    theme: { 
      background: '#0a0a0a',
      foreground: '#ffffff',
      cursor: '#00ff88', // Hide cursor since terminal is read-only
      cursorAccent: '#0a0a0a',
      selectionBackground: 'rgba(0, 255, 136, 0.3)',
      black: '#0a0a0a',
      red: '#ff6b6b',
      green: '#00ff88',
      yellow: '#ffeb3b',
      blue: '#2196f3',
      magenta: '#e91e63',
      cyan: '#00bcd4',
      white: '#ffffff',
      brightBlack: '#666666',
      brightRed: '#ff5252',
      brightGreen: '#69f0ae',
      brightYellow: '#ffff00',
      brightBlue: '#448aff',
      brightMagenta: '#ff4081',
      brightCyan: '#18ffff',
      brightWhite: '#ffffff'
    }
  };

  async function onLoad() {
    console.debug('Terminal component has loaded');

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

    // FitAddon Usage
    const fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
    terminal.loadAddon(fitAddon);
    
    // Store fitAddon reference for keyboard handling
    terminal._fitAddon = fitAddon;
    
    // Ensure the terminal fits after DOM is ready
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    // Set up resize handling
    const resize = () => {
      fitAddon.fit();
      socket?.emit('resize', { cols: terminal.cols, rows: terminal.rows });
    };
    
    // ResizeObserver for container changes
    const ro = new ResizeObserver(resize);
    const terminalElement = terminal.element?.parentElement;
    if (terminalElement) {
      ro.observe(terminalElement);
    }
    window.addEventListener('resize', resize);

    // Store cleanup function
    terminal._cleanup = () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
    };

    // Set up socket listeners if socket is provided
    if (socket) {
      setupSocketListeners();
    }
    
    pollPublicUrl();
    const pollId = setInterval(pollPublicUrl, 10000);
    
    // Load session history from localStorage first
    const storedHistory = loadSessionHistory();
    
    // Restore terminal history - prefer stored history over initial history
    const historyToRestore = storedHistory || initialHistory || '';
    if (historyToRestore && terminal) {
      console.debug('Restoring terminal history, length:', historyToRestore.length);
      terminal.write(historyToRestore);
      
      // If we used stored history, also reconstruct the terminal buffer
      if (storedHistory) {
        const reconstructedBuffer = reconstructTerminalBuffer();
        if (onBufferUpdate) {
          onBufferUpdate(reconstructedBuffer);
        }
      }
    }
    
    // Store poll cleanup
    terminal._pollCleanup = () => clearInterval(pollId);
  }

  function onData(data) {
    console.debug('onData()', data);
    // Allow direct terminal input on desktop, mobile uses unified controls
    if (!isMobile && socket) {
      socket.emit('input', data);
      // Accumulate input characters until command is complete
      handleInputAccumulation(data);
    }
  }

  function onKey(data) {
    console.debug('onKey()', data);
    // Handle any special key combinations here if needed
  }


  function sendSpecialKey(key) {
    if (socket) {
      socket.emit('input', key);
      // Accumulate input characters until command is complete
      handleInputAccumulation(key);
    }
  }

  function sendMobileInput() {
    console.debug('Terminal: sendMobileInput called, input:', mobileInput, 'socket:', !!socket, 'socket.connected:', socket?.connected);
    if (!socket) {
      console.debug('Terminal: sendMobileInput blocked - no socket', { 
        hasInput: !!mobileInput.trim(), 
        hasSocket: !!socket,
        socketConnected: socket?.connected 
      });
      return;
    }
    
    // Only check for input content if we have some, otherwise allow empty sends (for Enter key)
    if (mobileInput.trim()) {
      const inputToSend = mobileInput;
      console.debug('Terminal: sending to PTY:', inputToSend);
      
      // Add to shared input history
      onInputEvent(inputToSend);
      
      // Send to PTY with carriage return
      socket.emit('input', inputToSend + '\r');
      handleInputAccumulation(inputToSend + '\r');
      
      // Clear input
      mobileInput = '';
      console.debug('Terminal: input cleared, new value:', mobileInput);
    } else {
      // No input content, just send enter key
      console.debug('Terminal: sending empty enter key');
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
      
      // Cleanup function
      if (terminal) {
        terminal._keyboardCleanup = () => {
          window.visualViewport.removeEventListener('resize', handleViewportChange);
        };
      }
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
      
      // Cleanup function
      if (terminal) {
        terminal._keyboardCleanup = () => {
          window.removeEventListener('resize', handleWindowResize);
        };
      }
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
    
    // Blur the textarea to ensure it's not focused
    if (overlayTextarea) {
      overlayTextarea.blur();
    }
    
    // Force layout reflow and terminal resize
    requestAnimationFrame(() => {
      // Force a reflow to trigger layout recalculation
      document.body.offsetHeight;
      
      // Small delay to ensure layout settles completely
      setTimeout(() => {
        // Force a resize to ensure terminal fits properly
        if (terminal && terminal._fitAddon) {
          terminal._fitAddon.fit();
        }
      }, 150);
    });
  }

  let currentInputBuffer = ''; // Buffer to accumulate input until Enter is pressed
  let currentOutputBuffer = ''; // Buffer to accumulate output until complete lines
  let sessionTerminalHistory = []; // Deduplicated terminal history for this session


  function pollPublicUrl() {
    if (socket) {
      socket.emit('get-public-url', (resp) => {
        if (resp.ok) {
          publicUrl = resp.url;
        }
      });
    }
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
    saveSessionHistory();
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
      console.debug('Terminal: setupSocketListeners called but no socket');
      return;
    }

    console.debug('Terminal: setting up socket listeners, socket connected:', socket.connected);

    socket.on('connect_error', (err) => {
      terminal?.writeln(`\r\n[connection error] ${err.message}\r\n`);
    });

    socket.on('output', (data) => {
      console.debug('Terminal: received output from socket:', data.length, 'chars, first 50:', data.substring(0, 50));
      terminal?.write(data);
      console.debug('Terminal: wrote to xterm, terminal exists:', !!terminal);
      
      // Save to localStorage history for persistence
      addToSessionHistory(data, 'output');
      
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
      
      // Update terminal buffer cache by getting the terminal buffer
      if (terminal && onBufferUpdate) {
        // Get the terminal buffer contents to cache
        const buffer = terminal.buffer.active;
        let historyContent = '';
        
        // Extract visible content from terminal buffer
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i);
          if (line) {
            historyContent += line.translateToString(true) + '\n';
          }
        }
        
        onBufferUpdate(historyContent);
      }
    });

    socket.on('ended', () => {
      terminal?.writeln('\r\n[session ended]\r\n');
      localStorage.removeItem(LS_KEY);
      // Clear session history when session ends
      clearSessionHistory();
      // Redirect to sessions page when session ends
      setTimeout(() => goto('/sessions'), 1000); // Small delay to show the message
    });
  }




  onDestroy(() => {
    if (terminal?._cleanup) {
      terminal._cleanup();
    }
    if (terminal?._pollCleanup) {
      terminal._pollCleanup();
    }
    if (terminal?._keyboardCleanup) {
      terminal._keyboardCleanup();
    }
    // Don't disconnect the socket as it's shared with other components
    // The session page will handle socket cleanup
  });

</script>


<div class="terminal-container">
  {#if publicUrl}
    <div class="controls">
      <div class="public-url">public: {publicUrl}</div>
    </div>
  {/if}
  
  <div class="terminal">
    <Xterm bind:terminal {options} {onLoad} {onData} {onKey} />
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
    
    .terminal :global(.xterm-viewport) {
      /* Fix mobile scrolling - ensure native scroll behavior */
      -webkit-overflow-scrolling: touch !important;
      touch-action: pan-y !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      width: 100% !important;
      max-width: 100% !important;
    }

    .terminal :global(.xterm) {
      width: 100% !important;
      max-width: 100% !important;
      pointer-events: allow !important;
      -webkit-overflow-scrolling: touch;
     :global(div) {
        pointer-events: none !important;
      }
    }
    
    
    /* When mobile keyboard is open, adjust layout but preserve scrolling */
    :global(body.keyboard-open) .terminal-container {
      height: calc(100vh - 200px); /* Use viewport height when keyboard is open */
      max-height: calc(100vh - 200px);
      overflow: hidden;
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
    overflow: hidden;
    position: relative;
  }

  .terminal :global(.xterm) {
    height: 100% !important;
    width: 100% !important;
  }

  .terminal :global(.xterm .xterm-viewport) {
    height: 100% !important;
    /* Ensure scrolling works properly */
    overflow-y: auto !important;
    scrollbar-width: thin;
  }
  
  .terminal :global(.xterm .xterm-screen) {
    /* Allow the terminal content to scroll */
    overflow-y: auto !important;
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