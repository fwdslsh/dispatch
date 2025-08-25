<script>
  import { onDestroy } from 'svelte';
  import { io } from 'socket.io-client';
  import { Xterm, XtermAddon } from '@battlefieldduck/xterm-svelte';

  export let sessionId = null;

  let terminal;
  let socket;
  let publicUrl = null;
  let authenticated = false;
  let authKey = '';
  let showAuth = false;
  let isMobile = false;
  let mobileInput = '';

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
    
    // Update mobile state on resize
    const handleResize = () => {
      isMobile = window.innerWidth <= 768;
    };
    window.addEventListener('resize', handleResize);

    // FitAddon Usage
    const fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
    terminal.loadAddon(fitAddon);
    
    // Ensure the terminal fits after DOM is ready
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    // Set up resize handling - focus on PTY resize only
    const resize = () => {
      // Let CSS handle the visual sizing, just call fit for PTY calculations
      fitAddon.fit();
      socket?.emit('resize', { cols: terminal.cols, rows: terminal.rows });
    };
    
    // ResizeObserver for terminal container changes
    const ro = new ResizeObserver(resize);
    const terminalContainer = terminal.element?.closest('.terminal');
    const pageContainer = terminal.element?.closest('.terminal-page-container');
    
    // Watch both the immediate terminal container and the page container
    if (terminalContainer) {
      ro.observe(terminalContainer);
    }
    if (pageContainer) {
      ro.observe(pageContainer);
    }
    
    // Also watch for window resize
    window.addEventListener('resize', resize);

    // Store cleanup function
    terminal._cleanup = () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
    };

    // Force an initial resize to ensure proper sizing
    requestAnimationFrame(() => {
      resize();
    });

    connect();
    pollPublicUrl();
    const pollId = setInterval(pollPublicUrl, 10000);
    
    // Store poll cleanup
    terminal._pollCleanup = () => clearInterval(pollId);
  }

  function onData(data) {
    console.log('onData()', data);
    // Disable direct input on mobile - use textarea instead
    if (!isMobile) {
      socket?.emit('input', data);
    }
  }

  function onKey(data) {
    console.log('onKey()', data);
    // Handle any special key combinations here if needed
  }

  function handleMobileInput(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMobileInput();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      // Send tab character for autocomplete
      if (socket) {
        socket.emit('input', '\t');
      }
    }
  }

  function sendMobileInput() {
    if (socket) {
      if (mobileInput.trim()) {
        socket.emit('input', mobileInput + '\r');
      } else {
        // Send empty line
        socket.emit('input', '\r');
      }
      mobileInput = '';
    }
  }

  function sendSpecialKey(key) {
    if (socket) {
      socket.emit('input', key);
    }
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
        showAuth = false;
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
      } else {
        showAuth = true;
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



  import { goto } from '$app/navigation';

  onDestroy(() => {
    if (terminal?._cleanup) {
      terminal._cleanup();
    }
    if (terminal?._pollCleanup) {
      terminal._pollCleanup();
    }
    socket?.emit('detach');
    socket?.disconnect();
  });

  function handleKeyPress(event) {
    if (event.key === 'Enter') {
      authenticate();
    }
  }
</script>

{#if showAuth}
  <div class="auth-overlay">
    <div class="auth-box">
      <h3>terminal authentication</h3>
      <input 
        type="password" 
        bind:value={authKey} 
        placeholder="authentication key"
        on:keypress={handleKeyPress}
      />
      <button on:click={authenticate}>connect</button>
    </div>
  </div>
{/if}

<div class="terminal-container">
  {#if publicUrl}
    <div class="controls">
      <div class="public-url">public: {publicUrl}</div>
    </div>
  {/if}
  
  <div class="terminal">
    <Xterm bind:terminal {options} {onLoad} {onData} {onKey} />
  </div>
  
  {#if isMobile}
    <div class="mobile-controls">
      <div class="special-keys">
        <button class="key-button" on:click={() => sendSpecialKey('\t')}>tab</button>
        <button class="key-button" on:click={() => sendSpecialKey('\u0003')}>ctrl+c</button>
        <button class="key-button" on:click={() => sendSpecialKey('\u001b[A')}>↑</button>
        <button class="key-button" on:click={() => sendSpecialKey('\u001b[B')}>↓</button>
      </div>
      <div class="mobile-input-container">
        <textarea
          bind:value={mobileInput}
          on:keydown={handleMobileInput}
          placeholder="Type command and press Enter..."
          class="mobile-input"
          rows="2"
        ></textarea>
        <button class="send-button" on:click={sendMobileInput}>
          send
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .auth-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .auth-box {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 2rem;
    border-radius: 8px;
    text-align: center;
    max-width: 400px;
    width: 90%;
  }

  .auth-box h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }

  .auth-box input {
    width: 100%;
    margin-bottom: 1rem;
  }

  .controls {
    flex-shrink: 0; /* Don't allow controls to shrink */
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: var(--space-md);
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .terminal-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    position: relative;
    min-height: 0; /* Allow flex child to shrink */
  }

  /* Force xterm to fill available height using direct approach */
  .terminal {
    flex: 1;
    background: var(--bg-darker);
    overflow: hidden;
    min-height: 0;
    container-type: size;
    position: relative;
  }

  .terminal :global(.xterm) {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    max-height: none !important;
    min-height: 100% !important;
  }

  .terminal :global(.xterm .xterm-viewport) {
    height: 100% !important;
    max-height: none !important;
    min-height: 100% !important;
    overflow-y: auto !important;
  }

  .terminal :global(.xterm .xterm-screen) {
    height: 100% !important;
    max-height: none !important;
    min-height: 100% !important;
  }

  /* Override any inline styles that limit height */
  .terminal :global(.xterm[style*="height"]) {
    height: 100% !important;
  }

  .terminal :global(.xterm-viewport[style*="height"]) {
    height: 100% !important;
  }

  .terminal :global(.xterm-screen[style*="height"]) {
    height: 100% !important;
  }

  /* Container query for responsive terminal sizing */
  @container (min-height: 200px) {
    .terminal :global(.xterm) {
      height: 100% !important;
    }
  }

  .mobile-controls {
    background: var(--surface);
    border-top: 1px solid var(--border);
    flex-shrink: 0; /* Don't allow mobile controls to shrink */
  }

  .special-keys {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem 0 1rem;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
  }

  .key-button {
    background: var(--bg-dark) !important;
    color: var(--text-secondary) !important;
    border: 1px solid var(--border) !important;
    border-radius: 4px !important;
    padding: 0.5rem 0.75rem !important;
    font-family: 'Courier New', monospace !important;
    font-size: 0.8rem !important;
    font-weight: normal !important;
    min-width: auto !important;
    height: auto !important;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .key-button:hover {
    background: var(--surface-hover) !important;
    transform: none !important;
    box-shadow: none !important;
  }

  .mobile-input-container {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
  }

  .mobile-input {
    flex: 1;
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.75rem;
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
    font-size: 1rem;
    resize: none;
    min-height: 2.5rem;
  }

  .mobile-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.1);
  }

  .mobile-input::placeholder {
    color: var(--text-muted);
  }

  .send-button {
    background: var(--primary-gradient) !important;
    color: var(--bg-dark) !important;
    border: none !important;
    border-radius: 6px !important;
    padding: 0.75rem 1.5rem !important;
    font-family: 'Courier New', monospace !important;
    font-weight: bold !important;
    font-size: 0.9rem !important;
    min-width: 4rem;
    height: fit-content;
    align-self: flex-end;
  }

  .send-button:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 2px 8px rgba(0, 255, 136, 0.3) !important;
  }

</style>