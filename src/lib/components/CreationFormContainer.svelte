<!--
  CreationFormContainer.svelte - Dynamic Form Container
  
  Conditionally renders session creation forms based on selected session type.
  Provides static conditional form rendering using dynamic imports for optimal
  build-time optimization and code splitting.
-->

<script>
  import { onMount } from 'svelte';
  
  // Props
  let { selectedType = null, projectId = null, onSessionCreate = null, onValidationError = null } = $props();
  
  // Dynamic form components - loaded on demand
  let formComponents = $state({});
  let loadingStates = $state({});
  let errorStates = $state({});
  
  // Form data binding
  let sessionData = $state(null);
  
  // Status for accessibility
  let formStatus = $state('');
  
  // Static form component mapping for build-time optimization
  const formComponentMap = {
    shell: () => import('../session-types/shell/ShellCreationForm.svelte'),
    claude: () => import('../session-types/claude/ClaudeCreationForm.svelte')
  };
  
  // Load form component dynamically
  async function loadFormComponent(sessionTypeId) {
    if (formComponents[sessionTypeId] || loadingStates[sessionTypeId]) {
      return;
    }
    
    const formLoader = formComponentMap[sessionTypeId];
    if (!formLoader) {
      errorStates[sessionTypeId] = `Unsupported session type: ${sessionTypeId}`;
      return;
    }
    
    loadingStates[sessionTypeId] = true;
    
    try {
      const module = await formLoader();
      formComponents[sessionTypeId] = module.default;
      errorStates[sessionTypeId] = null;
      formStatus = `${selectedType?.name || 'Session'} form loaded`;
    } catch (error) {
      console.error(`Failed to load form for ${sessionTypeId}:`, error);
      errorStates[sessionTypeId] = 'Error loading form component';
      formStatus = 'Error loading form';
    } finally {
      loadingStates[sessionTypeId] = false;
    }
  }
  
  // Reactive form loading
  $effect(() => {
    if (selectedType?.id && formComponentMap[selectedType.id]) {
      loadFormComponent(selectedType.id);
    }
  });
  
  // Clear session data when type changes
  $effect(() => {
    if (selectedType) {
      sessionData = null;
    }
  });
  
  // Handle session creation events
  $effect(() => {
    if (sessionData && onSessionCreate) {
      onSessionCreate(sessionData);
    }
  });
  
  // Validate session type
  function isValidSessionType(type) {
    return type && 
           typeof type.id === 'string' && 
           type.id.length > 0 &&
           typeof type.name === 'string' && 
           type.name.length > 0;
  }
  
  // Check if project is required but missing
  function isProjectRequired(type) {
    return type?.requiresProject && !projectId;
  }
  
  // Get current form component
  function getCurrentFormComponent() {
    return selectedType?.id ? formComponents[selectedType.id] : null;
  }
  
  // Handle form errors
  function handleFormError(error) {
    console.error('Form validation error:', error);
    if (onValidationError) {
      onValidationError(error);
    }
  }
</script>

<main class="form-container" role="main" aria-label="Session creation form">
  <!-- Live region for screen reader announcements -->
  <div class="sr-only" aria-live="polite" aria-label="Form status">
    {formStatus}
  </div>
  
  {#if !selectedType}
    <!-- No session type selected -->
    <div class="placeholder-state">
      <div class="placeholder-icon">📝</div>
      <h3>Select a session type to continue</h3>
      <p>Choose a session type from the options above to configure your new session.</p>
    </div>
    
  {:else if !isValidSessionType(selectedType)}
    <!-- Invalid session type -->
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <h3>Invalid session type</h3>
      <p>The selected session type is invalid or corrupted.</p>
      <details>
        <summary>Technical details</summary>
        <pre>{JSON.stringify(selectedType, null, 2)}</pre>
      </details>
    </div>
    
  {:else if isProjectRequired(selectedType)}
    <!-- Project required but not provided -->
    <div class="warning-state">
      <div class="warning-icon">🏗️</div>
      <h3>Project required</h3>
      <p>
        The <strong>{selectedType.name}</strong> session type requires a project to be selected.
        Please select or create a project first.
      </p>
    </div>
    
  {:else if errorStates[selectedType.id]}
    <!-- Form loading error -->
    <div class="error-state">
      <div class="error-icon">❌</div>
      <h3>Error loading form</h3>
      <p>{errorStates[selectedType.id]}</p>
      <button 
        class="retry-button"
        onclick={() => loadFormComponent(selectedType.id)}
      >
        Retry
      </button>
    </div>
    
  {:else if loadingStates[selectedType.id]}
    <!-- Loading form component -->
    <div class="loading-state">
      <div class="loading-spinner" aria-label="Loading"></div>
      <h3>Loading {selectedType.name} form...</h3>
    </div>
    
  {:else if formComponentMap[selectedType.id] && getCurrentFormComponent()}
    <!-- Render appropriate form component -->
    <div class="form-wrapper">
      <div class="form-header">
        <h3 class="form-title">
          Configure {selectedType.name}
        </h3>
        <p class="form-description">
          {selectedType.description}
        </p>
      </div>
      
      <div class="form-content">
        <svelte:component 
          this={getCurrentFormComponent()}
          {projectId}
          sessionType={selectedType}
          bind:sessionData
          onError={handleFormError}
        />
      </div>
    </div>
    
  {:else}
    <!-- Unsupported session type -->
    <div class="error-state">
      <div class="error-icon">🚫</div>
      <h3>Unsupported session type</h3>
      <p>
        The session type <strong>{selectedType.name}</strong> (ID: {selectedType.id}) 
        is not supported by this interface.
      </p>
      <details>
        <summary>Available session types</summary>
        <ul>
          {#each Object.keys(formComponentMap) as typeId}
            <li>{typeId}</li>
          {/each}
        </ul>
      </details>
    </div>
  {/if}
</main>

<style>
  .form-container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    padding: 1rem;
  }
  
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  
  /* State containers */
  .placeholder-state,
  .error-state,
  .warning-state,
  .loading-state {
    text-align: center;
    padding: 2rem;
    border-radius: 8px;
    border: 2px solid var(--border, #e0e0e0);
  }
  
  .placeholder-state {
    background: var(--surface, #f8f9fa);
    color: var(--text-secondary, #666);
  }
  
  .error-state {
    background: var(--error-light, #ffebee);
    color: var(--error-dark, #c62828);
    border-color: var(--error, #f44336);
  }
  
  .warning-state {
    background: var(--warning-light, #fff8e1);
    color: var(--warning-dark, #f57c00);
    border-color: var(--warning, #ffb74d);
  }
  
  .loading-state {
    background: var(--info-light, #e3f2fd);
    color: var(--info-dark, #1565c0);
    border-color: var(--info, #2196f3);
  }
  
  /* Icons */
  .placeholder-icon,
  .error-icon,
  .warning-icon {
    font-size: 2rem;
    margin-bottom: 1rem;
    display: block;
  }
  
  /* Loading spinner */
  .loading-spinner {
    width: 40px;
    height: 40px;
    margin: 0 auto 1rem;
    border: 3px solid var(--info-light, #e3f2fd);
    border-top: 3px solid var(--info, #2196f3);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  /* State headings and text */
  .placeholder-state h3,
  .error-state h3,
  .warning-state h3,
  .loading-state h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  
  .placeholder-state p,
  .error-state p,
  .warning-state p,
  .loading-state p {
    margin: 0;
    line-height: 1.5;
  }
  
  /* Retry button */
  .retry-button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: var(--primary, #0066cc);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s ease;
  }
  
  .retry-button:hover {
    background: var(--primary-dark, #004499);
  }
  
  /* Details/summary styling */
  details {
    margin-top: 1rem;
    text-align: left;
  }
  
  summary {
    cursor: pointer;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }
  
  pre {
    background: rgba(0, 0, 0, 0.1);
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.8rem;
    text-align: left;
  }
  
  ul {
    text-align: left;
    padding-left: 1.5rem;
  }
  
  /* Form wrapper */
  .form-wrapper {
    background: var(--surface, #fff);
    border: 1px solid var(--border, #e0e0e0);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .form-header {
    padding: 1.5rem;
    background: var(--surface-variant, #f8f9fa);
    border-bottom: 1px solid var(--border, #e0e0e0);
  }
  
  .form-title {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary, #333);
  }
  
  .form-description {
    margin: 0;
    color: var(--text-secondary, #666);
    line-height: 1.5;
  }
  
  .form-content {
    padding: 1.5rem;
  }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    .form-container {
      padding: 0.5rem;
    }
    
    .placeholder-state,
    .error-state,
    .warning-state,
    .loading-state {
      padding: 1.5rem 1rem;
    }
    
    .form-header,
    .form-content {
      padding: 1rem;
    }
    
    .form-title {
      font-size: 1.125rem;
    }
    
    pre {
      font-size: 0.75rem;
      padding: 0.75rem;
    }
  }
  
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .placeholder-state {
      background: var(--surface-dark, #2d2d2d);
      color: var(--text-secondary-dark, #aaa);
      border-color: var(--border-dark, #404040);
    }
    
    .form-wrapper {
      background: var(--surface-dark, #2d2d2d);
      border-color: var(--border-dark, #404040);
    }
    
    .form-header {
      background: var(--surface-variant-dark, #363636);
      border-color: var(--border-dark, #404040);
    }
    
    .form-title {
      color: var(--text-primary-dark, #fff);
    }
    
    .form-description {
      color: var(--text-secondary-dark, #aaa);
    }
    
    summary {
      background: rgba(255, 255, 255, 0.05);
    }
    
    pre {
      background: rgba(255, 255, 255, 0.1);
    }
  }
</style>