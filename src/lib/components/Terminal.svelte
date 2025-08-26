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

  let options = {
    convertEol: true,
    cursorBlink: true,
    fontFamily: 'Courier New, monospace',
    scrollback: 10000, // Enable scrollback buffer
    theme: { 
      background: '#0a0a0a',
      foreground: '#ffffff',
      cursor: '#00ff88',
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
    
    // Restore terminal history if available
    if (initialHistory && terminal) {
      console.debug('Restoring terminal history, length:', initialHistory.length);
      terminal.write(initialHistory);
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
    if (!mobileInput.trim() || !socket) {
      console.debug('Terminal: sendMobileInput blocked - no input or socket', { 
        hasInput: !!mobileInput.trim(), 
        hasSocket: !!socket,
        socketConnected: socket?.connected 
      });
      return;
    }
    
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
      }
      currentInputBuffer = '';
    } else if (data === '\b') {
      // Backspace - remove last character from buffer
      currentInputBuffer = currentInputBuffer.slice(0, -1);
    } else if (data === '\u001b[A' || data === '\u001b[B' || data === '\u001b[C' || data === '\u001b[D') {
      // Arrow keys - don't add to input buffer
      return;
    } else if (data === '\t' || data === '\u0003') {
      // Tab or Ctrl+C - special commands that should be saved immediately
      if (data === '\u0003') {
        onInputEvent('Ctrl+C');
      } else if (data === '\t') {
        onInputEvent('Tab');
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


  function pollPublicUrl() {
    if (socket) {
      socket.emit('get-public-url', (resp) => {
        if (resp.ok) {
          publicUrl = resp.url;
        }
      });
    }
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
  }
  
  /* Handle mobile viewport and keyboard */
  @media (max-width: 768px) {
    .terminal-container {
      height: calc(100dvh - 60px); /* Account for header height */
      position: relative;
      /* Allow touch scrolling */
      -webkit-overflow-scrolling: touch;
      touch-action: pan-y; /* Allow vertical scrolling */
    }
    
    .terminal {
      /* Enable proper touch scrolling on mobile */
      -webkit-overflow-scrolling: touch;
      touch-action: pan-y;
    }
    
    .terminal :global(.xterm-viewport) {
      /* Ensure mobile scrolling works */
      -webkit-overflow-scrolling: touch !important;
      touch-action: pan-y !important;
    }
    
    /* When mobile keyboard is open, adjust layout but preserve scrolling */
    :global(body.keyboard-open) .terminal-container {
      height: calc(100vh - 60px); /* Use viewport height when keyboard is open */
      max-height: calc(100vh - 60px);
      overflow: hidden; /* Prevent page scroll, but allow terminal scroll */
    }

    /* Ensure terminal stays visible above keyboard but remains scrollable */
    :global(body.keyboard-open) .terminal {
      height: calc(100% - 80px); /* Account for mobile controls */
      min-height: 200px; /* Minimum visible terminal height */
      /* Keep scrolling enabled even with keyboard open */
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
</style>