<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { computePosition, autoUpdate, flip, shift, offset } from '@floating-ui/dom';
  
  let {
    visible = $bindable(false),
    onCommandSelect = (command) => {},
    onClose = () => {},
    triggerElement = null,
    commandHistory = [],
    favoriteCommands = []
  } = $props();

  // Component state
  let paletteElement;
  let searchInput;
  let searchQuery = '';
  let selectedIndex = 0;
  let keyboardHeight = 0;
  let cleanupAutoUpdate;
  
  // Command data
  let filteredCommands = [];
  let categorizedCommands = [];
  let allCommands = [];

  // Categories with metadata
  const categories = {
    recent: { name: 'Recent', icon: '🕐', priority: 1 },
    favorites: { name: 'Favorites', icon: '⭐', priority: 2 },
    filesystem: { name: 'File System', icon: '📁', priority: 3, 
                  commands: [
                    { name: 'List files', command: 'ls -la', description: 'List all files with details' },
                    { name: 'Change directory', command: 'cd ', description: 'Change to directory' },
                    { name: 'Make directory', command: 'mkdir ', description: 'Create new directory' },
                    { name: 'Copy file', command: 'cp ', description: 'Copy file or directory' },
                    { name: 'Move/rename', command: 'mv ', description: 'Move or rename file' },
                    { name: 'Remove file', command: 'rm ', description: 'Delete file' },
                    { name: 'Find files', command: 'find . -name ', description: 'Search for files' },
                    { name: 'Current path', command: 'pwd', description: 'Show current directory' }
                  ]
                },
    git: { name: 'Git', icon: '🌿', priority: 4,
           commands: [
             { name: 'Git status', command: 'git status', description: 'Check repository status' },
             { name: 'Git add all', command: 'git add .', description: 'Stage all changes' },
             { name: 'Git commit', command: 'git commit -m ""', description: 'Commit with message' },
             { name: 'Git push', command: 'git push', description: 'Push to remote' },
             { name: 'Git pull', command: 'git pull', description: 'Pull from remote' },
             { name: 'Git log', command: 'git log --oneline', description: 'Show commit history' },
             { name: 'Git branch', command: 'git branch', description: 'List branches' },
             { name: 'Git checkout', command: 'git checkout ', description: 'Switch branch' }
           ]
         },
    system: { name: 'System', icon: '⚙️', priority: 5,
              commands: [
                { name: 'Process list', command: 'ps aux', description: 'Show running processes' },
                { name: 'System info', command: 'uname -a', description: 'Show system information' },
                { name: 'Disk usage', command: 'df -h', description: 'Show disk space' },
                { name: 'Memory usage', command: 'free -h', description: 'Show memory usage' },
                { name: 'Top processes', command: 'top', description: 'Monitor system resources' },
                { name: 'Kill process', command: 'kill ', description: 'Terminate process' },
                { name: 'Environment', command: 'env', description: 'Show environment variables' }
              ]
            },
    network: { name: 'Network', icon: '🌐', priority: 6,
               commands: [
                 { name: 'Network status', command: 'netstat -tuln', description: 'Show network connections' },
                 { name: 'Ping host', command: 'ping ', description: 'Test network connectivity' },
                 { name: 'Download file', command: 'curl -O ', description: 'Download file from URL' },
                 { name: 'HTTP request', command: 'curl ', description: 'Make HTTP request' },
                 { name: 'SSH connect', command: 'ssh ', description: 'Connect via SSH' }
               ]
             }
  };

  // Fuzzy search implementation
  class FuzzySearch {
    constructor(items, keys = ['name', 'command']) {
      this.items = items;
      this.keys = keys;
    }
    
    search(query, maxResults = 20) {
      if (!query || query.trim() === '') {
        return this.items.slice(0, maxResults);
      }
      
      const queryLower = query.toLowerCase();
      const results = [];
      
      for (const item of this.items) {
        const score = this.calculateScore(item, queryLower);
        if (score > 0) {
          results.push({ ...item, score });
        }
      }
      
      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
    }
    
    calculateScore(item, query) {
      let maxScore = 0;
      
      for (const key of this.keys) {
        if (item[key]) {
          const value = item[key].toLowerCase();
          const score = this.stringScore(value, query);
          maxScore = Math.max(maxScore, score);
        }
      }
      
      return maxScore;
    }
    
    stringScore(string, query) {
      if (string === query) return 1.0;
      if (string.includes(query)) {
        const ratio = query.length / string.length;
        const position = string.indexOf(query);
        const positionScore = 1 - (position / string.length);
        return ratio * 0.7 + positionScore * 0.3;
      }
      
      // Character match scoring
      let matches = 0;
      let queryIndex = 0;
      
      for (let i = 0; i < string.length && queryIndex < query.length; i++) {
        if (string[i] === query[queryIndex]) {
          matches++;
          queryIndex++;
        }
      }
      
      return queryIndex === query.length ? matches / string.length * 0.5 : 0;
    }
  }

  let fuzzySearch;

  // Debounced search function
  let searchTimeout;
  function debounceSearch(query) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 150);
  }

  function performSearch(query) {
    if (!fuzzySearch) return;
    
    selectedIndex = 0;
    
    if (!query.trim()) {
      // Show categorized commands when no search query
      categorizedCommands = getCategorizedCommands();
      filteredCommands = [];
    } else {
      // Show search results
      filteredCommands = fuzzySearch.search(query);
      categorizedCommands = [];
    }
  }

  function getCategorizedCommands() {
    const categorized = {};
    
    // Initialize categories
    Object.entries(categories).forEach(([key, category]) => {
      categorized[key] = {
        ...category,
        commands: []
      };
    });
    
    // Add recent commands (from history)
    const recentCommands = commandHistory.slice(0, 5);
    categorized.recent.commands = recentCommands.map(cmd => ({
      ...cmd,
      isRecent: true
    }));
    
    // Add favorite commands
    categorized.favorites.commands = favoriteCommands.map(cmd => ({
      ...cmd,
      isFavorite: true
    }));
    
    // Add predefined commands to their categories
    Object.entries(categories).forEach(([key, category]) => {
      if (category.commands && key !== 'recent' && key !== 'favorites') {
        categorized[key].commands = category.commands.map(cmd => ({
          ...cmd,
          category: key
        }));
      }
    });
    
    // Return only categories with commands, sorted by priority
    return Object.values(categorized)
      .filter(cat => cat.commands.length > 0)
      .sort((a, b) => a.priority - b.priority);
  }

  function getAllCommands() {
    const commands = [];
    
    // Add recent commands
    commandHistory.forEach(cmd => {
      commands.push({ ...cmd, isRecent: true });
    });
    
    // Add favorite commands
    favoriteCommands.forEach(cmd => {
      commands.push({ ...cmd, isFavorite: true });
    });
    
    // Add predefined commands
    Object.entries(categories).forEach(([key, category]) => {
      if (category.commands) {
        category.commands.forEach(cmd => {
          commands.push({ ...cmd, category: key });
        });
      }
    });
    
    // Remove duplicates based on command string
    const unique = commands.filter((cmd, index, arr) => 
      arr.findIndex(c => c.command === cmd.command) === index
    );
    
    return unique;
  }

  function handleKeydown(event) {
    const totalItems = filteredCommands.length || 
                      categorizedCommands.reduce((total, cat) => total + cat.commands.length, 0);
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, totalItems - 1);
        scrollToSelected();
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollToSelected();
        break;
      case 'Enter':
        event.preventDefault();
        selectCommand();
        break;
      case 'Escape':
        event.preventDefault();
        closePalette();
        break;
      case 'Tab':
        event.preventDefault();
        // Tab could cycle through categories or autocomplete
        break;
    }
  }

  function selectCommand() {
    const command = getCommandAtIndex(selectedIndex);
    if (command) {
      onCommandSelect(command);
      closePalette();
    }
  }

  function getCommandAtIndex(index) {
    if (filteredCommands.length > 0) {
      return filteredCommands[index];
    }
    
    let currentIndex = 0;
    for (const category of categorizedCommands) {
      if (index >= currentIndex && index < currentIndex + category.commands.length) {
        return category.commands[index - currentIndex];
      }
      currentIndex += category.commands.length;
    }
    
    return null;
  }

  function scrollToSelected() {
    const selectedElement = paletteElement?.querySelector('.command-item.selected');
    if (selectedElement) {
      selectedElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }

  function handleCommandClick(command) {
    onCommandSelect(command);
    closePalette();
  }

  function closePalette() {
    visible = false;
    searchQuery = '';
    selectedIndex = 0;
    onClose();
  }

  function setupKeyboardDetection() {
    if (!browser) return;
    
    const handleViewportChange = () => {
      if (window.visualViewport) {
        const heightDiff = window.innerHeight - window.visualViewport.height;
        keyboardHeight = Math.max(0, heightDiff);
        updatePosition();
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      };
    }

    // Fallback for browsers without visualViewport
    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const expectedHeight = screen.height;
      keyboardHeight = Math.max(0, expectedHeight - currentHeight - 100);
      updatePosition();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }

  function updatePosition() {
    if (!paletteElement || !triggerElement || !browser) return;

    if (cleanupAutoUpdate) {
      cleanupAutoUpdate();
    }

    cleanupAutoUpdate = autoUpdate(triggerElement, paletteElement, () => {
      computePosition(triggerElement, paletteElement, {
        placement: 'bottom-start',
        middleware: [
          offset(8),
          flip(),
          shift({ padding: 16 }),
        ],
      }).then(({ x, y }) => {
        // Adjust for keyboard if visible
        let adjustedY = y;
        if (keyboardHeight > 0) {
          const paletteHeight = paletteElement.offsetHeight;
          const screenHeight = window.innerHeight;
          const availableSpace = screenHeight - keyboardHeight - 16;
          
          if (y + paletteHeight > availableSpace) {
            adjustedY = Math.max(16, availableSpace - paletteHeight);
          }
        }

        Object.assign(paletteElement.style, {
          left: `${x}px`,
          top: `${adjustedY}px`,
        });
      });
    });
  }

  // Lifecycle hooks
  onMount(() => {
    if (browser) {
      allCommands = getAllCommands();
      fuzzySearch = new FuzzySearch(allCommands, ['name', 'command', 'description']);
      
      // Initialize with categorized view
      categorizedCommands = getCategorizedCommands();
      
      // Set up keyboard detection
      const cleanupKeyboard = setupKeyboardDetection();
      
      // Focus search input when visible
      if (visible && searchInput) {
        searchInput.focus();
      }
      
      return () => {
        if (cleanupKeyboard) cleanupKeyboard();
        if (cleanupAutoUpdate) cleanupAutoUpdate();
        clearTimeout(searchTimeout);
      };
    }
  });

  onDestroy(() => {
    if (cleanupAutoUpdate) {
      cleanupAutoUpdate();
    }
    clearTimeout(searchTimeout);
  });

  // Reactive updates using $effect for Svelte 5
  $effect(() => {
    if (visible && searchInput && browser) {
      setTimeout(() => searchInput.focus(), 100);
    }
  });

  $effect(() => {
    if (visible) {
      updatePosition();
    }
  });

  $effect(() => {
    debounceSearch(searchQuery);
  });

  $effect(() => {
    if (browser && (commandHistory || favoriteCommands)) {
      allCommands = getAllCommands();
      if (fuzzySearch) {
        fuzzySearch.items = allCommands;
      }
    }
  });
</script>

{#if visible}
  <div 
    class="command-palette"
    bind:this={paletteElement}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Command palette"
  >
    <div class="palette-header">
      <div class="search-container">
        <div class="search-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
        </div>
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          placeholder="Search commands..."
          class="search-input"
          autocomplete="off"
          spellcheck="false"
        />
        <button 
          class="close-button"
          onclick={closePalette}
          aria-label="Close command palette"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="palette-content">
      {#if filteredCommands.length > 0}
        <!-- Search results -->
        <div class="command-list">
          {#each filteredCommands as command, index}
            <button
              class="command-item"
              class:selected={index === selectedIndex}
              onclick={() => handleCommandClick(command)}
            >
              <div class="command-info">
                <div class="command-name">{command.name}</div>
                <div class="command-text">{command.command}</div>
                {#if command.description}
                  <div class="command-description">{command.description}</div>
                {/if}
              </div>
              <div class="command-meta">
                {#if command.isRecent}
                  <span class="command-badge recent">Recent</span>
                {/if}
                {#if command.isFavorite}
                  <span class="command-badge favorite">⭐</span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {:else}
        <!-- Categorized commands -->
        <div class="categories-list">
          {#each categorizedCommands as category}
            <div class="category">
              <div class="category-header">
                <span class="category-icon">{category.icon}</span>
                <span class="category-name">{category.name}</span>
              </div>
              <div class="category-commands">
                {#each category.commands as command, index}
                  {@const globalIndex = categorizedCommands.slice(0, categorizedCommands.indexOf(category)).reduce((sum, cat) => sum + cat.commands.length, 0) + index}
                  <button
                    class="command-item"
                    class:selected={globalIndex === selectedIndex}
                    onclick={() => handleCommandClick(command)}
                  >
                    <div class="command-info">
                      <div class="command-name">{command.name}</div>
                      <div class="command-text">{command.command}</div>
                      {#if command.description}
                        <div class="command-description">{command.description}</div>
                      {/if}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if filteredCommands.length === 0 && categorizedCommands.length === 0}
        <div class="empty-state">
          <p>No commands found</p>
          <p class="empty-hint">Try a different search term</p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .command-palette {
    position: fixed;
    background: var(--bg-darker, #0a0a0a);
    border: 1px solid var(--border, rgba(0, 255, 136, 0.3));
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    z-index: 1000;
    min-width: 320px;
    max-width: 90vw;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .palette-header {
    padding: var(--space-sm);
    border-bottom: 1px solid var(--border, rgba(0, 255, 136, 0.2));
    background: rgba(var(--bg-primary-rgb, 26, 26, 26), 0.8);
  }

  .search-container {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    position: relative;
  }

  .search-icon {
    color: var(--text-secondary, #888);
    flex-shrink: 0;
  }

  .search-icon svg {
    width: 18px;
    height: 18px;
    stroke-width: 2;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-primary, #ffffff);
    font-size: 16px;
    padding: var(--space-sm) 0;
    outline: none;
    font-family: var(--font-mono, 'Courier New', monospace);
  }

  .search-input::placeholder {
    color: var(--text-secondary, #888);
  }

  .close-button {
    background: transparent;
    border: none;
    color: var(--text-secondary, #888);
    padding: var(--space-xs);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    min-width: 32px;
    min-height: 32px;
  }

  .close-button:hover {
    background: rgba(0, 255, 136, 0.1);
    color: var(--primary, #00ff88);
  }

  .close-button svg {
    width: 16px;
    height: 16px;
    stroke-width: 2;
  }

  .palette-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .command-list,
  .categories-list {
    padding: var(--space-xs);
  }

  .category {
    margin-bottom: var(--space-md);
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    color: var(--text-secondary, #888);
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .category-icon {
    font-size: 1rem;
  }

  .category-commands {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .command-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: transparent;
    border: none;
    color: var(--text-primary, #ffffff);
    padding: var(--space-sm);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
    min-height: 44px; /* Touch target */
  }

  .command-item:hover,
  .command-item.selected {
    background: rgba(0, 255, 136, 0.1);
    border-color: var(--primary, #00ff88);
  }

  .command-item.selected {
    outline: 2px solid var(--primary, #00ff88);
    outline-offset: -2px;
  }

  .command-info {
    flex: 1;
    min-width: 0;
  }

  .command-name {
    font-weight: 500;
    font-size: 0.9rem;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .command-text {
    font-family: var(--font-mono, 'Courier New', monospace);
    font-size: 0.8rem;
    color: var(--primary, #00ff88);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .command-description {
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .command-meta {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    margin-left: var(--space-sm);
  }

  .command-badge {
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
  }

  .command-badge.recent {
    background: rgba(255, 165, 0, 0.2);
    color: #ffa500;
  }

  .command-badge.favorite {
    background: transparent;
    color: #ffd700;
  }

  .empty-state {
    text-align: center;
    padding: var(--space-xl);
    color: var(--text-secondary, #888);
  }

  .empty-state p {
    margin: 0 0 var(--space-xs) 0;
  }

  .empty-hint {
    font-size: 0.85rem;
    opacity: 0.7;
  }

  /* Mobile optimizations */
  @media (max-width: 480px) {
    .command-palette {
      min-width: calc(100vw - 32px);
      max-height: 60vh;
    }

    .command-item {
      padding: var(--space-md);
    }

    .command-name {
      font-size: 1rem;
    }

    .command-text {
      font-size: 0.85rem;
    }
  }

  /* Scrollbar styling */
  .palette-content::-webkit-scrollbar {
    width: 6px;
  }

  .palette-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .palette-content::-webkit-scrollbar-thumb {
    background: rgba(0, 255, 136, 0.3);
    border-radius: 3px;
  }

  .palette-content::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 255, 136, 0.5);
  }

  /* Animations */
  .command-palette {
    animation: paletteSlideIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes paletteSlideIn {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Performance optimizations */
  .command-palette {
    contain: layout style;
    will-change: transform;
  }

  .command-item {
    contain: layout style;
  }
</style>