<!--
  SessionCreationFlow.svelte - Complete Session Creation Workflow
  
  Integrates TypePicker and CreationFormContainer to provide a complete
  session creation workflow with session type registry support.
-->

<script>
  import TypePicker from './TypePicker.svelte';
  import CreationFormContainer from './CreationFormContainer.svelte';
  
  // Props
  let { 
    projectId = null, 
    onSessionCreate = null, 
    onSessionCreated = null, 
    onCancel = null,
    disabled = false,
    showTitle = true 
  } = $props();
  
  // State
  let selectedSessionType = $state(null);
  let sessionCreationData = $state(null);
  let creationInProgress = $state(false);
  let creationError = $state(null);
  
  // Handle session creation data from form
  $effect(() => {
    if (sessionCreationData && !creationInProgress) {
      handleCreateSession(sessionCreationData);
    }
  });
  
  // Create session from form data
  async function handleCreateSession(sessionData) {
    if (creationInProgress) return;
    
    creationInProgress = true;
    creationError = null;
    
    try {
      // Validate required data
      if (!sessionData.sessionType && !selectedSessionType?.id) {
        throw new Error('Session type is required');
      }
      
      const finalSessionData = {
        ...sessionData,
        sessionType: sessionData.sessionType || selectedSessionType.id,
        projectId: projectId,
        timestamp: new Date().toISOString()
      };
      
      // Call session creation handler
      if (onSessionCreate) {
        const result = await onSessionCreate(finalSessionData);
        
        if (result && result.success) {
          // Reset form on successful creation
          selectedSessionType = null;
          sessionCreationData = null;
          
          // Notify of successful creation
          if (onSessionCreated) {
            onSessionCreated(result);
          }
        } else {
          throw new Error(result?.error || 'Session creation failed');
        }
      } else {
        throw new Error('No session creation handler provided');
      }
      
    } catch (error) {
      console.error('Session creation failed:', error);
      creationError = error.message;
    } finally {
      creationInProgress = false;
    }
  }
  
  // Handle form validation errors
  function handleValidationError(error) {
    console.error('Form validation error:', error);
    creationError = error.message || 'Form validation failed';
  }
  
  // Handle type selection
  function handleTypeSelection(type) {
    selectedSessionType = type;
    creationError = null; // Clear any previous errors
  }
  
  // Cancel session creation
  function handleCancel() {
    selectedSessionType = null;
    sessionCreationData = null;
    creationError = null;
    
    if (onCancel) {
      onCancel();
    }
  }
  
  // Clear error
  function clearError() {
    creationError = null;
  }
</script>

<div class="session-creation-flow" class:disabled>
  {#if showTitle}
    <div class="flow-header">
      <h3>Create New Session</h3>
      {#if onCancel}
        <button 
          class="cancel-button" 
          onclick={handleCancel}
          disabled={disabled || creationInProgress}
        >
          Cancel
        </button>
      {/if}
    </div>
  {/if}
  
  <!-- Error Display -->
  {#if creationError}
    <div class="error-banner" role="alert">
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span class="error-message">{creationError}</span>
        <button class="error-close" onclick={clearError} aria-label="Clear error">
          ×
        </button>
      </div>
    </div>
  {/if}
  
  <!-- Creation Progress -->
  {#if creationInProgress}
    <div class="progress-banner">
      <div class="progress-content">
        <div class="progress-spinner"></div>
        <span>Creating session...</span>
      </div>
    </div>
  {/if}
  
  <!-- Step 1: Session Type Selection -->
  <div class="creation-step" class:completed={selectedSessionType}>
    <div class="step-header">
      <div class="step-number">1</div>
      <h4 class="step-title">Choose Session Type</h4>
    </div>
    
    <div class="step-content">
      <TypePicker 
        bind:selectedType={selectedSessionType}
        onTypeSelect={handleTypeSelection}
      />
    </div>
  </div>
  
  <!-- Step 2: Session Configuration -->
  {#if selectedSessionType}
    <div class="creation-step active">
      <div class="step-header">
        <div class="step-number">2</div>
        <h4 class="step-title">Configure Session</h4>
      </div>
      
      <div class="step-content">
        <CreationFormContainer 
          selectedType={selectedSessionType}
          {projectId}
          bind:sessionData={sessionCreationData}
          onSessionCreate={(data) => sessionCreationData = data}
          onValidationError={handleValidationError}
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .session-creation-flow {
    width: 100%;
    max-width: 700px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .session-creation-flow.disabled {
    opacity: 0.6;
    pointer-events: none;
  }
  
  /* Header */
  .flow-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border, #e0e0e0);
  }
  
  .flow-header h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #333);
  }
  
  .cancel-button {
    padding: 0.5rem 1rem;
    background: transparent;
    color: var(--text-secondary, #666);
    border: 1px solid var(--border, #e0e0e0);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }
  
  .cancel-button:hover {
    background: var(--surface-hover, #f8f9fa);
    border-color: var(--border-hover, #ccc);
  }
  
  .cancel-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Error Banner */
  .error-banner {
    background: var(--error-light, #ffebee);
    border: 1px solid var(--error, #f44336);
    border-radius: 6px;
    padding: 0;
    overflow: hidden;
  }
  
  .error-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
  }
  
  .error-icon {
    font-size: 1.125rem;
    flex-shrink: 0;
  }
  
  .error-message {
    flex: 1;
    font-size: 0.9rem;
    color: var(--error-dark, #c62828);
    line-height: 1.4;
  }
  
  .error-close {
    background: none;
    border: none;
    color: var(--error-dark, #c62828);
    cursor: pointer;
    font-size: 1.25rem;
    font-weight: bold;
    padding: 0.25rem;
    border-radius: 3px;
    transition: background 0.2s ease;
  }
  
  .error-close:hover {
    background: rgba(0, 0, 0, 0.1);
  }
  
  /* Progress Banner */
  .progress-banner {
    background: var(--info-light, #e3f2fd);
    border: 1px solid var(--info, #2196f3);
    border-radius: 6px;
    padding: 0;
    overflow: hidden;
  }
  
  .progress-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
  }
  
  .progress-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--info-light, #e3f2fd);
    border-top: 2px solid var(--info, #2196f3);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    flex-shrink: 0;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .progress-content span {
    font-size: 0.9rem;
    color: var(--info-dark, #1565c0);
    font-weight: 500;
  }
  
  /* Creation Steps */
  .creation-step {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #e0e0e0);
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.3s ease;
  }
  
  .creation-step.active {
    border-color: var(--primary, #0066cc);
    box-shadow: 0 0 0 1px var(--primary-light, #e3f2fd);
  }
  
  .creation-step.completed {
    border-color: var(--success, #4caf50);
  }
  
  .step-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: var(--surface-variant, #f8f9fa);
    border-bottom: 1px solid var(--border, #e0e0e0);
  }
  
  .creation-step.active .step-header {
    background: var(--primary-light, #e3f2fd);
    border-color: var(--primary-light, #e3f2fd);
  }
  
  .creation-step.completed .step-header {
    background: var(--success-light, #e8f5e8);
    border-color: var(--success-light, #e8f5e8);
  }
  
  .step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--border, #e0e0e0);
    color: var(--text-secondary, #666);
    font-weight: 600;
    font-size: 0.9rem;
    flex-shrink: 0;
  }
  
  .creation-step.active .step-number {
    background: var(--primary, #0066cc);
    color: white;
  }
  
  .creation-step.completed .step-number {
    background: var(--success, #4caf50);
    color: white;
  }
  
  .step-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary, #333);
  }
  
  .step-content {
    padding: 1.5rem;
  }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    .session-creation-flow {
      gap: 1rem;
    }
    
    .flow-header {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }
    
    .cancel-button {
      align-self: flex-end;
    }
    
    .step-header {
      padding: 0.75rem 1rem;
    }
    
    .step-content {
      padding: 1rem;
    }
    
    .step-title {
      font-size: 1rem;
    }
  }
  
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .flow-header h3 {
      color: var(--text-primary-dark, #fff);
    }
    
    .cancel-button {
      color: var(--text-secondary-dark, #aaa);
      border-color: var(--border-dark, #404040);
    }
    
    .cancel-button:hover {
      background: var(--surface-hover-dark, #363636);
      border-color: var(--border-hover-dark, #555);
    }
    
    .creation-step {
      background: var(--surface-dark, #2d2d2d);
      border-color: var(--border-dark, #404040);
    }
    
    .step-header {
      background: var(--surface-variant-dark, #363636);
      border-color: var(--border-dark, #404040);
    }
    
    .step-title {
      color: var(--text-primary-dark, #fff);
    }
    
    .step-number {
      background: var(--border-dark, #404040);
      color: var(--text-secondary-dark, #aaa);
    }
  }
</style>