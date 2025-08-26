<script>
  import Terminal from "$lib/components/Terminal.svelte";
  import Chat from "$lib/components/Chat.svelte";
  import HeaderToolbar from "$lib/components/HeaderToolbar.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import { io } from "socket.io-client";

  let authed = false;
  let sessionId;
  let socket;
  let chatView = false;

  onMount(() => {
    if (browser) {
      const storedAuth = localStorage.getItem("dispatch-auth-token");
      if (storedAuth) {
        authed = true;
        sessionId = $page.params.id;
        // Create socket connection for end session functionality
        socket = io({ transports: ["websocket", "polling"] });
        socket.emit("auth", storedAuth, (res) => {
          // Auth handled, socket ready for end session
        });
      } else {
        goto("/");
        return;
      }
    }
  });

  function endSession() {
    if (sessionId && socket) {
      socket.emit("end", sessionId);
      // Redirect immediately, server will handle cleanup
      goto("/sessions");
    } else {
      // No session to end, just go back
      goto("/sessions");
    }
  }

  function toggleView() {
    chatView = !chatView;
  }
</script>

<div class="container">
  <HeaderToolbar>
    {#snippet left()}
      <a href="/sessions" class="back-link" aria-label="Back to sessions">
        <svg
          class="back-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </a>
      <h2># {$page.params.id.slice(0, 8)}</h2>
    {/snippet}

    {#snippet right()}
      {#if authed && sessionId}
        <button
          title="End Session"
          aria-label="End Session"
          class="button-danger end-session-btn btn-icon-only"
          on:click={endSession}
        >
          <svg
            class="end-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      {/if}
    {/snippet}
  </HeaderToolbar>

  <div class="terminal-page-container">
    {#if authed && sessionId}
      {#if chatView}
        <Chat {socket} {sessionId}>
          <button 
            slot="toggle-button" 
            class="view-toggle" 
            on:click={toggleView} 
            title="Switch to Terminal"
            aria-label="Switch to Terminal view"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </button>
        </Chat>
      {:else}
        <div class="terminal-header">
          <button 
            class="view-toggle" 
            on:click={toggleView} 
            title="Switch to Chat"
            aria-label="Switch to Chat view"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>
        <Terminal {sessionId} onchatclick={toggleView} />
      {/if}
    {:else}
      <div style="text-align: center; padding: 2rem;">
        <p class="loading">initializing session...</p>
      </div>
    {/if}
  </div>
</div>
<style>

  .terminal-page-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .back-link {
    display: flex;
    align-items: center;
    color: var(--primary);
    text-decoration: none;
    padding: var(--space-xs);
    border-radius: 4px;
    transition: color 0.2s ease;
  }

  .back-link:hover {
    color: var(--text-primary);
  }

  .back-icon {
    width: 1.5rem;
    height: 1.5rem;
    margin-right: var(--space-sm);
  }
  
  @media (max-width: 768px) {
    .back-link {
      padding: var(--space-sm);
      min-width: 44px;
      min-height: 44px;
      justify-content: center;
    }
    
    .back-icon {
      width: 1.75rem;
      height: 1.75rem;
      margin-right: 0;
    }
  }

  .end-session-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: var(--space-sm);
    border-radius: var(--radius);
    transition: background 0.2s, border-color 0.2s;
  }

  .end-session-btn:hover {
    background: var(--surface-hover);
    border-color: var(--border-hover);
  }

  .end-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .loading {
    color: var(--text-muted);
  }

  .terminal-header {
    display: flex;
    justify-content: flex-end;
    padding: var(--space-sm) var(--space-md);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  .view-toggle {
    background: transparent !important;
    border: 1px solid var(--border) !important;
    border-radius: 6px !important;
    padding: var(--space-sm) !important;
    color: var(--text-secondary) !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 40px;
    min-height: 40px;
  }

  .view-toggle:hover {
    background: var(--surface-hover) !important;
    color: var(--text-primary) !important;
    border-color: var(--border-light) !important;
  }

  .view-toggle svg {
    width: 18px;
    height: 18px;
    stroke-width: 2;
  }

  @media (max-width: 768px) {
    .view-toggle {
      min-width: 44px !important;
      min-height: 44px !important;
    }
  }
</style>