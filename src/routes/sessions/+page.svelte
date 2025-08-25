
<script>
  import { onMount, onDestroy } from 'svelte';
  import { io } from 'socket.io-client';
  import { goto } from '$app/navigation';

  let sessions = [];
  let active = null;

  let socket;
  let authed = false;

  function connectSocket() {
    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      const storedAuth = localStorage.getItem('dispatch-auth-token');
      if (storedAuth) {
        socket.emit('auth', storedAuth, (res) => {
          authed = !!(res && res.ok);
          if (!authed) {
            // Auth failed, redirect to login
            localStorage.removeItem('dispatch-auth-token');
            goto('/');
            return;
          }
        });
      } else {
        // No stored auth, redirect to login
        goto('/');
        return;
      }

      socket.emit('list', (resp) => {
        if (resp.ok) {
          sessions = resp.sessions || [];
          active = resp.active || null;
        }
      });
    });

    socket.on('sessions-updated', (data) => {
      sessions = data.sessions || [];
      active = data.active || null;
    });
  }

  function disconnectSocket() {
    socket?.disconnect();
    socket = null;
  }

  function addSession() {
    const opts = { mode: 'shell', cols: 80, rows: 24 };
    socket.emit('create', opts, (resp) => {
      if (resp.ok) {
        goto(`/sessions/${resp.sessionId}`);
      } else {
        alert('Failed to create session: ' + (resp.error || 'unknown'));
      }
    });
  }

  function switchSession(id) {
    goto(`/sessions/${id}`);
  }

  function endSession(id) {
    socket.emit('end', id);
  }

  onMount(connectSocket);
  onDestroy(disconnectSocket);
</script>


<h1>Session Management</h1>

<div>
  <button on:click={addSession}>Create New Session</button>
</div>

<ul>
  {#each sessions as session}
    <li>
      <span>{session.name}</span>
      {#if active === session.id}
        <strong> (Active)</strong>
      {/if}
      <button on:click={() => switchSession(session.id)}>Switch</button>
      <button on:click={() => endSession(session.id)}>End</button>
    </li>
  {/each}
</ul>
