<script>
  import { onDestroy } from 'svelte';
  import { io } from 'socket.io-client';
  import { Xterm, XtermAddon } from '@battlefieldduck/xterm-svelte';

  export let sessionId = null;

  let terminal;
  let socket;
  let publicUrl = null;
  let mode = 'claude';
  let authenticated = false;
  let authKey = '';
  let showAuth = false;

  const LS_KEY = 'dispatch-session-id';

  let options = {
    convertEol: true,
    cursorBlink: true,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    theme: { background: '#000000' }
  };

  async function onLoad() {
    console.log('Terminal component has loaded');

    // FitAddon Usage
    const fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
    terminal.loadAddon(fitAddon);
    fitAddon.fit();

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

    connect();
    pollPublicUrl();
    const pollId = setInterval(pollPublicUrl, 10000);
    
    // Store poll cleanup
    terminal._pollCleanup = () => clearInterval(pollId);
  }

  function onData(data) {
    console.log('onData()', data);
    socket?.emit('input', data);
  }

  function onKey(data) {
    console.log('onKey()', data);
    // Handle any special key combinations here if needed
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
          // failed to attach, create a new one
          startNewSession(mode);
        }
      });
    } else {
      startNewSession(mode);
    }
  }

  function startNewSession(modeOverride) {
    if (!socket || !authenticated) return;

    const dims = { cols: terminal.cols, rows: terminal.rows, mode: modeOverride || mode };
    socket.emit('create', dims, (resp) => {
      if (resp.ok) {
  localStorage.setItem(LS_KEY, resp.sessionId);
  // if we have session props, persist metadata
  // client can emit a separate create with meta if needed
      } else {
        terminal?.writeln(`\r\n[error] ${resp.error}\r\n`);
      }
    });
  }


  import { goto } from '$app/navigation';

  function endSession() {
    const id = localStorage.getItem(LS_KEY);
    if (id && socket) {
      socket.emit('end');
      // server will broadcast 'ended'
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
      <h3>Authentication Required</h3>
      <input 
        type="password" 
        bind:value={authKey} 
        placeholder="Enter authentication key"
        on:keypress={handleKeyPress}
      />
      <button on:click={authenticate}>Connect</button>
    </div>
  </div>
{/if}

<div class="terminal-container">
  <div class="controls">
    <select bind:value={mode}>
      <option value="claude">Claude Mode</option>
      <option value="bash">Bash Mode</option>
    </select>
    
    <button on:click={() => startNewSession(mode)}>New Session</button>
    <button on:click={endSession}>End Session</button>
    
    {#if publicUrl}
      <span class="public-url">Public URL: {publicUrl}</span>
    {/if}
  </div>
  
  <div class="terminal">
    <Xterm bind:terminal {options} {onLoad} {onData} {onKey} />
  </div>
</div>

<style>
  .auth-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .auth-box {
    background: #1e1e1e;
    padding: 2rem;
    border-radius: 8px;
    color: white;
    text-align: center;
  }

  .auth-box h3 {
    margin-top: 0;
    margin-bottom: 1rem;
  }

  .auth-box input {
    padding: 0.5rem;
    margin: 0.5rem;
    border: 1px solid #444;
    border-radius: 4px;
    background: #2a2a2a;
    color: white;
    width: 200px;
  }

  .auth-box button {
    padding: 0.5rem 1rem;
    margin: 0.5rem;
    background: #007acc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .auth-box button:hover {
    background: #005a9e;
  }

  .terminal-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem;
    background: #2a2a2a;
    border-bottom: 1px solid #444;
  }

  .controls select,
  .controls button {
    padding: 0.25rem 0.5rem;
    background: #1e1e1e;
    color: white;
    border: 1px solid #444;
    border-radius: 4px;
    cursor: pointer;
  }

  .controls button:hover {
    background: #3a3a3a;
  }

  .public-url {
    color: #888;
    font-size: 0.8rem;
    margin-left: auto;
  }

  .terminal {
    flex: 1;
    background: #000000;
  }
</style>