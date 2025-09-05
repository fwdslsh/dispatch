<script>
  /**
   * BaseCreationForm - Base component for session type creation forms
   * 
   * Provides common functionality and structure that session type-specific
   * creation forms can extend or use as a template.
   */
  
  import { createEventDispatcher } from 'svelte';
  import { ValidationRules, validateSessionName, validateProjectId, validateTerminalDimensions } from './ValidationUtils.js';
  
  // Props
  let { 
    initialData = {},
    requiresProject = true,
    showAdvanced = false,
    submitLabel = 'Create Session',
    disabled = false
  } = $props();
  
  // State
  let formData = $state({
    name: '',
    projectId: '',
    cols: 80,
    rows: 24,
    workingDirectory: '',
    customOptions: {},
    ...initialData
  });
  
  let errors = $state({});
  let isValidating = $state(false);
  let showAdvancedOptions = $state(showAdvanced);
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // Computed validity
  let isValid = $derived(() => {
    return Object.keys(errors).length === 0 && 
           formData.name.trim().length > 0 &&
           (!requiresProject || formData.projectId.trim().length > 0);
  });
  
  /**
   * Validate a single field
   */
  function validateField(field, value) {
    switch (field) {
      case 'name':
        const nameResult = validateSessionName(value);
        if (!nameResult.valid) {
          errors[field] = nameResult.errors[0];
        } else {
          delete errors[field];
        }
        break;
        
      case 'projectId':
        if (requiresProject || value) {
          const projectResult = validateProjectId(value, requiresProject);
          if (!projectResult.valid) {
            errors[field] = projectResult.errors[0];
          } else {
            delete errors[field];
          }
        }
        break;
        
      case 'cols':
      case 'rows':
        const dimResult = validateTerminalDimensions(
          field === 'cols' ? value : formData.cols,
          field === 'rows' ? value : formData.rows
        );
        if (!dimResult.valid) {
          errors[field] = dimResult.errors.find(e => e.includes(field === 'cols' ? 'columns' : 'rows'));
        } else {
          delete errors[field];
        }
        break;
    }
    
    // Trigger reactivity
    errors = { ...errors };
  }
  
  /**
   * Handle input changes with validation
   */
  function handleInput(field, value) {
    formData[field] = value;
    validateField(field, value);
    
    // Dispatch data change event
    dispatch('dataChange', formData);
  }
  
  /**
   * Handle form submission
   */
  function handleSubmit() {
    if (!isValid) return;
    
    isValidating = true;
    
    // Final validation
    validateField('name', formData.name);
    if (requiresProject) {
      validateField('projectId', formData.projectId);
    }
    validateField('cols', formData.cols);
    validateField('rows', formData.rows);
    
    if (Object.keys(errors).length === 0) {
      dispatch('submit', formData);
    }
    
    isValidating = false;
  }
  
  /**
   * Toggle advanced options
   */
  function toggleAdvanced() {
    showAdvancedOptions = !showAdvancedOptions;
  }
</script>

<div class="base-creation-form">
  <form on:submit|preventDefault={handleSubmit}>
    <!-- Session Name -->
    <div class="form-group">
      <label for="session-name" class="form-label">
        Session Name <span class="required">*</span>
      </label>
      <input
        id="session-name"
        type="text"
        class="form-input"
        class:error={errors.name}
        bind:value={formData.name}
        on:input={(e) => handleInput('name', e.target.value)}
        placeholder="Enter session name"
        maxlength={ValidationRules.SESSION_NAME.MAX_LENGTH}
        {disabled}
      />
      {#if errors.name}
        <div class="error-message">{errors.name}</div>
      {/if}
    </div>

    <!-- Project Selection -->
    {#if requiresProject}
      <div class="form-group">
        <label for="project-id" class="form-label">
          Project <span class="required">*</span>
        </label>
        <input
          id="project-id"
          type="text"
          class="form-input"
          class:error={errors.projectId}
          bind:value={formData.projectId}
          on:input={(e) => handleInput('projectId', e.target.value)}
          placeholder="Enter project ID"
          maxlength={ValidationRules.PROJECT_ID.MAX_LENGTH}
          {disabled}
        />
        {#if errors.projectId}
          <div class="error-message">{errors.projectId}</div>
        {/if}
      </div>
    {/if}

    <!-- Terminal Dimensions -->
    <div class="form-group">
      <div class="form-row">
        <div class="form-column">
          <label for="cols" class="form-label">Columns</label>
          <input
            id="cols"
            type="number"
            class="form-input"
            class:error={errors.cols}
            bind:value={formData.cols}
            on:input={(e) => handleInput('cols', parseInt(e.target.value))}
            min={ValidationRules.TERMINAL_DIMENSIONS.COLS.MIN}
            max={ValidationRules.TERMINAL_DIMENSIONS.COLS.MAX}
            {disabled}
          />
          {#if errors.cols}
            <div class="error-message">{errors.cols}</div>
          {/if}
        </div>
        
        <div class="form-column">
          <label for="rows" class="form-label">Rows</label>
          <input
            id="rows"
            type="number"
            class="form-input"
            class:error={errors.rows}
            bind:value={formData.rows}
            on:input={(e) => handleInput('rows', parseInt(e.target.value))}
            min={ValidationRules.TERMINAL_DIMENSIONS.ROWS.MIN}
            max={ValidationRules.TERMINAL_DIMENSIONS.ROWS.MAX}
            {disabled}
          />
          {#if errors.rows}
            <div class="error-message">{errors.rows}</div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Advanced Options Toggle -->
    <div class="form-group">
      <button
        type="button"
        class="toggle-advanced"
        on:click={toggleAdvanced}
        {disabled}
      >
        {showAdvancedOptions ? '▼' : '▶'} Advanced Options
      </button>
    </div>

    <!-- Advanced Options -->
    {#if showAdvancedOptions}
      <div class="advanced-options">
        <div class="form-group">
          <label for="working-directory" class="form-label">Working Directory</label>
          <input
            id="working-directory"
            type="text"
            class="form-input"
            bind:value={formData.workingDirectory}
            on:input={(e) => handleInput('workingDirectory', e.target.value)}
            placeholder="Optional working directory"
            {disabled}
          />
        </div>

        <!-- Slot for session type-specific advanced options -->
        <slot name="advanced-options" {formData} {handleInput} {disabled}></slot>
      </div>
    {/if}

    <!-- Custom Options Slot -->
    <slot name="custom-options" {formData} {handleInput} {disabled} {errors}></slot>

    <!-- Submit Button -->
    <div class="form-actions">
      <button
        type="submit"
        class="form-submit"
        disabled={!isValid || disabled || isValidating}
      >
        {isValidating ? 'Validating...' : submitLabel}
      </button>
      
      <!-- Slot for additional actions -->
      <slot name="form-actions" {isValid} {disabled}></slot>
    </div>
  </form>
</div>

<style>
  .base-creation-form {
    max-width: 500px;
    margin: 0 auto;
    padding: 1rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.25rem;
    color: var(--text-primary, #333);
  }

  .required {
    color: var(--error-color, #ef4444);
  }

  .form-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color, #d1d5db);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--primary-color, #3b82f6);
    box-shadow: 0 0 0 3px var(--primary-color-alpha, rgba(59, 130, 246, 0.1));
  }

  .form-input.error {
    border-color: var(--error-color, #ef4444);
  }

  .form-input:disabled {
    background-color: var(--disabled-bg, #f3f4f6);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .form-column {
    flex: 1;
  }

  .error-message {
    color: var(--error-color, #ef4444);
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }

  .toggle-advanced {
    background: none;
    border: none;
    color: var(--primary-color, #3b82f6);
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0.25rem 0;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .toggle-advanced:hover {
    text-decoration: underline;
  }

  .toggle-advanced:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .advanced-options {
    border: 1px solid var(--border-color, #d1d5db);
    border-radius: 0.375rem;
    padding: 1rem;
    background-color: var(--bg-secondary, #f9fafb);
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-top: 1.5rem;
  }

  .form-submit {
    background-color: var(--primary-color, #3b82f6);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .form-submit:hover:not(:disabled) {
    background-color: var(--primary-color-hover, #2563eb);
  }

  .form-submit:disabled {
    background-color: var(--disabled-bg, #9ca3af);
    cursor: not-allowed;
  }
</style>