<!-- 
  ShellSession - Thin UI component for shell terminal sessions
  
  All logic is handled by ShellSessionViewModel. This component only handles presentation.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { ShellSessionViewModel } from './ShellSessionViewModel.svelte.js';
  import TerminalComponent from './TerminalComponent.svelte';

  /** @type {{projectId: string, sessionOptions?: Object, onSessionCreated?: Function, onSessionEnded?: Function}} */
  let { 
    projectId,
    sessionOptions = {},
    onSessionCreated = () => {},
    onSessionEnded = () => {}
  } = $props();

  // ViewModel handles all logic
  const viewModel = new ShellSessionViewModel(projectId, sessionOptions);
  
  // Expose state and actions from ViewModel
  const state = $derived(viewModel.state);
  const actions = $derived(viewModel.actions);

  onMount(() => {
    // Set up callbacks
    viewModel.setCallbacks({ onSessionCreated, onSessionEnded });
    
    // Connect automatically
    actions.connect();
  });

  onDestroy(() => {
    actions.disconnect();
  });
</script>

<div class="shell-session">
  {#if state.error}
    <div class="error">
      <h3>Connection Error</h3>
      <p>{state.error}</p>
      <button onclick={actions.retry}>
        Retry
      </button>
    </div>
  {:else if state.isConnecting}
    <div class="loading">
      <h3>Connecting to Shell...</h3>
      <div class="spinner"></div>
      <p>Status: {state.connectionStatus}</p>
    </div>
  {:else if state.isReady}
    <!-- Simple terminal component - gets socket from ViewModel -->
    <TerminalComponent
      socket={state.socket}
      sessionId={state.sessionId}
      initialContent={state.terminalHistory}
      options={sessionOptions.terminalOptions || {}}
    />
    
    <div class="session-info">
      <span>Session: {state.sessionId}</span>
      <button class="end-session" onclick={actions.endSession}>
        End Session
      </button>
    </div>
  {/if}
</div>

<style>
  .shell-session {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .error, .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    text-align: center;
  }

  .error {
    background: var(--error-bg, #fee);
    color: var(--error-text, #c00);
  }

  .loading {
    background: var(--surface);
    color: var(--text);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--surface-variant);
    border-top: 3px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-top: 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .session-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: var(--surface);
    border-top: 1px solid var(--border);
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .end-session {
    background: var(--error);
    color: white;
    border: none;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .end-session:hover {
    background: var(--error-hover);
  }
</style>