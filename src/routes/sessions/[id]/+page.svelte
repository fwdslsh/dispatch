
<script>
  import Terminal from '$lib/components/Terminal.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { io } from 'socket.io-client';
  
  let authed = false;
  let sessionId;
  let socket;

  onMount(() => {
    if (browser) {
      const storedAuth = localStorage.getItem('dispatch-auth-token');
      if (storedAuth) {
        authed = true;
        sessionId = $page.params.id;
        // Create socket connection for end session functionality
        socket = io({ transports: ['websocket', 'polling'] });
        socket.emit('auth', storedAuth, (res) => {
          // Auth handled, socket ready for end session
        });
      } else {
        goto('/');
        return;
      }
    }
  });

  function endSession() {
    if (sessionId && socket) {
      socket.emit('end', sessionId);
      // Redirect immediately, server will handle cleanup
      goto('/sessions');
    } else {
      // No session to end, just go back
      goto('/sessions');
    }
  }
</script>

<div class="session-header">
  <div class="session-header-left">
    <a href="/sessions" class="back-link">
      <svg class="back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </a>
    <h2># {$page.params.id.slice(0, 8)}</h2>
  </div>
  {#if authed && sessionId}
    <button class="button-danger end-session-btn" on:click={endSession}>
      <svg class="end-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  {/if}
</div>

<div class="terminal-page-container">
  {#if authed && sessionId}
    <Terminal {sessionId} />
  {:else}
    <div style="text-align: center; padding: 2rem;">
      <p class="loading">initializing session...</p>
    </div>
  {/if}
</div>

<style>
  .session-header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 1rem 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }

  .session-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .end-session-btn {
    padding: 0.75rem 0.75rem !important;
    font-size: 0.9rem !important;
    display: flex !important;
    align-items: center !important;
    gap: 0.5rem !important;
  }

  .end-icon {
    width: 1rem;
    height: 1rem;
    stroke-width: 2;
  }

  .back-link {
    color: var(--primary);
    text-decoration: none;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    transition: color 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .back-link:hover {
    color: var(--text-primary);
  }

  .back-icon {
    width: 1.2rem;
    height: 1.2rem;
    stroke-width: 2;
  }

  .session-header h2 {
    margin: 0;
    color: var(--text-secondary);
    font-size: 1.1rem;
  }

  .terminal-page-container {
    position: fixed;
    top: 4rem;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0;
    margin: 0;
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .session-header {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
      padding: 1rem;
    }
    
    .session-header-left {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
    
    .end-session-btn {
      align-self: flex-end;
    }

    .terminal-page-container {
      top: 6rem; /* Account for larger header on mobile */
    }
  }
</style>
