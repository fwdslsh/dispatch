<script>
  /**
   * ShellCreationForm - Creation form for shell terminal sessions
   * 
   * Extends BaseCreationForm with shell-specific options and validation.
   */
  
  import { createEventDispatcher } from 'svelte';
  import BaseCreationForm from '../base/BaseCreationForm.svelte';
  
  // Props
  let { 
    initialData = {},
    disabled = false
  } = $props();
  
  // Shell-specific default data
  const shellDefaults = {
    shell: '/bin/bash',
    env: {},
    ...initialData
  };
  
  // State
  let shellOptions = $state({
    shell: shellDefaults.shell,
    env: { ...shellDefaults.env }
  });
  
  let availableShells = $state([
    '/bin/bash',
    '/bin/sh',
    '/bin/zsh',
    '/bin/fish',
    '/usr/bin/fish'
  ]);
  
  let envVarInput = $state({ key: '', value: '' });
  let showEnvEditor = $state(false);
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  /**
   * Handle shell option changes
   */
  function handleShellChange(field, value) {
    shellOptions[field] = value;
    
    // Emit data change with shell options
    const customOptions = {
      shell: shellOptions.shell,
      env: { ...shellOptions.env }
    };
    
    dispatch('dataChange', { customOptions });
  }
  
  /**
   * Add environment variable
   */
  function addEnvVar() {
    if (envVarInput.key && envVarInput.value) {
      shellOptions.env[envVarInput.key] = envVarInput.value;
      envVarInput.key = '';
      envVarInput.value = '';
      handleShellChange('env', shellOptions.env);
    }
  }
  
  /**
   * Remove environment variable
   */
  function removeEnvVar(key) {
    delete shellOptions.env[key];
    shellOptions.env = { ...shellOptions.env };
    handleShellChange('env', shellOptions.env);
  }
  
  /**
   * Handle form data changes from base component
   */
  function handleBaseDataChange(event) {
    dispatch('dataChange', event.detail);
  }
</script>

<BaseCreationForm
  initialData={shellDefaults}
  requiresProject={false}
  submitLabel="Create Shell Session"
  {disabled}
  on:dataChange={handleBaseDataChange}
  on:submit
>
  <!-- Custom shell options -->
  <div slot="custom-options" let:formData let:handleInput let:disabled let:errors>
    <div class="shell-options">
      <h4>Shell Configuration</h4>
      
      <!-- Shell Selection -->
      <div class="form-group">
        <label for="shell-path" class="form-label">Shell</label>
        <select
          id="shell-path"
          class="form-select"
          bind:value={shellOptions.shell}
          on:change={(e) => handleShellChange('shell', e.target.value)}
          {disabled}
        >
          {#each availableShells as shell}
            <option value={shell}>{shell}</option>
          {/each}
          <option value="custom">Custom...</option>
        </select>
        
        {#if shellOptions.shell === 'custom'}
          <input
            type="text"
            class="form-input custom-shell"
            placeholder="Enter custom shell path (e.g., /usr/local/bin/zsh)"
            on:input={(e) => handleShellChange('shell', e.target.value)}
            {disabled}
          />
        {/if}
      </div>
      
      <!-- Environment Variables -->
      <div class="form-group">
        <div class="env-header">
          <label class="form-label">Environment Variables</label>
          <button
            type="button"
            class="toggle-env"
            on:click={() => showEnvEditor = !showEnvEditor}
            {disabled}
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
                {disabled}
              />
              <input
                type="text"
                class="form-input env-value"
                placeholder="Variable value"
                bind:value={envVarInput.value}
                on:keydown={(e) => e.key === 'Enter' && addEnvVar()}
                {disabled}
              />
              <button
                type="button"
                class="add-env-btn"
                on:click={addEnvVar}
                disabled={!envVarInput.key || !envVarInput.value || disabled}
              >
                Add
              </button>
            </div>
            
            <!-- Existing environment variables -->
            {#if Object.keys(shellOptions.env).length > 0}
              <div class="env-list">
                {#each Object.entries(shellOptions.env) as [key, value]}
                  <div class="env-item">
                    <span class="env-name">{key}</span>
                    <span class="env-equals">=</span>
                    <span class="env-value">{value}</span>
                    <button
                      type="button"
                      class="remove-env-btn"
                      on:click={() => removeEnvVar(key)}
                      {disabled}
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
    </div>
  </div>
  
  <!-- Advanced options -->
  <div slot="advanced-options" let:formData let:handleInput let:disabled>
    <div class="shell-advanced">
      <div class="form-group">
        <label class="form-checkbox">
          <input
            type="checkbox"
            checked={false}
            on:change={(e) => handleInput('loginShell', e.target.checked)}
            {disabled}
          />
          Login shell
        </label>
        <div class="form-help">
          Start shell as a login shell (loads login configuration files)
        </div>
      </div>
      
      <div class="form-group">
        <label for="initial-command" class="form-label">Initial Command</label>
        <input
          id="initial-command"
          type="text"
          class="form-input"
          placeholder="Optional command to run on startup"
          on:input={(e) => handleInput('initialCommand', e.target.value)}
          {disabled}
        />
        <div class="form-help">
          Command will be executed after shell starts
        </div>
      </div>
    </div>
  </div>
</BaseCreationForm>

<style>
  .shell-options {
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
    background-color: var(--bg-secondary, #f9fafb);
  }

  .shell-options h4 {
    margin: 0 0 1rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #111827);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .form-select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color, #d1d5db);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background-color: var(--bg-primary, #ffffff);
    cursor: pointer;
  }

  .form-select:focus {
    outline: none;
    border-color: var(--primary-color, #3b82f6);
    box-shadow: 0 0 0 3px var(--primary-color-alpha, rgba(59, 130, 246, 0.1));
  }

  .form-select:disabled {
    background-color: var(--disabled-bg, #f3f4f6);
    cursor: not-allowed;
    opacity: 0.6;
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
    color: var(--primary-color, #3b82f6);
    cursor: pointer;
    font-size: 0.75rem;
    text-decoration: underline;
  }

  .toggle-env:hover {
    color: var(--primary-color-hover, #2563eb);
  }

  .toggle-env:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .env-editor {
    border: 1px solid var(--border-color, #d1d5db);
    border-radius: 0.375rem;
    padding: 0.75rem;
    background-color: var(--bg-primary, #ffffff);
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
    background-color: var(--success-color, #10b981);
    color: white;
    border: none;
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .add-env-btn:hover:not(:disabled) {
    background-color: var(--success-color-hover, #059669);
  }

  .add-env-btn:disabled {
    background-color: var(--disabled-bg, #9ca3af);
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
    color: var(--primary-color, #3b82f6);
  }

  .env-equals {
    color: var(--text-secondary, #6b7280);
  }

  .env-value {
    flex: 1;
    color: var(--text-primary, #111827);
    word-break: break-all;
  }

  .remove-env-btn {
    background-color: var(--error-color, #ef4444);
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

  .remove-env-btn:hover:not(:disabled) {
    background-color: var(--error-color-hover, #dc2626);
  }

  .remove-env-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .env-empty {
    color: var(--text-secondary, #6b7280);
    font-style: italic;
    text-align: center;
    padding: 1rem;
  }

  .shell-advanced .form-group {
    margin-bottom: 1rem;
  }

  .form-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .form-checkbox input {
    margin: 0;
  }

  .form-help {
    font-size: 0.75rem;
    color: var(--text-secondary, #6b7280);
    margin-top: 0.25rem;
  }
</style>