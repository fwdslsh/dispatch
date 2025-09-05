<!-- 
  Simplified Project Page Component - MVVM Example
  
  This demonstrates how to use the ProjectPageViewModel to separate business logic
  from presentation. The component is now much simpler and focused only on UI.
-->

<script>
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  
  // UI Components
  import Container from '$lib/shared/components/Container.svelte';
  import HeaderToolbar from '$lib/shared/components/HeaderToolbar.svelte';
  import Terminal from '$lib/session-types/shell/components/Terminal.svelte';
  import Chat from '$lib/shared/components/ChatInterface.svelte';
  import BackIcon from '$lib/shared/components/Icons/BackIcon.svelte';
  
  // Session creation components
  import CreationFormContainer from '$lib/sessions/components/CreationFormContainer.svelte';
  import SessionList from '$lib/sessions/components/SessionList.svelte';
  
  // Simple ViewModel (not complex service injection)
  import { ProjectPageViewModel } from './ProjectPageViewModel.svelte.js';
  import { createClaudeAuthContext } from '$lib/session-types/claude/utils/claude-auth-context.svelte.js';
  
  // Create ViewModel with simple parameters
  const projectId = $derived(page.params.id);
  
  // Initialize socket (this could be from a simple shared store)
  let socket = null;
  let vm = null;
  
  // Claude auth context for chat components
  const claudeAuthContext = createClaudeAuthContext();
  
  // Initialize on mount
  onMount(async () => {
    // Simple socket connection (could be from a shared store)
    const { io } = await import('socket.io-client');
    socket = io();
    
    // Create ViewModel with simple parameters - no complex dependency injection
    vm = new ProjectPageViewModel(projectId, socket);
    
    // Initialize ViewModel
    await vm.initialize();
    
    // Cleanup on unmount
    return () => {
      vm?.destroy();
      socket?.disconnect();
    };
  });
  
  // Simple event handlers that delegate to ViewModel
  function handleCreateSession(sessionData) {
    vm?.handleCreateSession(sessionData);
  }
  
  function handleStartClaudeAuth() {
    vm?.startClaudeAuth();
  }
  
  function handleSubmitClaudeToken() {
    vm?.submitClaudeToken();
  }
  
  function handleBack() {
    vm?.hideAllComponents();
    goto('/projects');
  }
</script>

<!-- Clean template focused only on presentation -->
{#if vm?.isInitialized}
  <Container>
    <HeaderToolbar>
      <button onclick={handleBack} class="back-button">
        <BackIcon />
        Back to Projects
      </button>
      
      {#if vm.currentProject}
        <h1>{vm.currentProject.name}</h1>
        <p>{vm.currentProject.description}</p>
      {/if}
      
      <div class="status">
        {vm.isOnline ? '🟢 Online' : '🔴 Offline'}
      </div>
    </HeaderToolbar>

    <!-- Claude Authentication UI -->
    {#if vm.claudeAuthState === 'not-authenticated'}
      <div class="claude-auth-section">
        <h3>Claude Authentication Required</h3>
        <button onclick={handleStartClaudeAuth}>Authenticate with Claude</button>
      </div>
    {/if}

    {#if vm.claudeAuthState === 'waiting-for-token' && vm.claudeOAuthUrl}
      <div class="token-input-section">
        <p>Open this URL: <a href={vm.claudeOAuthUrl} target="_blank">{vm.claudeOAuthUrl}</a></p>
        <input 
          bind:value={vm.claudeAuthToken} 
          placeholder="Paste your token here"
        />
        <button onclick={handleSubmitClaudeToken}>Submit Token</button>
      </div>
    {/if}

    <!-- Session Creation Form - shown/hidden based on simple reactive state -->
    {#if vm.showSessionForm}
      <CreationFormContainer 
        onSessionCreate={handleCreateSession}
        availableTypes={[
          { id: 'shell', name: 'Shell Terminal' },
          ...(vm.canCreateClaude ? [{ id: 'claude', name: 'Claude Code' }] : [])
        ]}
      />
    {/if}

    <!-- Terminal Component - simple {#if} instead of complex mounting -->
    {#if vm.showTerminal && vm.currentSession}
      <Terminal 
        sessionId={vm.currentSession.sessionId}
        {socket}
      />
    {/if}

    <!-- Chat Component - simple {#if} instead of complex mounting -->
    {#if vm.showChat && vm.currentSession}
      <Chat 
        sessionId={vm.currentSession.sessionId}
        {socket}
        claudeAuthContext={claudeAuthContext}
      />
    {/if}

    <!-- Sessions List -->
    <SessionList 
      projectId={projectId}
      {socket}
    />

    <!-- Action Buttons -->
    <div class="actions">
      {#if !vm.showSessionForm && !vm.currentSession}
        <button onclick={() => vm.showCreateForm()}>
          Create New Session
        </button>
      {/if}
      
      {#if vm.currentSession}
        <button onclick={() => vm.hideAllComponents()}>
          Close Session
        </button>
      {/if}
    </div>
  </Container>

{:else}
  <!-- Simple loading state -->
  <Container>
    <p>Loading project...</p>
  </Container>
{/if}

<style>
  .back-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
  }

  .claude-auth-section {
    padding: 1rem;
    background: var(--warning-bg);
    border-radius: 8px;
    margin: 1rem 0;
  }

  .token-input-section {
    padding: 1rem;
    background: var(--info-bg);
    border-radius: 8px;
    margin: 1rem 0;
  }

  .token-input-section input {
    width: 100%;
    padding: 0.5rem;
    margin: 0.5rem 0;
    border: 1px solid var(--border);
    border-radius: 4px;
  }

  .actions {
    display: flex;
    gap: 1rem;
    padding: 1rem 0;
    justify-content: center;
  }

  .actions button {
    padding: 0.75rem 1.5rem;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .status {
    font-size: 0.9rem;
    font-weight: 500;
  }
</style>