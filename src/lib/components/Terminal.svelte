<script>
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { Xterm, XtermAddon } from '@battlefieldduck/xterm-svelte';
  // Mobile components removed for desktop-only terminal
  import MultiPaneLayout from './MultiPaneLayout.svelte';
  import { TerminalOutputFilter } from '../services/output-deduplicator.js';
  import { LinkDetector } from '../services/link-detector.js';

  export let socket = null;
  export let sessionId = null;
  export let onchatclick = () => {};
  export let initialHistory = '';
  export let onInputEvent = () => {};
  export let onOutputEvent = () => {};
  export let onBufferUpdate = () => {};

  // Mobile input state removed

  let terminal;
  let authenticated = false;
  let authKey = '';
  // Desktop-only mode
  let isDesktopMode = true;
  
  // Output deduplication
  let outputFilter = null;
  
  // Always desktop mode
  let linkDetector = null;

  const LS_KEY = 'dispatch-session-id';
  const LS_HISTORY_KEY = 'dispatch-session-history';
  const MAX_HISTORY_ENTRIES = 5000; // Maximum number of history entries to keep
  const MAX_BUFFER_LENGTH = 500000; // Maximum buffer length in characters (~500KB)

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

  async function onLoad() {
    console.debug('Terminal component has loaded');

    // Always desktop mode - mobile handling removed
    isDesktopMode = true;

    // Keyboard detection removed for desktop-only mode

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
      ro.disconnect();
    };

    // Initialize output filter for intelligent deduplication
    outputFilter = new TerminalOutputFilter({
      progressThreshold: 5, // Show progress every 5%
      maxBufferLines: 1000,
      onOutputReplace: (buffer, newLine) => {
        // Handle terminal line replacement
        // In a real implementation, this would use terminal-specific APIs
        // to replace content instead of appending
        console.debug('Output replacement:', { buffer: buffer.slice(-50), newLine });
      }
    });
    
    // Initialize LinkDetector
    linkDetector = new LinkDetector();
    if (terminal) {
      linkDetector.registerWithTerminal(terminal);
    }
    
    // Set up socket listeners if socket is provided
    if (socket) {
      setupSocketListeners();
    }
    
    // Command history loading removed
    
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
    
    // Poll cleanup no longer needed
  }

  function onData(data) {
    console.debug('onData()', data);
    // Desktop direct terminal input - simplified
    if (socket) {
      socket.emit('input', data);
      onInputEvent(data); // Simple input tracking
    }
  }

  function onKey(data) {
    console.debug('onKey()', data);
    // Key handling simplified for desktop
  }


  // Mobile input functions removed - desktop only



  // Mobile keyboard and click handling removed

  // Input buffer removed - simplified for desktop
  let currentOutputBuffer = ''; // Buffer to accumulate output until complete lines
  let sessionTerminalHistory = []; // Deduplicated terminal history for this session



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
      console.debug('Terminal: setupSocketListeners called but no socket');
      return;
    }

    console.debug('Terminal: setting up socket listeners, socket connected:', socket.connected);

    socket.on('connect_error', (err) => {
      terminal?.writeln(`\r\n[connection error] ${err.message}\r\n`);
    });

    socket.on('output', async (output) => {
      // Handle both old format (direct data) and new format (session-specific)
      const data = typeof output === 'string' ? output : output.data;
      
      console.debug('Terminal: received output from socket:', data.length, 'chars, first 50:', data.substring(0, 50));
      
      // Direct output to terminal (desktop only)
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
    // Keyboard cleanup removed
    
    // Clean up output filter
    if (outputFilter) {
      outputFilter.clear();
      outputFilter = null;
    }
    
    // Don't disconnect the socket as it's shared with other components
    // The session page will handle socket cleanup
  });

</script>


<div class="terminal-container">
  <!-- Desktop multi-pane layout only -->
  <MultiPaneLayout 
    {socket}
    {sessionId}
    {linkDetector}
    terminalOptions={options}
    onInputEvent={onInputEvent}
    onOutputEvent={onOutputEvent}
  />
</div>

<style>

  /* Desktop-only terminal container */
  .terminal-container {
    display: flex;
    flex-direction: column;
    position: relative;
    height: 80svh;
    width: 100%;
  }
</style>