<script>
  /**
   * ClaudeSessionView - Claude AI session view component
   * 
   * MVVM Architecture:
   * - View: This component (presentation layer)
   * - ViewModel: Reactive state and computed properties using Svelte 5 runes
   * - Model: Session data structures and Claude AI configuration
   * 
   * Integrates with ChatInterface.svelte for AI conversations while maintaining
   * terminal access for code execution and file operations.
   */
  
  import { createEventDispatcher } from 'svelte';
  import BaseSessionView from '../base/BaseSessionView.svelte';
  import Terminal from '../../components/Terminal.svelte';
  import ChatInterface from '../../components/ChatInterface.svelte';
  
  // Props - using $props() for component input
  const {
    session = {},
    socket = null,
    projectId = null,
    readonly = false
  } = $props();
  
  // ViewModel State - reactive state using $state()
  let terminalComponent = $state(null);
  let chatComponent = $state(null);
  let showChat = $state(true); // Claude sessions default to showing chat
  let isTerminalReady = $state(false);
  let conversationHistory = $state([]);
  
  // Model - Claude configuration derived from session data
  const claudeConfig = $derived({
    model: session.customData?.claudeModel || 'claude-3.5-sonnet',
    maxTokens: session.customData?.maxTokens || 8192,
    temperature: session.customData?.temperature || 0.7,
    authToken: session.customData?.authToken ? '***masked***' : null,
    capabilities: session.customData?.capabilities || {
      codeExecution: true,
      fileAccess: true
    }
  });
  
  // Derived state - computed properties using $derived()
  const isConnected = $derived(socket?.connected || false);
  const hasClaudeConfig = $derived(Boolean(claudeConfig.model));
  const formattedClaudeInfo = $derived(() => {
    const parts = [];
    
    if (claudeConfig.model) {
      parts.push(`Model: ${claudeConfig.model}`);
    }
    
    if (claudeConfig.maxTokens) {
      parts.push(`Max Tokens: ${claudeConfig.maxTokens}`);
    }
    
    if (claudeConfig.temperature !== undefined) {
      parts.push(`Temperature: ${claudeConfig.temperature}`);
    }
    
    return parts.join(' • ');
  });
  const historySize = $derived(conversationHistory.length);
  const hasCapabilities = $derived(Object.keys(claudeConfig.capabilities || {}).length > 0);

  // Event dispatcher for communication with parent components
  const dispatch = createEventDispatcher();
  
  /**
   * Handle session actions from BaseSessionView
   * ViewModel Controller - handles UI interaction logic
   */
  function handleSessionAction(event) {
    const { action, sessionId, data } = event.detail;
    
    // Action dispatch pattern following MVVM principles
    const actionHandlers = {
      attach: () => attachToSession(sessionId),
      detach: () => detachFromSession(),
      end: () => endSession(sessionId),
      clear: () => clearChat(),
      restart: () => restartClaude(),
      'toggle-chat': () => toggleChatView(),
      'clear-conversation': () => clearConversationHistory(),
    };
    
    const handler = actionHandlers[action];
    if (handler) {
      handler();
    } else {
      console.warn('Unknown session action:', action);
    }
  }
  
  /**
   * Toggle between chat and terminal view
   * ViewModel Controller - manages view state
   */
  function toggleChatView() {
    showChat = !showChat;
    dispatch('viewChanged', { showChat });
  }
  
  /**
   * Attach to Claude session
   * Service interaction - communicates with backend through socket
   */
  function attachToSession(sessionId) {
    if (!socket) {
      console.error('No socket connection available for attach operation');
      return;
    }
    
    socket.emit('attach-session', sessionId, (response) => {
      if (response.success) {
        dispatch('sessionAction', { action: 'attached', sessionId });
      } else {
        console.error('Failed to attach to Claude session:', response.error);
        dispatch('error', { action: 'attach', error: response.error });
      }
    });
  }
  
  /**
   * Detach from Claude session
   * Service interaction - maintains session lifecycle
   */
  function detachFromSession() {
    if (!socket) {
      console.error('No socket connection available for detach operation');
      return;
    }
    
    socket.emit('detach-session', (response) => {
      if (response.success) {
        dispatch('sessionAction', { action: 'detached', sessionId: response.sessionId });
      } else {
        console.error('Failed to detach from Claude session:', response.error);
        dispatch('error', { action: 'detach', error: response.error });
      }
    });
  }
  
  /**
   * End Claude session
   * Service interaction - handles session termination with user confirmation
   */
  function endSession(sessionId) {
    if (!socket) {
      console.error('No socket connection available for end operation');
      return;
    }
    
    const confirmed = confirm('Are you sure you want to end this Claude session? This will terminate the AI conversation and any running processes.');
    if (!confirmed) return;
    
    socket.emit('end-session', sessionId, (response) => {
      if (response.success) {
        dispatch('sessionAction', { action: 'ended', sessionId: response.sessionId });
      } else {
        console.error('Failed to end Claude session:', response.error);
        dispatch('error', { action: 'end', error: response.error });
      }
    });
  }
  
  /**
   * Clear chat interface
   * Chat command - clears chat history
   */
  function clearChat() {
    if (chatComponent && typeof chatComponent.clearHistory === 'function') {
      chatComponent.clearHistory();
      dispatch('chatCleared');
    }
  }
  
  /**
   * Clear Claude conversation history
   * Service interaction - clears server-side conversation history
   */
  function clearConversationHistory() {
    if (!socket?.sessionId) {
      console.error('No active Claude session for clear conversation operation');
      return;
    }
    
    socket.emit('clear-conversation', (response) => {
      if (response.success) {
        clearChat(); // Also clear local chat
        conversationHistory = [];
        dispatch('conversationCleared');
      } else {
        console.error('Failed to clear conversation history:', response.error);
        dispatch('error', { action: 'clear-conversation', error: response.error });
      }
    });
  }
  
  /**
   * Send Claude message
   * Service interaction - sends message to Claude AI
   */
  function sendClaudeMessage(message) {
    if (!socket?.sessionId) {
      console.error('No active Claude session for message sending');
      return;
    }
    
    socket.emit('claude-message', { message }, (response) => {
      if (!response.success) {
        console.error('Failed to send Claude message:', response.error);
        dispatch('error', { action: 'send-message', error: response.error });
      }
    });
  }
  
  /**
   * Update Claude model settings
   * Service interaction - updates AI model configuration
   */
  function updateModelSettings(settings) {
    if (!socket?.sessionId) {
      console.error('No active Claude session for settings update');
      return;
    }
    
    socket.emit('update-model-settings', settings, (response) => {
      if (response.success) {
        dispatch('modelSettingsUpdated', { settings: response.settings });
      } else {
        console.error('Failed to update model settings:', response.error);
        dispatch('error', { action: 'update-settings', error: response.error });
      }
    });
  }
  
  /**
   * Restart Claude session (close current and create new)
   * Service interaction - handles Claude restart with user confirmation
   */
  function restartClaude() {
    const confirmed = confirm('Restart Claude session? This will end the current AI conversation and start fresh.');
    if (!confirmed) return;
    
    // Notify parent component of restart request
    dispatch('sessionAction', { action: 'restart-requested', sessionId: session.id });
    console.log('Claude restart requested for session:', session.id);
  }
  
  /**
   * Handle terminal ready event
   * ViewModel event handler - updates terminal ready state
   */
  function handleTerminalReady() {
    isTerminalReady = true;
    dispatch('terminalReady');
  }
  
  /**
   * Handle terminal data for integration with Claude
   * ViewModel logic - manages terminal-AI integration
   */
  function handleTerminalData(data) {
    // Terminal output can be used to provide context to Claude
    dispatch('terminalOutput', { data });
  }
  
  /**
   * Handle chat messages
   * ViewModel event handler - manages chat integration
   */
  function handleChatMessage(message) {
    // Add to local history for display
    const newEntry = {
      id: Date.now().toString(),
      role: message.sender === 'user' ? 'user' : 'assistant',
      content: message.content,
      timestamp: new Date().toISOString()
    };
    
    conversationHistory = [...conversationHistory, newEntry];
    
    // Send to Claude if it's a user message
    if (message.sender === 'user') {
      sendClaudeMessage(message.content);
    }
  }
  
  /**
   * Handle socket connection events
   * ViewModel event handlers - manage connection state and dispatch events
   */
  function handleSocketConnect() {
    console.log('Claude session socket connected');
    dispatch('connected');
  }
  
  function handleSocketDisconnect() {
    isTerminalReady = false;
    console.log('Claude session socket disconnected');
    dispatch('disconnected');
  }
  
  function handleSocketError(error) {
    console.error('Claude session socket error:', error);
    dispatch('error', error);
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
  on:sessionAction={handleSessionAction}
>
  <!-- Custom session controls -->
  <div slot="session-controls" let:handleAction let:isConnected let:status>
    <div class="claude-controls">
      {#if isConnected && status === 'active'}
        <button
          class="control-button claude-action view-toggle"
          on:click={toggleChatView}
          title={showChat ? 'Show terminal' : 'Show chat'}
        >
          {showChat ? 'Terminal' : 'Chat'}
        </button>
        <button
          class="control-button claude-action"
          on:click={() => handleAction('clear-conversation')}
          title="Clear conversation history"
        >
          Clear
        </button>
        <button
          class="control-button claude-action"
          on:click={() => handleAction('detach')}
          title="Detach from session"
        >
          Detach
        </button>
        <button
          class="control-button claude-action danger"
          on:click={() => handleAction('end')}
          title="End session"
        >
          End
        </button>
      {:else if status === 'inactive' && session.supportsAttachment}
        <button
          class="control-button claude-action"
          on:click={() => handleAction('attach')}
          title="Attach to session"
        >
          Attach
        </button>
      {/if}
    </div>
  </div>

  <!-- Main session content -->
  <div class="claude-session-container">
    {#if socket}
      <div class="claude-layout" class:split-view={showChat} class:terminal-only={!showChat}>
        {#if showChat}
          <!-- Split view: Chat and Terminal -->
          <div class="chat-section">
            <ChatInterface
              bind:this={chatComponent}
              {socket}
              sessionId={session.id}
              on:sendMessage={handleChatMessage}
            />
          </div>
          <div class="terminal-section">
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
          </div>
        {:else}
          <!-- Terminal only view -->
          <div class="terminal-only-section">
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
          </div>
        {/if}
      </div>
    {:else}
      <div class="session-placeholder">
        <div class="placeholder-content">
          <div class="placeholder-icon">🤖</div>
          <p>No socket connection available</p>
          <p class="placeholder-detail">Unable to connect to Claude session</p>
        </div>
      </div>
    {/if}
  </div>

  <!-- Custom metadata -->
  <div slot="metadata" let:session let:status let:lastActivity>
    <div class="metadata-section claude-metadata">
      <h4>Claude Configuration</h4>
      <div class="metadata-grid">
        <div class="metadata-item">
          <label>Model:</label>
          <span class="claude-model">{claudeConfig.model}</span>
        </div>
        <div class="metadata-item">
          <label>Max Tokens:</label>
          <span>{claudeConfig.maxTokens}</span>
        </div>
        <div class="metadata-item">
          <label>Temperature:</label>
          <span>{claudeConfig.temperature}</span>
        </div>
        <div class="metadata-item">
          <label>Authentication:</label>
          <span class="status-indicator" class:authenticated={claudeConfig.authToken}>
            {claudeConfig.authToken ? 'Active' : 'Not configured'}
          </span>
        </div>
        <div class="metadata-item">
          <label>Terminal Ready:</label>
          <span class="status-indicator" class:ready={isTerminalReady}>
            {isTerminalReady ? 'Yes' : 'No'}
          </span>
        </div>
        <div class="metadata-item">
          <label>Conversation:</label>
          <span>{historySize} messages</span>
        </div>
      </div>

      {#if hasCapabilities}
        <div class="capabilities">
          <h5>Capabilities</h5>
          <div class="capability-list">
            <div class="capability-item">
              <span class="capability-name">Code Execution:</span>
              <span class="capability-status" class:enabled={claudeConfig.capabilities.codeExecution}>
                {claudeConfig.capabilities.codeExecution ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div class="capability-item">
              <span class="capability-name">File Access:</span>
              <span class="capability-status" class:enabled={claudeConfig.capabilities.fileAccess}>
                {claudeConfig.capabilities.fileAccess ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</BaseSessionView>

<style>
  .claude-controls {
    display: flex;
    gap: 0.25rem;
  }

  .claude-action {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    min-width: auto;
  }

  .claude-action.view-toggle {
    background-color: var(--primary-color, #3b82f6);
    border-color: var(--primary-color, #3b82f6);
    color: white;
  }

  .claude-action.view-toggle:hover {
    background-color: var(--primary-color-hover, #2563eb);
  }

  .claude-session-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 400px;
    background-color: var(--bg-primary, #ffffff);
    border-radius: 0.375rem;
    overflow: hidden;
  }

  .claude-layout {
    flex: 1;
    display: flex;
  }

  .claude-layout.split-view {
    flex-direction: row;
  }

  .claude-layout.terminal-only {
    flex-direction: column;
  }

  .chat-section {
    flex: 1;
    min-width: 300px;
    border-right: 1px solid var(--border-color, #e5e7eb);
    background-color: var(--bg-secondary, #f9fafb);
  }

  .terminal-section {
    flex: 1;
    min-width: 400px;
    background-color: var(--terminal-bg, #000000);
  }

  .terminal-only-section {
    flex: 1;
    background-color: var(--terminal-bg, #000000);
  }

  .session-placeholder {
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
  }

  .placeholder-detail {
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  .claude-metadata {
    background-color: var(--bg-tertiary, #f3f4f6);
  }

  .claude-model {
    font-family: var(--font-mono, 'SF Mono', 'Monaco', 'Consolas', monospace);
    background-color: var(--code-bg, #f1f5f9);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    color: var(--primary-color, #3b82f6);
    font-weight: 600;
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

  .status-indicator.ready,
  .status-indicator.authenticated {
    background-color: var(--success-light, #d1fae5);
    color: var(--success-dark, #065f46);
  }

  .capabilities {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color, #e5e7eb);
  }

  .capabilities h5 {
    margin: 0 0 0.5rem 0;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .capability-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .capability-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
  }

  .capability-name {
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
  }

  .capability-status {
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    background-color: var(--error-light, #fee2e2);
    color: var(--error-dark, #991b1b);
  }

  .capability-status.enabled {
    background-color: var(--success-light, #d1fae5);
    color: var(--success-dark, #065f46);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .claude-layout.split-view {
      flex-direction: column;
    }

    .chat-section {
      border-right: none;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
      min-height: 300px;
    }

    .terminal-section {
      min-width: auto;
    }
  }
</style>