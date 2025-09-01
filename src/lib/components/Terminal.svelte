<script>
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Xterm, XtermAddon } from '@battlefieldduck/xterm-svelte';
  import { LinkDetector } from '../services/link-detector.js';
  import { TERMINAL_CONFIG, STORAGE_CONFIG } from '../config/constants.js';
  import { SafeStorage, ErrorHandler } from '../utils/error-handling.js';
  import { TerminalHistoryService } from '../services/terminal-history.js';
  import { createCleanupManager } from '../utils/cleanup-manager.js';

  export let socket = null;
  export let sessionId = null;
  export let onchatclick = () => {};
  export let initialHistory = '';
  export let onInputEvent = () => {};
  export let onOutputEvent = () => {};
  export let onBufferUpdate = () => {};
  
  // Self-contained mode - create own socket/session if not provided
  let ownSocket = null;
  let ownSessionId = null;

  let terminal;
  let linkDetector = null;
  let isInitialized = false;
  let historyService = null;
  let cleanupManager = null;

  const LS_KEY = STORAGE_CONFIG.SESSION_ID_KEY;
  const LS_HISTORY_KEY = 'dispatch-session-history';
  const MAX_HISTORY_ENTRIES = TERMINAL_CONFIG.MAX_HISTORY_ENTRIES;
  const MAX_BUFFER_LENGTH = TERMINAL_CONFIG.MAX_BUFFER_LENGTH;

  let options = {
    convertEol: true,
    cursorBlink: true, // Disable cursor blinking since it's read-only
    fontFamily: 'Courier New, monospace',
    scrollback: 10000, // Enable scrollback buffer
    disableStdin: false, // Make terminal read-only
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

  onMount(async () => {
    console.debug('Terminal mount - initializing terminal');
    
    // Initialize cleanup manager
    cleanupManager = createCleanupManager('Terminal');
    
    // If no socket/session provided, create our own (self-contained mode)
    if (!socket || !sessionId) {
      await createOwnSocketAndSession();
    }
    
    // Initialize history service
    const activeSessionId = getActiveSessionId();
    if (activeSessionId) {
      historyService = new TerminalHistoryService(activeSessionId);
      cleanupManager.register(() => {
        if (historyService) {
          historyService.destroy();
        }
      }, 'history-service');
    }
  });
  
  async function createOwnSocketAndSession() {
    console.debug('Terminal: Creating own socket and session (self-contained mode)');
    
    // Import io here to avoid issues if not available
    const { io } = await import('socket.io-client');
    
    // Create socket connection
    ownSocket = io({ transports: ["websocket", "polling"] });
    
    // Get auth key from localStorage
    const storedAuth = localStorage.getItem("dispatch-auth-token");
    const authKey = storedAuth === "no-auth" ? "" : storedAuth || "";
    
    // Authenticate
    ownSocket.emit("auth", authKey, (res) => {
      console.debug("Terminal: Self-contained auth response:", res);
      if (res && res.ok) {
        // Create new session
        const dims = TERMINAL_CONFIG.DEFAULT_DIMENSIONS;
        ownSocket.emit("create", { mode: 'shell', ...dims }, (resp) => {
          if (resp && resp.ok) {
            ownSessionId = resp.sessionId;
            console.debug("Terminal: Created own session:", ownSessionId);
          } else {
            console.error("Terminal: Failed to create session:", resp);
          }
        });
      }
    });
  }

  // Helper functions to get the active socket and session
  function getActiveSocket() {
    return socket || ownSocket;
  }
  
  function getActiveSessionId() {
    return sessionId || ownSessionId;
  }

  async function setupTerminalAddons() {
    const fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
    terminal.loadAddon(fitAddon);
    
    // Store fitAddon reference for keyboard handling
    terminal._fitAddon = fitAddon;
    
    // Ensure the terminal fits after DOM is ready
    const timeoutId = cleanupManager.setTimeout(() => {
      fitAddon.fit();
    }, TERMINAL_CONFIG.FIT_DELAY_MS);

    return fitAddon;
  }

  function setupResizeHandling(fitAddon) {
    const resize = () => {
      fitAddon.fit();
      const activeSocket = getActiveSocket();
      activeSocket?.emit('resize', { cols: terminal.cols, rows: terminal.rows });
    };
    
    // ResizeObserver for container changes
    const ro = new ResizeObserver(resize);
    const terminalElement = terminal.element?.parentElement;
    if (terminalElement) {
      ro.observe(terminalElement);
    }
    
    // Use cleanup manager for event listeners and observers
    cleanupManager.addEventListener(window, 'resize', resize);
    cleanupManager.addObserver(ro, 'terminal-resize-observer');
  }

  function setupTerminalInput() {
    terminal.onData((data) => {
      const activeSocket = getActiveSocket();
      const activeSessionId = getActiveSessionId();
      if (activeSocket && activeSessionId) {
        activeSocket.emit('input', data, activeSessionId);
        onInputEvent(data);
      }
    });
  }

  function initializeLinkDetector() {
    linkDetector = new LinkDetector();
    if (terminal) {
      linkDetector.registerWithTerminal(terminal);
    }
  }

  async function restoreSessionHistory() {
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
  }

  async function onLoad() {
    console.debug('Terminal component has loaded');
    if (isInitialized) {
      console.debug('Terminal already initialized, skipping setup');
      return;
    }

    const fitAddon = await setupTerminalAddons();
    setupResizeHandling(fitAddon);
    setupTerminalInput();
    initializeLinkDetector();
    
    // Mark as initialized
    isInitialized = true;
    
    // Set up socket listeners if socket is available
    const activeSocket = getActiveSocket();
    if (activeSocket) {
      setupSocketListeners();
    }
    
    await restoreSessionHistory();
  }

  // Input buffer for processing output
  let currentOutputBuffer = '';



  // Session history management functions
  function getStorageKey() {
    const activeSessionId = getActiveSessionId();
    return `${LS_HISTORY_KEY}-${activeSessionId}`;
  }

  function loadSessionHistory() {
    if (!historyService) return '';
    return historyService.load();
  }

  function saveSessionHistory() {
    if (historyService) {
      historyService.save();
    }
  }

  function addToSessionHistory(data, type = 'output') {
    if (historyService && data) {
      historyService.addEntry(data, type);
    }
    
    saveSessionHistory();
  }


  function clearSessionHistory() {
    if (historyService) {
      historyService.clear();
      console.debug('Cleared session history');
    }
  }

  function reconstructTerminalBuffer() {
    // Use history service to reconstruct buffer
    return historyService ? historyService.reconstructTerminalBuffer() : '';
  }

  function setupSocketListeners() {
    const activeSocket = getActiveSocket();
    if (!activeSocket) {
      console.debug('Terminal: setupSocketListeners called but no socket');
      return;
    }

    console.debug('Terminal: setting up socket listeners, socket connected:', activeSocket.connected);

    activeSocket.on('connect_error', (err) => {
      terminal?.writeln(`\r\n[connection error] ${err.message}\r\n`);
    });

    activeSocket.on('output', async (output) => {
      // Handle both old format (direct data) and new format (session-specific)
      const data = typeof output === 'string' ? output : output.data;
      
      // Direct output to terminal
      terminal?.write(data);
      
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
      if (terminal && historyService) {
        // Update buffer in history service (with caching optimization)
        historyService.updateBuffer(terminal);
        
        // Notify parent component of buffer update
        if (onBufferUpdate) {
          onBufferUpdate(historyService.currentBuffer);
        }
      }
    });

    activeSocket.on('ended', () => {
      terminal?.writeln('\r\n[session ended]\r\n');
      localStorage.removeItem(LS_KEY);
      // Clear session history when session ends
      clearSessionHistory();
      // Redirect to sessions page when session ends
      setTimeout(() => goto('/sessions'), 1000); // Small delay to show the message
    });
  }




  onDestroy(() => {
    // Use cleanup manager for systematic resource cleanup
    if (cleanupManager) {
      cleanupManager.cleanup();
    }
    
    // Terminal-specific cleanup
    if (terminal?._cleanup) {
      terminal._cleanup();
    }
    if (terminal?._pollCleanup) {
      terminal._pollCleanup();
    }
    
    // Cleanup link detector
    if (linkDetector) {
      linkDetector = null;
    }
    
    // Cleanup history service
    if (historyService) {
      historyService.destroy();
      historyService = null;
    }
    
    // Don't disconnect the socket as it's shared with other components
    // The session page will handle socket cleanup
  });

</script>


<div class="terminal-container">
  <!-- Simple single terminal -->
  <Xterm 
    {options}
    bind:terminal
    onLoad={onLoad}
  />
</div>

<style>

  .terminal-container {
    display: flex;
    flex-direction: column;
    position: relative;
    height: 80svh;
    width: 100%;
  }

  /* Terminal takes full available space */
</style>