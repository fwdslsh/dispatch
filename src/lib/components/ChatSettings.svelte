<script>
  import { onMount } from 'svelte';
  
  // Props
  let { visible = false, sessionId = 'default', onClose = () => {}, onSaveSettings = () => {} } = $props();

  // Settings state
  let settings = $state({
    allowedTools: ['Read', 'Grep', 'WriteFile', 'Bash'],
    permissionMode: 'default',
    model: 'claude-3-5-sonnet-20241022',
    maxTurns: 5,
    systemPrompt: '',
    mcpServers: []
  });

  let activeTab = $state('tools');

  const availableTools = [
    'Read', 'Grep', 'WriteFile', 'Bash', 'WebSearch', 
    'Task', 'Edit', 'MultiEdit', 'NotebookEdit', 'WebFetch'
  ];

  const permissionModes = [
    { value: 'default', label: 'Default (Ask for permissions)' },
    { value: 'acceptEdits', label: 'Accept Edits Automatically' },
    { value: 'bypassPermissions', label: 'Bypass All Permissions' }
  ];

  const models = [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' }
  ];

  onMount(() => {
    loadSettings();
  });

  function loadSettings() {
    if (typeof window === 'undefined') return;
    
    const key = `chat-settings-${sessionId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        settings = { ...settings, ...JSON.parse(stored) };
      } catch (error) {
        console.warn('Failed to load settings:', error);
      }
    }
  }

  function saveSettings() {
    if (typeof window === 'undefined') return;
    
    const key = `chat-settings-${sessionId}`;
    try {
      localStorage.setItem(key, JSON.stringify(settings));
      onSaveSettings(settings);
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
  }

  function toggleTool(tool) {
    if (settings.allowedTools.includes(tool)) {
      settings.allowedTools = settings.allowedTools.filter(t => t !== tool);
    } else {
      settings.allowedTools = [...settings.allowedTools, tool];
    }
  }

  function handleSave() {
    saveSettings();
    onClose();
  }

  function handleCancel() {
    loadSettings();
    onClose();
  }

  function resetToDefaults() {
    settings = {
      allowedTools: ['Read', 'Grep', 'WriteFile', 'Bash'],
      permissionMode: 'default',
      model: 'claude-3-5-sonnet-20241022',
      maxTurns: 5,
      systemPrompt: '',
      mcpServers: []
    };
  }
</script>

{#if visible}
  <div class="settings-modal" role="dialog" aria-modal="true" aria-label="Chat Settings">
    <div class="settings-overlay" on:click={onClose}>
      <div class="settings-dialog" data-augmented-ui="tl-clip tr-clip border" on:click|stopPropagation>
        
        <!-- Header -->
        <div class="settings-header">
          <h2>Chat Settings</h2>
          <button class="close-button" on:click={onClose} aria-label="Close settings">×</button>
        </div>

        <!-- Tabs -->
        <div class="settings-tabs">
          <button 
            class="tab" 
            class:active={activeTab === 'tools'}
            on:click={() => activeTab = 'tools'}
          >
            Tools
          </button>
          <button 
            class="tab" 
            class:active={activeTab === 'behavior'}
            on:click={() => activeTab = 'behavior'}
          >
            Behavior
          </button>
          <button 
            class="tab" 
            class:active={activeTab === 'advanced'}
            on:click={() => activeTab = 'advanced'}
          >
            Advanced
          </button>
        </div>

        <!-- Content -->
        <div class="settings-content">
          
          {#if activeTab === 'tools'}
            <div class="settings-section">
              <h3>Allowed Tools</h3>
              <p class="section-description">Select which tools Claude can use during conversations.</p>
              
              <div class="tools-grid">
                {#each availableTools as tool}
                  <label class="tool-item">
                    <input 
                      type="checkbox" 
                      checked={settings.allowedTools.includes(tool)}
                      on:change={() => toggleTool(tool)}
                    />
                    <span class="tool-name">{tool}</span>
                  </label>
                {/each}
              </div>
            </div>

          {:else if activeTab === 'behavior'}
            <div class="settings-section">
              <h3>Permission Mode</h3>
              <p class="section-description">How Claude should handle tool permissions.</p>
              
              <div class="radio-group">
                {#each permissionModes as mode}
                  <label class="radio-item">
                    <input 
                      type="radio" 
                      bind:group={settings.permissionMode}
                      value={mode.value}
                    />
                    <span class="radio-label">{mode.label}</span>
                  </label>
                {/each}
              </div>
            </div>

            <div class="settings-section">
              <h3>Model Selection</h3>
              <p class="section-description">Choose the Claude model to use.</p>
              
              <select class="model-select" bind:value={settings.model}>
                {#each models as model}
                  <option value={model.value}>{model.label}</option>
                {/each}
              </select>
            </div>

            <div class="settings-section">
              <h3>Max Turns</h3>
              <p class="section-description">Maximum number of conversation turns per query.</p>
              
              <input 
                type="number" 
                class="number-input"
                bind:value={settings.maxTurns}
                min="1" 
                max="20"
              />
            </div>

          {:else if activeTab === 'advanced'}
            <div class="settings-section">
              <h3>System Prompt</h3>
              <p class="section-description">Custom system prompt to use with Claude (optional).</p>
              
              <textarea 
                class="system-prompt"
                bind:value={settings.systemPrompt}
                placeholder="Enter custom system prompt..."
                rows="6"
              ></textarea>
            </div>

            <div class="settings-section">
              <h3>Reset Settings</h3>
              <p class="section-description">Reset all settings to their default values.</p>
              
              <button class="reset-button" on:click={resetToDefaults}>
                Reset to Defaults
              </button>
            </div>
          {/if}
        </div>

        <!-- Footer -->
        <div class="settings-footer">
          <button class="cancel-button" on:click={handleCancel}>Cancel</button>
          <button class="save-button" on:click={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
    font-family: var(--font-sans);
  }

  .settings-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
  }

  .settings-dialog {
    position: relative;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    background: var(--bg-darker);
    border: 1px solid var(--border-light);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg);
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .settings-header h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.4rem;
  }

  .close-button {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.5rem;
    cursor: pointer;
    padding: var(--space-xs);
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .close-button:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .settings-tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    background: var(--bg-dark);
  }

  .tab {
    flex: 1;
    padding: var(--space-md);
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: var(--font-sans);
  }

  .tab:hover {
    background: var(--surface-hover);
  }

  .tab.active {
    color: var(--primary);
    background: var(--surface);
    border-bottom: 2px solid var(--primary);
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg);
    background: var(--bg-dark);
  }

  .settings-section {
    margin-bottom: var(--space-xl);
  }

  .settings-section:last-child {
    margin-bottom: 0;
  }

  .settings-section h3 {
    margin: 0 0 var(--space-xs) 0;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .section-description {
    margin: 0 0 var(--space-md) 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-sm);
  }

  .tool-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm);
    background: var(--surface);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .tool-item:hover {
    background: var(--surface-hover);
  }

  .tool-name {
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 0.9rem;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .radio-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm);
    cursor: pointer;
  }

  .radio-label {
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .model-select,
  .number-input {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 0.9rem;
  }

  .model-select:focus,
  .number-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-muted);
  }

  .system-prompt {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 0.9rem;
    resize: vertical;
    line-height: 1.4;
  }

  .system-prompt:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-muted);
  }

  .reset-button {
    background: var(--secondary);
    color: white;
    border: none;
    padding: var(--space-sm) var(--space-md);
    border-radius: 6px;
    cursor: pointer;
    font-family: var(--font-sans);
    transition: opacity 0.15s ease;
  }

  .reset-button:hover {
    opacity: 0.9;
  }

  .settings-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-lg);
    border-top: 1px solid var(--border);
    background: var(--surface);
  }

  .cancel-button,
  .save-button {
    padding: var(--space-sm) var(--space-lg);
    border-radius: 6px;
    cursor: pointer;
    font-family: var(--font-sans);
    transition: all 0.15s ease;
  }

  .cancel-button {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }

  .cancel-button:hover {
    background: var(--surface-hover);
  }

  .save-button {
    background: var(--primary-gradient);
    color: var(--bg-dark);
    border: none;
    font-weight: 600;
  }

  .save-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--primary-muted);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .settings-modal {
      padding: var(--space-sm);
    }

    .tools-grid {
      grid-template-columns: 1fr;
    }

    .settings-footer {
      flex-direction: column-reverse;
    }

    .cancel-button,
    .save-button {
      width: 100%;
    }
  }
</style>