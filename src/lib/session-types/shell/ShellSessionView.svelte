<script>
  /**
   * ShellSessionView - Shell terminal session view component
   * 
   * MVVM Architecture:
   * - View: This component (presentation layer)
   * - ViewModel: Reactive state and computed properties using Svelte 5 runes
   * - Model: Session data structures and shell information
   * 
   * Integrates with Terminal.svelte to provide shell-specific functionality
   * and UI elements whi./components/Terminal.svelte interface.
   */
  
  import BaseSessionView from '../shared/BaseSessionView.svelte';
  import Terminal from './components/Terminal.svelte';
  
  // Props - using $props() for component input with callback props
  let {
    session = {},
    socket = null,
    projectId = null,
    readonly = false,
    onSessionAction = () => {},
    onConnected = () => {},
    onDisconnected = () => {},
    onError = () => {},
    onTerminalReady = () => {}
  } = $props();
  
  // ViewModel State - reactive state using $state()
  let terminalComponent = $state(null);
  // Model - Shell information derived from session data
  const shellInfo = $derived({
    shell: session.customData?.shell || '/bin/bash',
    pid: session.customData?.pid || null,
    env: session.customData?.env || {}
  });
  let isTerminalReady = $state(false);
  let terminalHistory = $state([]);
  
  // Derived state - computed properties using $derived()
  const isConnected = $derived(socket?.connected || false);
  const hasShellInfo = $derived(Boolean(shellInfo.shell));
  const environmentVariables = $derived(Object.entries(shellInfo.env || {}));
  const formattedShellInfo = $derived(() => {
    const parts = [];
    
    if (shellInfo.shell) {
      parts.push(`Shell: ${shellInfo.shell}`);
    }
    
    if (shellInfo.pid) {
      parts.push(`PID: ${shellInfo.pid}`);
    }
    
    return parts.join(' • ');
  });
  const historySize = $derived(terminalHistory.length);
  const hasEnvironmentVariables = $derived(environmentVariables.length > 0);
  
  
  /**
   * Attach to shell session
   * Service interaction - communicates with backend through socket
   */
  function attachToSession(sessionId) {
    if (!socket) {
      console.error('No socket connection available for attach operation');
      return;
    }
    
    socket.emit('attach-session', sessionId, (response) => {
      if (response.success) {
        onSessionAction({ action: 'attached', sessionId });
      } else {
        console.error('Failed to attach to session:', response.error);
        onError({ action: 'attach', error: response.error });
      }
    });
  }
  
  /**
   * Detach from shell session
   * Service interaction - maintains session lifecycle
   */
  function detachFromSession() {
    if (!socket) {
      console.error('No socket connection available for detach operation');
      return;
    }
    
    socket.emit('detach-session', (response) => {
      if (response.success) {
        onSessionAction({ action: 'detached', sessionId: response.sessionId });
      } else {
        console.error('Failed to detach from session:', response.error);
        onError({ action: 'detach', error: response.error });
      }
    });
  }
  
  /**
   * End shell session
   * Service interaction - handles session termination with user confirmation
   */
  function endSession(sessionId) {
    if (!socket) {
      console.error('No socket connection available for end operation');
      return;
    }
    
    const confirmed = confirm('Are you sure you want to end this shell session? This will terminate all running processes.');
    if (!confirmed) return;
    
    socket.emit('end-session', sessionId, (response) => {
      if (response.success) {
        onSessionAction({ action: 'ended', sessionId: response.sessionId });
      } else {
        console.error('Failed to end session:', response.error);
        onError({ action: 'end', error: response.error });
      }
    });
  }
  
  /**
   * Clear terminal screen
   * Terminal command - sends clear command to active session
   */
  function clearTerminal() {
    if (!socket?.sessionId) {
      console.error('No active session for clear terminal operation');
      return;
    }
    
    socket.emit('shell-command', { type: 'clear' }, (response) => {
      if (!response.success) {
        console.error('Failed to clear terminal:', response.error);
        onError({ action: 'clear', error: response.error });
      }
    });
  }
  
  /**
   * Send interrupt signal (Ctrl+C)
   * Terminal command - sends interrupt signal to active session
   */
  function sendInterrupt() {
    if (!socket?.sessionId) {
      console.error('No active session for interrupt operation');
      return;
    }
    
    socket.emit('shell-command', { type: 'interrupt' }, (response) => {
      if (!response.success) {
        console.error('Failed to send interrupt:', response.error);
        onError({ action: 'interrupt', error: response.error });
      }
    });
  }
  
  /**
   * Restart shell (close current and create new)
   * Service interaction - handles shell restart with user confirmation
   */
  function restartShell() {
    const confirmed = confirm('Restart shell? This will terminate the current shell process.');
    if (!confirmed) return;
    
    // Notify parent component of restart request
    onSessionAction({ action: 'restart-requested', sessionId: session.id });
    console.log('Shell restart requested for session:', session.id);
  }
  
  /**
   * Handle terminal ready event
   * ViewModel event handler - updates terminal ready state
   */
  function handleTerminalReady() {
    isTerminalReady = true;
    onTerminalReady();
  }
  
  /**
   * Handle terminal data for history tracking
   * ViewModel logic - manages terminal history state
   */
  function handleTerminalData(data) {
    // Track terminal output for potential history features
    const newEntry = {
      timestamp: new Date().toISOString(),
      data,
      type: 'output'
    };
    
    // Update history with immutable pattern
    terminalHistory = [...terminalHistory, newEntry];
    
    // Limit history size to prevent memory issues
    if (terminalHistory.length > 1000) {
      terminalHistory = terminalHistory.slice(-500);
    }
  }
  
  
  /**
   * Handle socket connection events
   * ViewModel event handlers - manage connection state and dispatch events
   */
  function handleSocketConnect() {
    console.log('Shell session socket connected');
    onConnected();
  }
  
  function handleSocketDisconnect() {
    isTerminalReady = false;
    console.log('Shell session socket disconnected');
    onDisconnected();
  }
  
  function handleSocketError(error) {
    console.error('Shell session socket error:', error);
    onError(error);
  }
  
  // Setup socket event listeners
  $effect(() => {
    if (socket) {
      socket.on('connect', handleSocketConnect);
      socket.on('disconnect', handleSocketDisconnect);
      socket.on('error', handleSocketError);
      
      return () => {
        socket.off('connect', handleSocketConnect);
        socket.off('disconnect', handleSocketDisconnect);
        socket.off('error', handleSocketError);
      };
    }
  });
</script>

<BaseSessionView
  {session}
  {socket}
  {projectId}
  {readonly}
  showControls={true}
  showMetadata={true}
  {onSessionAction}
  {onConnected}
  {onDisconnected}
  {onError}
>
  <!-- Custom session controls -->
  <div slot="session-controls" let:handleAction let:isConnected let:status>
    <div class="shell-controls">
      {#if isConnected && status === 'active'}
        <button
          class="control-button shell-action"
          on:click={clearTerminal}
          title="Clear terminal (Ctrl+L)"
        >
          Clear
        </button>
        <button
          class="control-button shell-action interrupt"
          on:click={sendInterrupt}
          title="Send interrupt (Ctrl+C)"
        >
          Stop
        </button>
        <button
          class="control-button shell-action"
          on:click={() => handleAction('detach')}
          title="Detach from session"
        >
          Detach
        </button>
        <button
          class="control-button shell-action danger"
          on:click={() => handleAction('end')}
          title="End session"
        >
          End
        </button>
      {:else if status === 'inactive' && session.supportsAttachment}
        <button
          class="control-button shell-action"
          on:click={() => handleAction('attach')}
          title="Attach to session"
        >
          Attach
        </button>
      {/if}
    </div>
  </div>

  <!-- Main terminal content -->
  <div class="shell-terminal-container">
    {#if socket}
      <Terminal
        bind:this={terminalComponent}
        {socket}
        sessionId={session.id}
        {projectId}
        {readonly}
        on:ready={handleTerminalReady}
        on:data={handleTerminalData}
        on:error
      />
    {:else}
      <div class="terminal-placeholder">
        <div class="placeholder-content">
          <div class="placeholder-icon">⚠</div>
          <p>No socket connection available</p>
          <p class="placeholder-detail">Unable to connect to shell session</p>
        </div>
      </div>
    {/if}
  </div>

  <!-- Custom metadata -->
  <div slot="metadata" let:session let:status let:lastActivity>
    <div class="metadata-section shell-metadata">
      <h4>Shell Information</h4>
      <div class="metadata-grid">
        <div class="metadata-item">
          <label>Shell:</label>
          <span class="shell-path">{shellInfo.shell}</span>
        </div>
        {#if shellInfo.pid}
          <div class="metadata-item">
            <label>Process ID:</label>
            <span>{shellInfo.pid}</span>
          </div>
        {/if}
        <div class="metadata-item">
          <label>Terminal Ready:</label>
          <span class="status-indicator" class:ready={isTerminalReady}>
            {isTerminalReady ? 'Yes' : 'No'}
          </span>
        </div>
        <div class="metadata-item">
          <label>History Size:</label>
          <span>{historySize} entries</span>
        </div>
      </div>

      {#if hasEnvironmentVariables}
        <div class="env-variables">
          <h5>Environment Variables</h5>
          <div class="env-list">
            {#each environmentVariables as [key, value]}
              <div class="env-item">
                <span class="env-key">{key}</span>
                <span class="env-value">{value}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</BaseSessionView>

<style>
  .shell-controls {
    display: flex;
    gap: 0.25rem;
  }

  .shell-action {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    min-width: auto;
  }

  .shell-action.interrupt {
    background-color: var(--warning-color, #f59e0b);
    border-color: var(--warning-color, #f59e0b);
    color: white;
  }

  .shell-action.interrupt:hover {
    background-color: var(--warning-color-hover, #d97706);
  }

  .shell-terminal-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 400px;
    background-color: var(--terminal-bg, #000000);
    border-radius: 0.375rem;
    overflow: hidden;
  }

  .terminal-placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-secondary, #f9fafb);
    border: 2px dashed var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    margin: 1rem;
  }

  .placeholder-content {
    text-align: center;
    color: var(--text-secondary, #6b7280);
  }

  .placeholder-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    color: var(--warning-color, #f59e0b);
  }

  .placeholder-detail {
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  .shell-metadata {
    background-color: var(--bg-tertiary, #f3f4f6);
  }

  .shell-path {
    font-family: var(--font-mono, 'SF Mono', 'Monaco', 'Consolas', monospace);
    background-color: var(--code-bg, #f1f5f9);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .status-indicator {
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    background-color: var(--error-light, #fee2e2);
    color: var(--error-dark, #991b1b);
  }

  .status-indicator.ready {
    background-color: var(--success-light, #d1fae5);
    color: var(--success-dark, #065f46);
  }

  .env-variables {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
  }

  .env-variables h5 {
    margin: 0 0 0.5rem 0;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .env-list {
    max-height: 120px;
    overflow-y: auto;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.25rem;
    background-color: var(--bg-primary, #ffffff);
  }

  .env-item {
    display: flex;
    padding: 0.25rem 0.5rem;
    font-family: var(--font-mono, 'SF Mono', 'Monaco', 'Consolas', monospace);
    font-size: 0.75rem;
    border-bottom: 1px solid var(--border-light, #f3f4f6);
  }

  .env-item:last-child {
    border-bottom: none;
  }

  .env-key {
    font-weight: 600;
    color: var(--primary-color, #3b82f6);
    min-width: 100px;
    flex-shrink: 0;
  }

  .env-key::after {
    content: '=';
    margin-left: 0.25rem;
    color: var(--text-secondary, #6b7280);
  }

  .env-value {
    color: var(--text-primary, #111827);
    word-break: break-all;
    margin-left: 0.5rem;
  }
</style>