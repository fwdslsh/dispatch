<!--
  ShellCreationForm.svelte - Shell Terminal Session Creation Form
  
  Provides shell-specific session configuration options including:
  - Session name input
  - Shell path selection
  - Environment variable management
  - Terminal dimensions
  - Advanced shell options
-->

<script>
  import DirectoryPicker from "$lib/sessions/components/DirectoryPicker.svelte";

  // Props
  let { 
    projectId = null, 
    sessionType = null,
    bind:sessionData = null,
    onError = null,
    socket = null
  } = $props();
  
  // Form state
  let sessionName = $state('');
  let shellPath = $state('/bin/bash');
  let workingDirectory = $state('');
  let loginShell = $state(false);
  let initialCommand = $state('');
  let environmentVars = $state({});
  
  // Validation state
  let validationErrors = $state({});
  let isValidating = $state(false);
  
  // Shell options state
  let envVarInput = $state({ key: '', value: '' });
  let showEnvEditor = $state(false);
  
  // Available shells
  const availableShells = [
    '/bin/bash',
    '/bin/sh',
    '/bin/zsh',
    '/bin/fish',
    '/usr/bin/fish'
  ];
  
  // Reactive validation
  $effect(() => {
    validateForm();
    updateSessionData();
  });
  
  // Validate form data
  function validateForm() {
    const errors = {};
    
    // Session name validation (optional but if provided must be valid)
    if (sessionName.trim() && sessionName.length < 3) {
      errors.sessionName = 'Session name must be at least 3 characters';
    }
    
    if (sessionName.length > 50) {
      errors.sessionName = 'Session name must be less than 50 characters';
    }
    
    // Shell path validation
    if (!shellPath.trim()) {
      errors.shellPath = 'Shell path is required';
    } else if (shellPath !== 'custom' && !shellPath.startsWith('/')) {
      errors.shellPath = 'Shell path must be absolute';
    }
    
    // Initial command validation
    if (initialCommand.length > 200) {
      errors.initialCommand = 'Initial command must be less than 200 characters';
    }
    
    validationErrors = errors;
    
    // Report validation errors
    if (Object.keys(errors).length > 0 && onError) {
      onError({ message: 'Form validation failed', errors });
    }
  }
  
  // Update session data for parent component
  function updateSessionData() {
    if (Object.keys(validationErrors).length > 0) {
      sessionData = null;
      return;
    }
    
    const finalSessionName = sessionName.trim() || `Shell Session ${Date.now()}`;
    
    sessionData = {
      sessionType: 'shell',
      name: finalSessionName,
      options: {
        shell: shellPath === 'custom' ? shellPath : shellPath,
        workingDirectory: workingDirectory.trim() || undefined,
        env: { ...environmentVars },
        loginShell,
        initialCommand: initialCommand.trim() || undefined,
        cols: 120,
        rows: 30
      }
    };
  }
  
  // Handle shell path change
  function handleShellChange(newPath) {
    shellPath = newPath;
  }
  
  // Add environment variable
  function addEnvVar() {
    if (envVarInput.key && envVarInput.value) {
      environmentVars[envVarInput.key] = envVarInput.value;
      environmentVars = { ...environmentVars }; // Trigger reactivity
      envVarInput.key = '';
      envVarInput.value = '';
    }
  }
  
  // Remove environment variable
  function removeEnvVar(key) {
    delete environmentVars[key];
    environmentVars = { ...environmentVars };
  }
  
  // Handle form submission
  function handleSubmit(event) {
    event.preventDefault();
    
    isValidating = true;
    validateForm();
    
    setTimeout(() => {
      isValidating = false;
      
      if (Object.keys(validationErrors).length === 0) {
        updateSessionData();
      }
    }, 100);
  }
  
  // Clear validation errors for a field
  function clearFieldError(fieldName) {
    const newErrors = { ...validationErrors };
    delete newErrors[fieldName];
    validationErrors = newErrors;
  }
</script>

<form class="shell-form" onsubmit={handleSubmit}>
  <div class="form-header">
    <h4 class="form-title">Configure Shell Terminal Session</h4>
    <p class="form-description">
      Set up your shell terminal with custom environment and configuration
    </p>
  </div>
  
  <div class="form-body">
    <!-- Session Name -->
    <div class="form-group">
      <label for="session-name" class="form-label">
        Session Name <span class="optional">(optional)</span>
      </label>
      <input
        type="text"
        id="session-name"
        class="form-input"
        class:error={validationErrors.sessionName}
        placeholder="e.g., Development Shell"
        bind:value={sessionName}
        oninput={() => clearFieldError('sessionName')}
        maxlength="50"
      />
      {#if validationErrors.sessionName}
        <div class="error-message">{validationErrors.sessionName}</div>
      {/if}
    </div>
    
    <!-- Shell Selection -->
    <div class="form-group">
      <label for="shell-path" class="form-label">Shell</label>
      <select
        id="shell-path"
        class="form-select"
        class:error={validationErrors.shellPath}
        bind:value={shellPath}
        onchange={() => clearFieldError('shellPath')}
      >
        {#each availableShells as shell}
          <option value={shell}>{shell}</option>
        {/each}
        <option value="custom">Custom...</option>
      </select>
      
      {#if shellPath === 'custom'}
        <input
          type="text"
          class="form-input custom-shell"
          placeholder="Enter custom shell path (e.g., /usr/local/bin/zsh)"
          bind:value={shellPath}
          oninput={() => clearFieldError('shellPath')}
        />
      {/if}
      
      {#if validationErrors.shellPath}
        <div class="error-message">{validationErrors.shellPath}</div>
      {/if}
    </div>
    
    <!-- Working Directory -->
    {#if projectId && socket}
      <div class="form-group">
        <label class="form-label">Working Directory</label>
        <DirectoryPicker
          bind:selectedPath={workingDirectory}
          {socket}
          {projectId}
          placeholder="Select directory (optional)"
          disabled={!socket}
        />
        <div class="help-text">Starting directory for the shell session</div>
      </div>
    {/if}
    
    <!-- Environment Variables -->
    <div class="form-group">
      <div class="env-header">
        <label class="form-label">Environment Variables</label>
        <button
          type="button"
          class="toggle-env"
          onclick={() => showEnvEditor = !showEnvEditor}
        >
          {showEnvEditor ? 'Hide' : 'Show'} Environment Editor
        </button>
      </div>
      
      {#if showEnvEditor}
        <div class="env-editor">
          <!-- Add new environment variable -->
          <div class="env-input-row">
            <input
              type="text"
              class="form-input env-key"
              placeholder="Variable name"
              bind:value={envVarInput.key}
            />
            <input
              type="text"
              class="form-input env-value"
              placeholder="Variable value"
              bind:value={envVarInput.value}
              onkeydown={(e) => e.key === 'Enter' && addEnvVar()}
            />
            <button
              type="button"
              class="add-env-btn"
              onclick={addEnvVar}
              disabled={!envVarInput.key || !envVarInput.value}
            >
              Add
            </button>
          </div>
          
          <!-- Existing environment variables -->
          {#if Object.keys(environmentVars).length > 0}
            <div class="env-list">
              {#each Object.entries(environmentVars) as [key, value]}
                <div class="env-item">
                  <span class="env-name">{key}</span>
                  <span class="env-equals">=</span>
                  <span class="env-value">{value}</span>
                  <button
                    type="button"
                    class="remove-env-btn"
                    onclick={() => removeEnvVar(key)}
                    title="Remove variable"
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <div class="env-empty">
              No custom environment variables set
            </div>
          {/if}
        </div>
      {/if}
    </div>
    
    <!-- Advanced Options -->
    <div class="form-group">
      <label class="form-label">Advanced Options</label>
      
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input
            type="checkbox"
            class="checkbox-input"
            bind:checked={loginShell}
          />
          <span class="checkbox-text">Login shell</span>
        </label>
      </div>
      <div class="help-text">
        Start shell as a login shell (loads login configuration files)
      </div>
    </div>
    
    <!-- Initial Command -->
    <div class="form-group">
      <label for="initial-command" class="form-label">
        Initial Command <span class="optional">(optional)</span>
      </label>
      <input
        id="initial-command"
        type="text"
        class="form-input"
        class:error={validationErrors.initialCommand}
        placeholder="Optional command to run on startup"
        bind:value={initialCommand}
        oninput={() => clearFieldError('initialCommand')}
        maxlength="200"
      />
      {#if validationErrors.initialCommand}
        <div class="error-message">{validationErrors.initialCommand}</div>
      {:else}
        <div class="help-text">Command will be executed after shell starts</div>
      {/if}
    </div>
    
    <!-- Submit Button (Hidden - form submission handled by parent) -->
    <button type="submit" class="hidden-submit" disabled={isValidating || Object.keys(validationErrors).length > 0}>
      Create Session
    </button>
  </div>
</form>

<style>
  .shell-form {
    width: 100%;
    max-width: 600px;
  }
  
  .form-header {
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border, #e0e0e0);
    margin-bottom: 1.5rem;
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
  
  .form-body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .form-label {
    font-weight: 500;
    color: var(--text-primary, #333);
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .optional {
    color: var(--text-secondary, #666);
    font-weight: normal;
    font-size: 0.8rem;
  }
  
  .form-input,
  .form-select {
    padding: 0.75rem;
    border: 1px solid var(--border, #e0e0e0);
    border-radius: 6px;
    background: var(--surface, #fff);
    color: var(--text-primary, #333);
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }
  
  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: var(--primary, #0066cc);
    box-shadow: 0 0 0 2px var(--primary-light, #e3f2fd);
  }
  
  .form-input.error,
  .form-select.error {
    border-color: var(--error, #f44336);
    box-shadow: 0 0 0 2px var(--error-light, #ffebee);
  }
  
  .custom-shell {
    margin-top: 0.5rem;
  }
  
  .env-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .toggle-env {
    background: none;
    border: none;
    color: var(--primary, #0066cc);
    cursor: pointer;
    font-size: 0.8rem;
    text-decoration: underline;
  }
  
  .toggle-env:hover {
    color: var(--primary-dark, #004499);
  }
  
  .env-editor {
    border: 1px solid var(--border, #e0e0e0);
    border-radius: 6px;
    padding: 0.75rem;
    background: var(--surface, #fff);
  }
  
  .env-input-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  
  .env-key {
    flex: 1;
  }
  
  .env-value {
    flex: 2;
  }
  
  .add-env-btn {
    background: var(--success, #10b981);
    color: white;
    border: none;
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .add-env-btn:hover:not(:disabled) {
    background: var(--success-dark, #059669);
  }
  
  .add-env-btn:disabled {
    background: var(--disabled, #9ca3af);
    cursor: not-allowed;
  }
  
  .env-list {
    max-height: 200px;
    overflow-y: auto;
  }
  
  .env-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
    font-family: var(--font-mono, 'SF Mono', 'Monaco', 'Consolas', monospace);
    font-size: 0.875rem;
  }
  
  .env-name {
    font-weight: 600;
    color: var(--primary, #0066cc);
  }
  
  .env-equals {
    color: var(--text-secondary, #666);
  }
  
  .env-value {
    flex: 1;
    color: var(--text-primary, #333);
    word-break: break-all;
  }
  
  .remove-env-btn {
    background: var(--error, #f44336);
    color: white;
    border: none;
    border-radius: 50%;
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.875rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
  }
  
  .remove-env-btn:hover {
    background: var(--error-dark, #dc2626);
  }
  
  .env-empty {
    color: var(--text-secondary, #666);
    font-style: italic;
    text-align: center;
    padding: 1rem;
  }
  
  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.5rem 0;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .checkbox-input {
    width: 18px;
    height: 18px;
    accent-color: var(--primary, #0066cc);
  }
  
  .checkbox-text {
    color: var(--text-primary, #333);
    user-select: none;
  }
  
  .error-message {
    color: var(--error, #f44336);
    font-size: 0.8rem;
    padding: 0.25rem 0;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .error-message::before {
    content: '⚠️';
    font-size: 0.9rem;
  }
  
  .help-text {
    color: var(--text-secondary, #666);
    font-size: 0.8rem;
    line-height: 1.4;
  }
  
  .hidden-submit {
    display: none;
  }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    .form-header {
      padding-bottom: 1rem;
      margin-bottom: 1rem;
    }
    
    .form-body {
      gap: 1rem;
    }
    
    .form-input,
    .form-select {
      padding: 0.6rem;
    }
    
    .env-input-row {
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .env-key,
    .env-value {
      flex: none;
    }
  }
  
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .form-title {
      color: var(--text-primary-dark, #fff);
    }
    
    .form-description {
      color: var(--text-secondary-dark, #aaa);
    }
    
    .form-label {
      color: var(--text-primary-dark, #fff);
    }
    
    .optional {
      color: var(--text-secondary-dark, #aaa);
    }
    
    .form-input,
    .form-select {
      background: var(--surface-dark, #2d2d2d);
      border-color: var(--border-dark, #404040);
      color: var(--text-primary-dark, #fff);
    }
    
    .env-editor {
      background: var(--surface-dark, #2d2d2d);
      border-color: var(--border-dark, #404040);
    }
    
    .checkbox-text {
      color: var(--text-primary-dark, #fff);
    }
    
    .help-text {
      color: var(--text-secondary-dark, #aaa);
    }
    
    .env-value {
      color: var(--text-primary-dark, #fff);
    }
    
    .env-equals {
      color: var(--text-secondary-dark, #aaa);
    }
    
    .env-empty {
      color: var(--text-secondary-dark, #aaa);
    }
  }
</style>