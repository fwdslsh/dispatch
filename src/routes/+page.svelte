
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
  <title>Login - Dispatch</title>
</svelte:head>

<main class="container">
  <h1>Login</h1>
  <form on:submit={handleLogin}>
    <input
      type="password"
      placeholder="Enter terminal key"
      bind:value={key}
      required
      autocomplete="off"
      disabled={loading}
    />
    <button type="submit" disabled={loading}>Login</button>
  </form>
  {#if error}
    <p style="color: red">{error}</p>
  {/if}
</main>