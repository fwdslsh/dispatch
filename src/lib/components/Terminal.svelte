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

<svelte:head>
  <link rel="stylesheet" href="https://unpkg.com/@xterm/xterm@5.3.0/css/xterm.css" />
</svelte:head>

{#if showAuth}
  <div class="mb-4 p-4 border rounded-lg bg-yellow-50">
    <h2 class="text-lg font-semibold mb-2">Authentication Required</h2>
    <div class="flex gap-2">
      <input 
        type="password" 
        bind:value={authKey}
        on:keypress={handleKeyPress}
        placeholder="Enter shared secret key"
        class="flex-1 px-3 py-2 border rounded"
      />
      <button 
        on:click={authenticate}
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Connect
      </button>
    </div>
  </div>
{/if}

{#if publicUrl}
  <div class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
    <div class="text-sm text-green-800">
      <strong>Public URL:</strong> 
      <a href={publicUrl} target="_blank" class="text-blue-600 underline">{publicUrl}</a>
    </div>
  </div>
{/if}

{#if authenticated}
  <div class="mb-3 flex gap-2 items-center">
    <label for="session-mode" class="text-sm">New session mode:</label>
    <select id="session-mode" bind:value={mode} class="border px-2 py-1 rounded">
      <option value="claude">Claude Code</option>
      <option value="shell">Shell</option>
    </select>
    <button class="px-3 py-1 border rounded hover:bg-gray-50" on:click={() => startNewSession(mode)}>
      New session
    </button>
    <button class="px-3 py-1 border rounded hover:bg-gray-50" on:click={endSession}>
      End session
    </button>
  </div>
{/if}

<div bind:this={container} class="h-[70vh] w-full rounded-lg overflow-hidden border"></div>