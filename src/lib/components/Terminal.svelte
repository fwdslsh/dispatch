<script>
  import { onMount, onDestroy } from 'svelte';
  import { io } from 'socket.io-client';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';

  let container;
  let term;
  let fit;
  let socket;
  let publicUrl = null;
  let mode = 'claude';
  let authenticated = false;
  let authKey = '';
  let showAuth = true;

  const LS_KEY = 'dispatch-session-id';

  async function pollPublicUrl() {
    try {
      const resp = await fetch('/public-url');
      const data = await resp.json();
      publicUrl = data.url;
    } catch (err) {
      console.warn('Failed to fetch public URL:', err.message);
    }
  }

  function authenticate() {
    if (!socket || !authKey.trim()) return;
    
    socket.emit('auth', authKey, (resp) => {
      if (resp.ok) {
        authenticated = true;
        showAuth = false;
        connectToSession();
      } else {
        alert('Authentication failed: ' + (resp.error || 'Invalid key'));
      }
    });
  }

  function connect() {
    socket = io({
      transports: ['websocket', 'polling']
    });

    socket.on('connect_error', (err) => {
      term?.writeln(`\r\n[connection error] ${err.message}\r\n`);
    });

    socket.on('output', (data) => {
      term?.write(data);
    });

    socket.on('ended', () => {
      term?.writeln('\r\n[session ended]\r\n');
      localStorage.removeItem(LS_KEY);
    });

    socket.on('connect', () => {
      if (!authenticated) {
        showAuth = true;
      }
    });
  }

  function connectToSession() {
    if (!socket || !authenticated) return;

    const saved = localStorage.getItem(LS_KEY);
    const dims = { cols: term.cols, rows: term.rows };
    
    if (saved) {
      socket.emit('attach', { sessionId: saved, ...dims }, (resp) => {
        if (!resp || !resp.ok) {
          startNewSession(mode); // make a fresh one
        }
      });
    } else {
      startNewSession(mode);
    }
  }

  function startNewSession(modeOverride) {
    if (!socket || !authenticated) return;

    const dims = { cols: term.cols, rows: term.rows, mode: modeOverride || mode };
    socket.emit('create', dims, (resp) => {
      if (resp.ok) {
        localStorage.setItem(LS_KEY, resp.sessionId);
      } else {
        term?.writeln(`\r\n[error] ${resp.error}\r\n`);
      }
    });
  }

  function endSession() {
    const id = localStorage.getItem(LS_KEY);
    if (id && socket) {
      socket.emit('end');
      // server will broadcast 'ended'
    }
  }

  onMount(() => {
    term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      theme: { background: '#000000' }
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    connect();
    pollPublicUrl();
    const pollId = setInterval(pollPublicUrl, 10000);

    term.onData((data) => socket?.emit('input', data));

    const resize = () => {
      fit.fit();
      socket?.emit('resize', { cols: term.cols, rows: term.rows });
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    window.addEventListener('resize', resize);

    return () => {
      socket?.emit('detach');
      window.removeEventListener('resize', resize);
      ro.disconnect();
      clearInterval(pollId);
      socket?.disconnect();
      term.dispose();
    };
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
  
  <div bind:this={container} class="terminal"></div>
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