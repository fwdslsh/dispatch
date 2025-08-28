<script>
  import { onMount, onDestroy } from "svelte";
  import { io } from "socket.io-client";

  let publicUrl = null;
  let socket = null;
  let pollInterval = null;

  function connectSocket() {
    socket = io({ transports: ["websocket", "polling"] });
    socket.on("connect", () => {
      pollPublicUrl();
    });
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

  function copyToClipboard() {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl).then(() => {
        // Could add a toast notification here
        console.log('URL copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    }
  }

  function openInNewTab() {
    if (publicUrl) {
      window.open(publicUrl, '_blank');
    }
  }

  onMount(() => {
    connectSocket();
    // Poll every 5 seconds to check for URL updates
    pollInterval = setInterval(pollPublicUrl, 5000);
  });

  onDestroy(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    if (socket) {
      socket.disconnect();
    }
  });
</script>

{#if publicUrl}
  <div class="public-url-container">
    <!-- <div class="public-url-label">Public URL:</div> -->
    <div class="public-url-wrapper">
      <button 
        class="public-url-link" 
        on:click={openInNewTab}
        title="Click to open in new tab"
      >
        {publicUrl}
      </button>
      <button 
        class="copy-button" 
        on:click={copyToClipboard}
        title="Copy to clipboard"
        aria-label="Copy URL to clipboard"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .public-url-container {
    
    padding: var(--space-sm);
    margin: var(--space-sm) 0;
    backdrop-filter: blur(5px);
    opacity: 0.7;
    transition: opacity 0.3s ease;
  }

  .public-url-container:hover {
    opacity: 1;
  }

  .public-url-label {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin-bottom: var(--space-xs);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    opacity: 0.6;
  }

  .public-url-wrapper {
    display: flex;
    align-items: center;
    /* gap: var(--space-sm); */
  }

  .public-url-link {
    flex: 1;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--secondary);
    border-radius: 0;
    padding: var(--space-xs) var(--space-md);
    color: var(--text-muted);
    font-family: monospace;
    font-size: 0.8rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.3s ease;
    word-break: break-all;
  }

  .public-url-link:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--secondary);
    color: var(--primary);
    transform: none;
  }

  .public-url-link:active {
    transform: translateY(0);
  }

  .copy-button {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--secondary);
    border-radius: 0;
    border-left: none;
    border-collapse: collapse;
    padding: var(--space-xs);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
  }

  .copy-button:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(0, 255, 136, 0.3);
    color: var(--primary);
    transform: none;
  }

  .copy-button:active {
    transform: translateY(0);
  }

  .copy-button svg {
    width: 14px;
    height: 14px;
  }

  @media (max-width: 600px) {
    .public-url-wrapper {
      flex-direction: column;
      align-items: stretch;
    }
    
    .public-url-link {
      text-align: center;
      word-break: break-all;
    }
    
    .copy-button {
      align-self: center;
    }
  }
</style>