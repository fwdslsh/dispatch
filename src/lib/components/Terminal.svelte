<script>
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { io } from 'socket.io-client';
  import { Xterm, XtermAddon } from '@battlefieldduck/xterm-svelte';

  export let sessionId = null;
  export let onchatclick = () => {};

  let terminal;
  let socket;
  let publicUrl = null;
  let authenticated = false;
  let authKey = '';
  let isMobile = false;
  let overlayTextarea;
  let initialViewportHeight = 0;

  const LS_KEY = 'dispatch-session-id';

  let options = {
    convertEol: true,
    cursorBlink: true,
    fontFamily: 'Courier New, monospace',
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
    console.log('Terminal component has loaded');

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

    connect();
    pollPublicUrl();
    const pollId = setInterval(pollPublicUrl, 10000);
    
    // Setup overlay textarea for mobile
    setTimeout(() => {
      setupOverlayTextarea();
      
      // Hook into xterm focus events to focus our overlay textarea
      if (isMobile && terminal && overlayTextarea) {
        // Use the correct xterm.js event API
        terminal.textarea?.addEventListener('focus', () => {
          setTimeout(() => overlayTextarea?.focus(), 0);
        });
      }
    }, 100);
    
    // Store poll cleanup
    terminal._pollCleanup = () => clearInterval(pollId);
  }

  function onData(data) {
    console.log('onData()', data);
    // Disable direct input on mobile - use overlay textarea instead
    if (!isMobile && socket) {
      socket.emit('input', data);
    }
  }

  function onKey(data) {
    console.log('onKey()', data);
    // Handle any special key combinations here if needed
  }


  function sendSpecialKey(key) {
    if (socket) {
      socket.emit('input', key);
    }
  }


  function setupOverlayTextarea() {
    if (!overlayTextarea || !terminal) return;

    // Setup event handlers for the overlay textarea
    overlayTextarea.addEventListener('input', (event) => {
      const inputText = event.target.value;
      if (socket) {
        // Send all new input to terminal
        socket.emit('input', inputText);
        
        // Clear the textarea to capture next input
        event.target.value = '';
      }
    });

    // Handle special keys like Enter, Backspace, etc.
    overlayTextarea.addEventListener('keydown', (event) => {
      if (socket) {
        switch (event.key) {
          case 'Enter':
            event.preventDefault();
            socket.emit('input', '\r');
            break;
          case 'Backspace':
            event.preventDefault();
            socket.emit('input', '\b');
            break;
          case 'Tab':
            event.preventDefault();
            socket.emit('input', '\t');
            break;
          case 'ArrowUp':
            event.preventDefault();
            socket.emit('input', '\u001b[A');
            break;
          case 'ArrowDown':
            event.preventDefault();
            socket.emit('input', '\u001b[B');
            break;
          case 'ArrowRight':
            event.preventDefault();
            socket.emit('input', '\u001b[C');
            break;
          case 'ArrowLeft':
            event.preventDefault();
            socket.emit('input', '\u001b[D');
            break;
          default:
            // Let regular characters go through the input event
            break;
        }
      }
    });

    // Focus textarea when terminal is clicked/focused
    overlayTextarea.addEventListener('focus', () => {
      if (isMobile) {
        document.body.classList.add('keyboard-open');
        // Prevent page scrolling
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
      }
    });

    overlayTextarea.addEventListener('blur', () => {
      if (isMobile) {
        document.body.classList.remove('keyboard-open');
        // Restore page scrolling
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      }
    });
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
    console.log('Keyboard dismissed');
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

  let isSelecting = false;
  let startX = 0;
  let startY = 0;

  function handleTerminalTap(event) {
    // Check if user is trying to select text or click a link
    if (event.detail > 1) {
      // Double click or more - likely text selection
      return;
    }

    // If there's a text selection, don't interfere
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }

    if (isMobile && overlayTextarea && !isSelecting) {
      overlayTextarea.focus();
    }
  }

  function handleMouseDown(event) {
    startX = event.clientX;
    startY = event.clientY;
    isSelecting = false;
  }

  function handleMouseMove(event) {
    if (!isSelecting) {
      const deltaX = Math.abs(event.clientX - startX);
      const deltaY = Math.abs(event.clientY - startY);
      if (deltaX > 5 || deltaY > 5) {
        isSelecting = true;
      }
    }
  }

  function handleMouseUp() {
    setTimeout(() => {
      isSelecting = false;
    }, 100);
  }


  function pollPublicUrl() {
    if (socket) {
      socket.emit('get-public-url', (resp) => {
        if (resp.ok) {
          publicUrl = resp.url;
        }
      });
    }
  }

  function authenticate() {
    if (!socket || !authKey.trim()) return;
    
    socket.emit('auth', authKey, (resp) => {
      if (resp.ok) {
        authenticated = true;
        localStorage.setItem('dispatch-auth-token', authKey);
        connectToSession();
      } else {
        localStorage.removeItem('dispatch-auth-token');
        goto('/');
      }
    });
  }

  function connect() {
    socket = io({
      transports: ['websocket', 'polling']
    });

    socket.on('connect_error', (err) => {
      terminal?.writeln(`\r\n[connection error] ${err.message}\r\n`);
    });

    socket.on('output', (data) => {
      terminal?.write(data);
    });

    socket.on('ended', () => {
      terminal?.writeln('\r\n[session ended]\r\n');
      localStorage.removeItem(LS_KEY);
      // Redirect to sessions page when session ends
      setTimeout(() => goto('/sessions'), 1000); // Small delay to show the message
    });

    socket.on('connect', () => {
      const storedAuth = localStorage.getItem('dispatch-auth-token');
      if (storedAuth) {
        authKey = storedAuth;
        authenticate();
      }
    });
  }

  function connectToSession() {
    if (!socket || !authenticated) return;

    const dims = { cols: terminal.cols, rows: terminal.rows };

    if (sessionId) {
      socket.emit('attach', { sessionId, ...dims }, (resp) => {
        if (!resp || !resp.ok) {
          // failed to attach, redirect to sessions page
          goto('/sessions');
        }
      });
    } else {
      // No sessionId provided, redirect to sessions page
      goto('/sessions');
    }
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
    socket?.emit('detach');
    socket?.disconnect();
  });

</script>


<div class="terminal-container">
  {#if publicUrl}
    <div class="controls">
      <div class="public-url">public: {publicUrl}</div>
    </div>
  {/if}
  
  <div 
    class="terminal" 
    on:click={handleTerminalTap} 
    on:keydown={handleTerminalTap} 
    on:mousedown={handleMouseDown}
    on:mousemove={handleMouseMove}
    on:mouseup={handleMouseUp}
    role="button" 
    tabindex="0" 
    aria-label="Terminal - tap to open keyboard"
  >
    <Xterm bind:terminal {options} {onLoad} {onData} {onKey} />
    
    {#if isMobile}
      <!-- Overlay textarea for capturing native keyboard input -->
      <textarea
        bind:this={overlayTextarea}
        class="overlay-textarea"
        class:selection-mode={isSelecting}
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        inputmode="text"
        enterkeyhint="send"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        aria-label="Terminal input"
      ></textarea>
    {/if}
  </div>
  
  {#if isMobile}
    <div class="mobile-controls">
      <div class="mobile-toolbar">
        <button class="key-button" on:click={() => sendSpecialKey('\t')} title="Tab" aria-label="Send Tab key">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <path d="M8 10h6"/>
          </svg>
        </button>
        <button class="key-button" on:click={() => sendSpecialKey('\u0003')} title="Ctrl+C" aria-label="Send Ctrl+C">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <button class="key-button" on:click={() => sendSpecialKey('\u001b[A')} title="Up arrow" aria-label="Send Up arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
        </button>
        <button class="key-button" on:click={() => sendSpecialKey('\u001b[B')} title="Down arrow" aria-label="Send Down arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
        </button>
        <button class="key-button chat-button" on:click={onchatclick} title="Switch to Chat" aria-label="Switch to Chat view">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>

  .terminal-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    position: relative;
  }
  
  /* Handle mobile viewport and keyboard */
  @media (max-width: 768px) {
    .terminal-container {
      height: calc(100dvh - 60px); /* Account for header height */
      position: relative;
    }
    
    /* When mobile keyboard is open, use visual viewport height */
    :global(body.keyboard-open) .terminal-container {
      height: calc(100vh - 60px); /* Use viewport height when keyboard is open */
      max-height: calc(100vh - 60px);
      overflow: hidden;
    }

    /* Ensure terminal stays visible above keyboard */
    :global(body.keyboard-open) .terminal {
      height: calc(100% - 80px); /* Account for mobile controls */
      min-height: 200px; /* Minimum visible terminal height */
    }
  }

  .terminal {
    flex: 1;
    background: var(--bg-darker);
    height: 100%;
    overflow: hidden;
  }

  .terminal :global(.xterm) {
    height: 100% !important;
  }

  .terminal :global(.xterm .xterm-viewport) {
    height: 100% !important;
  }

  .overlay-textarea {
    position: absolute;
    top: 80px;
    left: 0;
    width: 100%;
    height: calc(100% - 160px); /* Don't cover mobile toolbar */
    opacity: 0;
    z-index: 1000;
    resize: none;
    border: none;
    background: transparent;
    color: transparent;
    caret-color: transparent;
    outline: none;
    font-size: 16px; /* Prevent zoom on iOS */
    pointer-events: auto;
  }

  /* When in selection mode, allow pointer events to pass through to terminal */
  .overlay-textarea.selection-mode {
    pointer-events: none;
  }

  /* Chat button styling */
  .chat-button {
    color: var(--primary) !important;
  }

  .chat-button:hover {
    color: var(--text-primary) !important;
    background: rgba(0, 255, 136, 0.1) !important;
  }

  .mobile-controls {
    background: var(--surface);
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1001; /* Above overlay textarea */
    min-height: 80px;
  }

  .mobile-toolbar {
    display: flex;
    gap: var(--space-xs);
    padding: var(--space-md);
    justify-content: space-evenly;
    border-bottom: 1px solid var(--border);
  }

  .key-button {
    background: transparent !important;
    color: var(--text-secondary) !important;
    border: none !important;
    border-radius: 8px !important;
    padding: var(--space-md) !important;
    min-width: 44px !important;
    min-height: 44px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all 0.2s ease !important;
  }

  .key-button:hover,
  .key-button:active {
    background: var(--surface-hover) !important;
    color: var(--text-primary) !important;
    transform: none !important;
    box-shadow: none !important;
  }

  .key-button svg {
    width: 20px;
    height: 20px;
    stroke-width: 2;
  }



</style>