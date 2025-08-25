
<script>
  import { goto } from '$app/navigation';
  import { io } from 'socket.io-client';
  import { onMount } from 'svelte';
  let key = '';
  let error = '';
  let loading = false;

  onMount(() => {
    // Check if already authenticated
    const storedAuth = localStorage.getItem('dispatch-auth-token');
    if (storedAuth) {
      goto('/sessions');
    }
  });

  async function handleLogin(e) {
    e.preventDefault();
    loading = true;
    error = '';
    const socket = io({ transports: ['websocket', 'polling'] });
    socket.emit('auth', key, (resp) => {
      loading = false;
      if (resp.ok) {
        localStorage.setItem('dispatch-auth-token', key);
        goto('/sessions');
      } else {
        error = resp.error || 'Invalid key';
      }
      socket.disconnect();
    });
  }
</script>

<svelte:head>
  <title>dispatch - Terminal Access</title>
</svelte:head>

<main class="main-container">
  <div class="container">
    <h1>dispatch</h1>
    <p>terminal access via web</p>
    
    <form on:submit={handleLogin}>
      <input
        type="password"
        placeholder="terminal key"
        bind:value={key}
        required
        autocomplete="off"
        disabled={loading}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'connecting...' : 'connect'}
      </button>
    </form>
    
    {#if error}
      <div class="error">{error}</div>
    {/if}
  </div>
</main>