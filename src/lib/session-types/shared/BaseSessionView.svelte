<script>
  /**
   * BaseSessionView - Base component for session type views
   * 
   * Provides common structure and functionality that session type-specific
   * view components can extend or use as a template.
   */
  
  import { onDestroy } from 'svelte';
  
  // Props with callback props for modern Svelte 5 event handling
  let {
    session = {},
    socket = null,
    projectId = null,
    readonly = false,
    showControls = true,
    showMetadata = true,
    onSessionAction = () => {},
    onConnected = () => {},
    onDisconnected = () => {},
    onError = () => {}
  } = $props();
  
  // State
  let isConnected = $state(false);
  let lastActivity = $state(null);
  let status = $state(session.status || 'inactive');
  let error = $state(null);
  
  /**
   * Format timestamp for display
   */
  function formatTimestamp(timestamp) {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  }
  
  /**
   * Format session duration
   */
  function formatDuration(startTime) {
    if (!startTime) return 'Unknown';
    
    const start = new Date(startTime);
    const now = new Date();
    const diff = now - start;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
  
  /**
   * Handle session actions
   */
  function handleAction(action, data = null) {
    onSessionAction({
      action,
      sessionId: session.id,
      data
    });
  }
  
  /**
   * Handle socket connection events
   */
  function setupSocketListeners() {
    if (!socket) return;
    
    socket.on('connect', () => {
      isConnected = true;
      status = 'active';
      lastActivity = new Date().toISOString();
      onConnected();
    });
    
    socket.on('disconnect', () => {
      isConnected = false;
      status = 'inactive';
      onDisconnected();
    });
    
    socket.on('error', (err) => {
      error = err.message || 'Connection error';
      status = 'error';
      onError(err);
    });
    
    // Update activity timestamp on any data
    socket.onAny(() => {
      lastActivity = new Date().toISOString();
    });
  }
  
  /**
   * Cleanup socket listeners
   */
  function cleanupSocketListeners() {
    if (!socket) return;
    
    socket.off('connect');
    socket.off('disconnect');
    socket.off('error');
    socket.offAny();
  }
  
  // Setup socket listeners when socket changes
  $effect(() => {
    if (socket) {
      setupSocketListeners();
      return () => cleanupSocketListeners();
    }
  });
  
  // Cleanup on component destroy
  onDestroy(() => {
    cleanupSocketListeners();
  });
</script>

<div class="base-session-view">
  <!-- Session Header -->
  <div class="session-header">
    <div class="session-info">
      <h2 class="session-name">{session.name || session.id}</h2>
      <div class="session-details">
        <span class="session-type">{session.type}</span>
        <span class="session-status" class:active={status === 'active'} class:error={status === 'error'}>
          {status}
        </span>
        {#if isConnected}
          <span class="connection-indicator connected">●</span>
        {:else}
          <span class="connection-indicator disconnected">●</span>
        {/if}
      </div>
    </div>
    
    <!-- Session Controls -->
    {#if showControls && !readonly}
      <div class="session-controls">
        <slot name="session-controls" {handleAction} {isConnected} {status}>
          {#if status === 'active'}
            <button
              class="control-button"
              on:click={() => handleAction('detach')}
              title="Detach from session"
            >
              Detach
            </button>
            <button
              class="control-button danger"
              on:click={() => handleAction('end')}
              title="End session"
            >
              End
            </button>
          {:else if status === 'inactive' && session.supportsAttachment}
            <button
              class="control-button"
              on:click={() => handleAction('attach')}
              title="Attach to session"
            >
              Attach
            </button>
          {/if}
        </slot>
      </div>
    {/if}
  </div>

  <!-- Error Display -->
  {#if error}
    <div class="error-banner">
      <span class="error-icon">⚠</span>
      <span class="error-text">{error}</span>
      <button
        class="error-dismiss"
        on:click={() => error = null}
        title="Dismiss error"
      >
        ×
      </button>
    </div>
  {/if}

  <!-- Main Session Content -->
  <div class="session-content">
    <slot {session} {socket} {isConnected} {status} {handleAction}>
      <div class="default-content">
        <p>No session type-specific content provided.</p>
        <p>This session type should implement its own view component.</p>
      </div>
    </slot>
  </div>

  <!-- Session Metadata -->
  {#if showMetadata}
    <div class="session-metadata">
      <div class="metadata-section">
        <h4>Session Information</h4>
        <div class="metadata-grid">
          <div class="metadata-item">
            <label>ID:</label>
            <span>{session.id}</span>
          </div>
          <div class="metadata-item">
            <label>Type:</label>
            <span>{session.type}</span>
          </div>
          <div class="metadata-item">
            <label>Created:</label>
            <span>{formatTimestamp(session.created)}</span>
          </div>
          <div class="metadata-item">
            <label>Duration:</label>
            <span>{formatDuration(session.created)}</span>
          </div>
          {#if projectId}
            <div class="metadata-item">
              <label>Project:</label>
              <span>{projectId}</span>
            </div>
          {/if}
          <div class="metadata-item">
            <label>Last Activity:</label>
            <span>{formatTimestamp(lastActivity)}</span>
          </div>
        </div>
      </div>

      <!-- Custom metadata slot -->
      <slot name="metadata" {session} {status} {lastActivity}>
        {#if session.customData && Object.keys(session.customData).length > 0}
          <div class="metadata-section">
            <h4>Additional Information</h4>
            <div class="metadata-grid">
              {#each Object.entries(session.customData) as [key, value]}
                <div class="metadata-item">
                  <label>{key}:</label>
                  <span>{value}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </slot>
    </div>
  {/if}
</div>

<style>
  .base-session-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--bg-primary, #ffffff);
  }

  .session-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
    background-color: var(--bg-secondary, #f9fafb);
  }

  .session-info {
    flex: 1;
  }

  .session-name {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
  }

  .session-details {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  .session-type {
    background-color: var(--primary-color-light, #dbeafe);
    color: var(--primary-color-dark, #1e40af);
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 500;
  }

  .session-status {
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 500;
    text-transform: uppercase;
    font-size: 0.75rem;
    background-color: var(--gray-light, #f3f4f6);
    color: var(--gray-dark, #4b5563);
  }

  .session-status.active {
    background-color: var(--success-light, #d1fae5);
    color: var(--success-dark, #065f46);
  }

  .session-status.error {
    background-color: var(--error-light, #fee2e2);
    color: var(--error-dark, #991b1b);
  }

  .connection-indicator {
    font-size: 0.75rem;
  }

  .connection-indicator.connected {
    color: var(--success-color, #10b981);
  }

  .connection-indicator.disconnected {
    color: var(--error-color, #ef4444);
  }

  .session-controls {
    display: flex;
    gap: 0.5rem;
  }

  .control-button {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--border-color, #d1d5db);
    border-radius: 0.375rem;
    background-color: var(--bg-primary, #ffffff);
    color: var(--text-primary, #374151);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .control-button:hover {
    background-color: var(--bg-secondary, #f9fafb);
    border-color: var(--primary-color, #3b82f6);
  }

  .control-button.danger {
    border-color: var(--error-color, #ef4444);
    color: var(--error-color, #ef4444);
  }

  .control-button.danger:hover {
    background-color: var(--error-light, #fee2e2);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: var(--error-light, #fee2e2);
    border: 1px solid var(--error-color, #ef4444);
    color: var(--error-dark, #991b1b);
    font-size: 0.875rem;
  }

  .error-icon {
    font-weight: bold;
  }

  .error-text {
    flex: 1;
  }

  .error-dismiss {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: var(--error-color, #ef4444);
  }

  .session-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .default-content {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary, #6b7280);
  }

  .session-metadata {
    border-top: 1px solid var(--border-color, #e5e7eb);
    background-color: var(--bg-secondary, #f9fafb);
  }

  .metadata-section {
    padding: 1rem;
  }

  .metadata-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.5rem;
  }

  .metadata-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  .metadata-item label {
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
  }

  .metadata-item span {
    color: var(--text-primary, #111827);
    font-family: var(--font-mono, 'SF Mono', 'Monaco', 'Consolas', monospace);
  }
</style>