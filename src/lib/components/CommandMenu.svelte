<script>
  import { onMount, onDestroy } from 'svelte';
  
  // Props
  let { visible = false, commands = [], sessionId = 'default', onExecuteCommand = () => {}, onClose = () => {} } = $props();

  // State
  let searchQuery = $state('');
  let selectedIndex = $state(0);
  let searchInput;
  
  // Computed
  let filteredCommands = $derived(filterCommands(commands, searchQuery));
  
  // Effect to reset selection when filtered commands change
  $effect(() => {
    if (filteredCommands.length > 0 && selectedIndex >= filteredCommands.length) {
      selectedIndex = 0;
    }
  });

  // Keyboard event handler
  let keydownHandler;

  onMount(() => {
    setupKeyboardListeners();
    loadCommandCache();
  });

  onDestroy(() => {
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
    }
  });

  /**
   * Setup global keyboard listeners
   */
  function setupKeyboardListeners() {
    keydownHandler = (event) => {
      // Global shortcut: Ctrl+K or Cmd+K
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        show();
        return;
      }
      
      if (!visible) return;
      
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          hide();
          break;
        case 'ArrowDown':
          event.preventDefault();
          selectNext();
          break;
        case 'ArrowUp':
          event.preventDefault();
          selectPrevious();
          break;
        case 'Enter':
          event.preventDefault();
          executeSelected();
          break;
      }
    };
    
    document.addEventListener('keydown', keydownHandler);
  }

  /**
   * Filter commands based on search query
   */
  function filterCommands(commandList, query) {
    if (!query.trim()) return commandList;
    
    const lowerQuery = query.toLowerCase();
    return commandList.filter(cmd =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery) ||
      (cmd.category && cmd.category.toLowerCase().includes(lowerQuery)) ||
      (cmd.shortcut && cmd.shortcut.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Show the command menu
   */
  export function show() {
    visible = true;
    searchQuery = '';
    selectedIndex = 0;
    
    // Focus search input after DOM update
    setTimeout(() => {
      if (searchInput) {
        searchInput.focus();
      }
    }, 0);
  }

  /**
   * Hide the command menu
   */
  export function hide() {
    visible = false;
    onClose();
  }

  /**
   * Update search query
   */
  function updateSearch(event) {
    searchQuery = event.target.value;
    selectedIndex = 0;
  }

  /**
   * Select next command
   */
  function selectNext() {
    selectedIndex = (selectedIndex + 1) % filteredCommands.length;
  }

  /**
   * Select previous command
   */
  function selectPrevious() {
    selectedIndex = selectedIndex === 0 
      ? filteredCommands.length - 1 
      : selectedIndex - 1;
  }

  /**
   * Select command by index
   */
  function selectCommand(index) {
    selectedIndex = index;
  }

  /**
   * Execute the currently selected command
   */
  function executeSelected() {
    const command = filteredCommands[selectedIndex];
    if (command) {
      executeCommand(command);
    }
  }

  /**
   * Execute a specific command
   */
  function executeCommand(command) {
    onExecuteCommand(command);
    hide();
  }

  /**
   * Handle overlay click (close menu)
   */
  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) {
      hide();
    }
  }

  /**
   * Load cached commands from session storage
   */
  function loadCommandCache() {
    if (typeof window === 'undefined') return;
    
    const key = `command-cache-${sessionId}`;
    const cached = sessionStorage.getItem(key);
    
    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
        // Cache is valid for 5 minutes
        if (cachedData.timestamp && (Date.now() - cachedData.timestamp < 300000)) {
          if (cachedData.commands && Array.isArray(cachedData.commands)) {
            commands = cachedData.commands;
          }
        }
      } catch (error) {
        console.warn('Failed to load command cache:', error);
      }
    }
  }

  /**
   * Save commands to cache
   */
  export function saveCommandCache() {
    if (typeof window === 'undefined') return;
    
    const key = `command-cache-${sessionId}`;
    try {
      const cacheData = {
        commands,
        timestamp: Date.now()
      };
      sessionStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save command cache:', error);
    }
  }

  /**
   * Clear command cache
   */
  export function clearCache() {
    if (typeof window === 'undefined') return;
    
    const key = `command-cache-${sessionId}`;
    sessionStorage.removeItem(key);
  }

  /**
   * Set commands and save to cache
   */
  export function setCommands(newCommands) {
    commands = newCommands;
    saveCommandCache();
  }

  // Save to cache when commands change
  $effect(() => {
    if (commands.length > 0) {
      saveCommandCache();
    }
  });
</script>

{#if visible}
  <div class="command-menu" role="dialog" aria-modal="true" aria-label="Command Menu">
    <div class="command-menu-overlay" on:click={handleOverlayClick}>
      <div class="command-menu-dialog" data-augmented-ui="tl-clip tr-clip border">
        <!-- Search Input -->
        <div class="search-container">
          <div class="search-icon">⚡</div>
          <input
            bind:this={searchInput}
            type="text"
            class="command-search"
            placeholder="Search commands... (↑↓ to navigate, ⏎ to select)"
            value={searchQuery}
            on:input={updateSearch}
            autocomplete="off"
            spellcheck="false"
          />
          <div class="search-shortcut">Ctrl+K</div>
        </div>

        <!-- Command List -->
        <div class="command-list" role="listbox">
          {#if filteredCommands.length === 0}
            <div class="no-results">
              <div class="no-results-icon">🔍</div>
              <div class="no-results-text">No commands found</div>
              <div class="no-results-hint">Try a different search term</div>
            </div>
          {:else}
            {#each filteredCommands as command, index}
              <div
                class="command-item"
                class:selected={index === selectedIndex}
                role="option"
                aria-selected={index === selectedIndex}
                on:click={() => executeCommand(command)}
                on:mouseenter={() => selectCommand(index)}
              >
                <div class="command-main">
                  <div class="command-name">{command.name}</div>
                  <div class="command-description">{command.description}</div>
                </div>
                <div class="command-meta">
                  {#if command.category}
                    <div class="command-category">{command.category}</div>
                  {/if}
                  {#if command.shortcut}
                    <div class="command-shortcut">{command.shortcut}</div>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>

        <!-- Footer -->
        <div class="command-footer">
          <div class="command-help">
            <span class="help-item">
              <span class="key">⏎</span> Execute
            </span>
            <span class="help-item">
              <span class="key">↑↓</span> Navigate
            </span>
            <span class="help-item">
              <span class="key">Esc</span> Close
            </span>
          </div>
          <div class="command-count">
            {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .command-menu {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    font-family: var(--font-sans);
  }

  .command-menu-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .command-menu-dialog {
    position: relative;
    width: 90%;
    max-width: 600px;
    background: var(--bg-darker);
    border: 1px solid var(--border-light);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6),
                0 0 0 1px var(--primary-muted);
    overflow: hidden;
  }

  .search-container {
    display: flex;
    align-items: center;
    padding: var(--space-md);
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .search-icon {
    color: var(--primary);
    font-size: 1.2rem;
    margin-right: var(--space-sm);
  }

  .command-search {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 1.1rem;
    line-height: 1.4;
    font-family: var(--font-sans);
    padding: var(--space-xs) 0;
  }

  .command-search:focus {
    outline: none;
  }

  .command-search::placeholder {
    color: var(--text-muted);
  }

  .search-shortcut {
    background: var(--bg-dark);
    color: var(--text-secondary);
    padding: var(--space-xs) var(--space-sm);
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: var(--font-mono);
    border: 1px solid var(--border);
  }

  .command-list {
    max-height: 400px;
    overflow-y: auto;
    background: var(--bg-dark);
  }

  .command-list::-webkit-scrollbar {
    width: 6px;
  }

  .command-list::-webkit-scrollbar-track {
    background: var(--bg-darker);
  }

  .command-list::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }

  .command-list::-webkit-scrollbar-thumb:hover {
    background: var(--border-light);
  }

  .command-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md);
    cursor: pointer;
    border-bottom: 1px solid var(--border);
    transition: all 0.15s ease;
  }

  .command-item:hover,
  .command-item.selected {
    background: var(--surface-hover);
    border-left: 3px solid var(--primary);
  }

  .command-item:last-child {
    border-bottom: none;
  }

  .command-main {
    flex: 1;
    min-width: 0;
  }

  .command-name {
    font-weight: 600;
    color: var(--text-primary);
    font-family: var(--font-mono);
    margin-bottom: var(--space-xs);
  }

  .command-description {
    color: var(--text-secondary);
    font-size: 0.9rem;
    line-height: 1.3;
  }

  .command-meta {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-left: var(--space-md);
  }

  .command-category {
    background: var(--primary-muted);
    color: var(--primary);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .command-shortcut {
    background: var(--bg-darker);
    color: var(--text-muted);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: var(--font-mono);
    border: 1px solid var(--border);
  }

  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-3xl) var(--space-xl);
    text-align: center;
  }

  .no-results-icon {
    font-size: 2rem;
    margin-bottom: var(--space-sm);
    opacity: 0.5;
  }

  .no-results-text {
    color: var(--text-secondary);
    font-size: 1.1rem;
    margin-bottom: var(--space-xs);
  }

  .no-results-hint {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .command-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .command-help {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .help-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .key {
    background: var(--bg-darker);
    color: var(--text-secondary);
    padding: 2px 4px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    border: 1px solid var(--border);
    min-width: 20px;
    text-align: center;
  }

  .command-count {
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .command-menu {
      padding-top: 5vh;
    }

    .command-menu-dialog {
      width: 95%;
      margin: 0 var(--space-sm);
    }

    .command-meta {
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-xs);
    }

    .command-help {
      gap: var(--space-sm);
    }

    .help-item {
      font-size: 0.7rem;
    }
  }

  /* Focus and keyboard navigation styles */
  @media (prefers-reduced-motion: no-preference) {
    .command-item {
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .command-menu-dialog {
      border-width: 2px;
    }
    
    .command-item.selected {
      border-left-width: 4px;
    }
  }
</style>