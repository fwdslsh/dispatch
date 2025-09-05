<!--
  TypePicker.svelte - Session Type Selection Component
  
  Provides dynamic session type selection using the session type registry.
  Integrates with session type registry to display available session types
  with icons, descriptions, and selection functionality.
-->

<script>
  import { getAllSessionTypes } from '../session-types/client.js';
  import ShellIcon from './Icons/ShellIcon.svelte';
  import ClaudeIcon from './Icons/ClaudeIcon.svelte';
  
  let { selectedType = $bindable(), onTypeSelect } = $props();
  
  // Get available session types from registry
  let sessionTypes = $state([]);
  
  // Load session types on component initialization
  $effect(() => {
    try {
      sessionTypes = getAllSessionTypes();
    } catch (error) {
      console.warn('Failed to load session types:', error);
      sessionTypes = [];
    }
  });
  
  // Icon mapping for session types
  const iconMap = {
    shell: ShellIcon,
    claude: ClaudeIcon
  };
  
  // Handle type selection
  function selectType(type) {
    selectedType = type;
    if (onTypeSelect) {
      onTypeSelect(type);
    }
  }
  
  // Check if type is selected
  function isSelected(type) {
    return selectedType?.id === type.id;
  }
</script>

<div class="type-picker">
  <h3 class="picker-title">Select Session Type</h3>
  
  {#if sessionTypes.length === 0}
    <div class="no-types">
      <p>No session types available</p>
    </div>
  {:else}
    <div class="type-grid">
      {#each sessionTypes as type}
        <button
          class="type-option"
          class:selected={isSelected(type)}
          onclick={() => selectType(type)}
          type="button"
        >
          <div class="type-icon">
            {#if iconMap[type.id]}
              <svelte:component this={iconMap[type.id]} />
            {:else}
              <div class="default-icon">?</div>
            {/if}
          </div>
          
          <div class="type-info">
            <h4 class="type-name">{type.name}</h4>
            <p class="type-description">{type.description}</p>
            {#if type.category}
              <span class="type-category">{type.category}</span>
            {/if}
          </div>
          
          {#if type.requiresProject}
            <div class="type-badge project-required">
              Project Required
            </div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .type-picker {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
  }
  
  .picker-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: var(--text-primary, #333);
    text-align: center;
  }
  
  .no-types {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary, #666);
    background: var(--surface, #f8f9fa);
    border-radius: 8px;
    border: 1px dashed var(--border, #ddd);
  }
  
  .type-grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: 1fr;
  }
  
  .type-option {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--surface, #fff);
    border: 2px solid var(--border, #e0e0e0);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    position: relative;
  }
  
  .type-option:hover {
    border-color: var(--primary, #0066cc);
    background: var(--surface-hover, #f8f9fa);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .type-option.selected {
    border-color: var(--primary, #0066cc);
    background: var(--primary-light, #e3f2fd);
    box-shadow: 0 0 0 1px var(--primary, #0066cc);
  }
  
  .type-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--icon-bg, #f0f0f0);
    border-radius: 6px;
    color: var(--icon-color, #666);
  }
  
  .type-option.selected .type-icon {
    background: var(--primary, #0066cc);
    color: white;
  }
  
  .default-icon {
    font-size: 1.25rem;
    font-weight: bold;
  }
  
  .type-info {
    flex-grow: 1;
    min-width: 0;
  }
  
  .type-name {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: var(--text-primary, #333);
  }
  
  .type-description {
    font-size: 0.875rem;
    color: var(--text-secondary, #666);
    margin: 0 0 0.5rem 0;
    line-height: 1.4;
  }
  
  .type-category {
    display: inline-block;
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    background: var(--category-bg, #e0e0e0);
    color: var(--category-text, #666);
    border-radius: 12px;
    text-transform: uppercase;
    font-weight: 500;
    letter-spacing: 0.025em;
  }
  
  .type-badge {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;
  }
  
  .project-required {
    background: var(--warning-light, #fff3cd);
    color: var(--warning-dark, #856404);
    border: 1px solid var(--warning, #ffeaa7);
  }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    .type-option {
      gap: 0.75rem;
      padding: 0.75rem;
    }
    
    .type-icon {
      width: 32px;
      height: 32px;
    }
    
    .type-name {
      font-size: 0.9rem;
    }
    
    .type-description {
      font-size: 0.8rem;
    }
    
    .type-badge {
      position: static;
      margin-top: 0.5rem;
      align-self: flex-start;
    }
  }
  
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .picker-title {
      color: var(--text-primary-dark, #fff);
    }
    
    .type-option {
      background: var(--surface-dark, #2d2d2d);
      border-color: var(--border-dark, #404040);
    }
    
    .type-option:hover {
      background: var(--surface-hover-dark, #363636);
    }
    
    .type-option.selected {
      background: var(--primary-dark, #1976d2);
    }
    
    .type-name {
      color: var(--text-primary-dark, #fff);
    }
    
    .type-description {
      color: var(--text-secondary-dark, #aaa);
    }
    
    .type-icon {
      background: var(--icon-bg-dark, #404040);
      color: var(--icon-color-dark, #aaa);
    }
    
    .type-category {
      background: var(--category-bg-dark, #404040);
      color: var(--category-text-dark, #aaa);
    }
  }
</style>