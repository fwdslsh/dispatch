<script>
  import { onMount, onDestroy } from 'svelte';
  import { Terminal } from '@xterm/xterm';
  import { io } from 'socket.io-client';
  import '@xterm/xterm/css/xterm.css';

  export let ptyId;
  let socket, term, el;

  onMount(() => {
    term = new Terminal({ convertEol: true, cursorBlink: true });
    term.open(el);
    
    socket = io();
    
    socket.on('connect', () => {
      console.log('Socket.IO connected');
      // Join the terminal room
      socket.emit('subscribe', `terminal:${ptyId}`);
      
      // Handle user input
      term.onData(data => {
        socket.emit('terminal.write', { id: ptyId, data });
      });
      
      // Send initial size
      socket.emit('terminal.resize', { 
        id: ptyId, 
        cols: term.cols, 
        rows: term.rows 
      });
      
      // Send initial enter to trigger prompt
      setTimeout(() => {
        socket.emit('terminal.write', { id: ptyId, data: '\r' });
      }, 200);
    });

    // Listen for terminal data
    socket.on('data', (data) => {
      term.write(data);
    });

    // Listen for terminal exit
    socket.on('exit', (data) => {
      console.log('Terminal exited with code:', data.exitCode);
    });

    // Handle window resize
    const resize = () => {
      if (socket && socket.connected) {
        socket.emit('terminal.resize', { 
          id: ptyId, 
          cols: term.cols, 
          rows: term.rows 
        });
      }
    };
    window.addEventListener('resize', resize);
  });

  onDestroy(() => {
    if (socket) {
      socket.disconnect();
    }
  });
</script>

<div bind:this={el} style="height: 420px;"></div>