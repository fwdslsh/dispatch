import { JSDOM } from 'jsdom';

// Simple assertion helper
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Mock environment setup
const dom = new JSDOM(`<!DOCTYPE html>
  <div id="test-container">
    <div id="command-menu-mount"></div>
  </div>
  <style>
    .command-menu { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1000; }
    .command-menu-overlay { background: rgba(0,0,0,0.8); width: 100%; height: 100%; }
    .command-menu-dialog { background: white; margin: 20% auto; width: 500px; border-radius: 8px; }
    .command-search { width: 100%; padding: 12px; border: none; font-size: 16px; }
    .command-list { max-height: 300px; overflow-y: auto; }
    .command-item { padding: 12px; cursor: pointer; border-bottom: 1px solid #eee; }
    .command-item.selected { background: #f0f0f0; }
    .command-item:hover { background: #f5f5f5; }
  </style>
`, {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);

// Mock sessionStorage
const sessionStorage = {
  data: {},
  getItem(key) { return this.data[key] || null; },
  setItem(key, value) { this.data[key] = value; },
  removeItem(key) { delete this.data[key]; },
  clear() { this.data = {}; }
};
global.sessionStorage = sessionStorage;

// Mock commands data
const mockCommands = [
  {
    id: 'help',
    name: '/help',
    description: 'Show available commands',
    category: 'general',
    shortcut: 'Ctrl+H'
  },
  {
    id: 'clear',
    name: '/clear',
    description: 'Clear the chat history',
    category: 'chat',
    shortcut: 'Ctrl+L'
  },
  {
    id: 'debug',
    name: '/debug',
    description: 'Enable debug mode',
    category: 'development',
    shortcut: null
  },
  {
    id: 'analyze-code',
    name: '/analyze',
    description: 'Analyze the current codebase',
    category: 'development',
    shortcut: 'Ctrl+A'
  },
  {
    id: 'generate-tests',
    name: '/tests',
    description: 'Generate unit tests for the current file',
    category: 'development',
    shortcut: 'Ctrl+T'
  }
];

// Mock CommandMenu component
class CommandMenu {
  constructor(target, props = {}) {
    this.target = target;
    this.commands = props.commands || [];
    this.visible = props.visible || false;
    this.onExecuteCommand = props.onExecuteCommand || (() => {});
    this.onClose = props.onClose || (() => {});
    this.sessionId = props.sessionId || 'test-session';
    
    this.searchQuery = '';
    this.selectedIndex = 0;
    this.filteredCommands = [...this.commands];
    
    this.setupKeyboardListeners();
    this.loadCommandCache();
    this.render();
  }
  
  setupKeyboardListeners() {
    this.keydownHandler = (event) => {
      // Global shortcut: Ctrl+K (or Cmd+K on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        this.show();
        return;
      }
      
      if (!this.visible) return;
      
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          this.hide();
          break;
        case 'ArrowDown':
          event.preventDefault();
          this.selectNext();
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.selectPrevious();
          break;
        case 'Enter':
          event.preventDefault();
          this.executeSelected();
          break;
      }
    };
    
    document.addEventListener('keydown', this.keydownHandler);
  }
  
  show() {
    this.visible = true;
    this.searchQuery = '';
    this.selectedIndex = 0;
    this.filterCommands();
    this.render();
    
    // Focus search input
    const searchInput = this.target.querySelector('.command-search');
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 0);
    }
  }
  
  hide() {
    this.visible = false;
    this.onClose();
    this.render();
  }
  
  setCommands(commands) {
    this.commands = commands;
    this.filterCommands();
    this.saveCommandCache();
    this.render();
  }
  
  updateSearch(query) {
    this.searchQuery = query;
    this.selectedIndex = 0;
    this.filterCommands();
    this.render();
  }
  
  filterCommands() {
    if (!this.searchQuery) {
      this.filteredCommands = [...this.commands];
      return;
    }
    
    const query = this.searchQuery.toLowerCase();
    this.filteredCommands = this.commands.filter(cmd => 
      cmd.name.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query)
    );
  }
  
  selectNext() {
    this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
    this.render();
  }
  
  selectPrevious() {
    this.selectedIndex = this.selectedIndex === 0 
      ? this.filteredCommands.length - 1 
      : this.selectedIndex - 1;
    this.render();
  }
  
  selectCommand(index) {
    this.selectedIndex = index;
    this.render();
  }
  
  executeSelected() {
    const command = this.filteredCommands[this.selectedIndex];
    if (command) {
      this.executeCommand(command);
    }
  }
  
  executeCommand(command) {
    this.onExecuteCommand(command);
    this.hide();
  }
  
  loadCommandCache() {
    const key = `command-cache-${this.sessionId}`;
    const cached = sessionStorage.getItem(key);
    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
        if (cachedData.timestamp && (Date.now() - cachedData.timestamp < 300000)) { // 5 minutes
          this.commands = cachedData.commands || [];
          this.filterCommands();
        }
      } catch (error) {
        console.warn('Failed to load command cache:', error);
      }
    }
  }
  
  saveCommandCache() {
    const key = `command-cache-${this.sessionId}`;
    try {
      const cacheData = {
        commands: this.commands,
        timestamp: Date.now()
      };
      sessionStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save command cache:', error);
    }
  }
  
  clearCache() {
    const key = `command-cache-${this.sessionId}`;
    sessionStorage.removeItem(key);
  }
  
  render() {
    if (!this.visible) {
      this.target.innerHTML = '';
      return;
    }
    
    this.target.innerHTML = `
      <div class="command-menu">
        <div class="command-menu-overlay">
          <div class="command-menu-dialog">
            <input 
              type="text" 
              class="command-search" 
              placeholder="Search commands..." 
              value="${this.searchQuery}"
            />
            <div class="command-list">
              ${this.filteredCommands.map((cmd, index) => `
                <div 
                  class="command-item ${index === this.selectedIndex ? 'selected' : ''}" 
                  data-index="${index}"
                >
                  <div class="command-name">${cmd.name}</div>
                  <div class="command-description">${cmd.description}</div>
                  ${cmd.shortcut ? `<div class="command-shortcut">${cmd.shortcut}</div>` : ''}
                  <div class="command-category">${cmd.category}</div>
                </div>
              `).join('')}
              ${this.filteredCommands.length === 0 ? '<div class="no-results">No commands found</div>' : ''}
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    const searchInput = this.target.querySelector('.command-search');
    const commandItems = this.target.querySelectorAll('.command-item');
    const overlay = this.target.querySelector('.command-menu-overlay');
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.updateSearch(e.target.value);
      });
    }
    
    commandItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectCommand(index);
        this.executeSelected();
      });
      
      item.addEventListener('mouseenter', () => {
        this.selectCommand(index);
      });
    });
    
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.hide();
        }
      });
    }
  }
  
  getVisibleCommands() {
    return this.filteredCommands;
  }
  
  getSelectedCommand() {
    return this.filteredCommands[this.selectedIndex] || null;
  }
  
  isVisible() {
    return this.visible;
  }
  
  destroy() {
    document.removeEventListener('keydown', this.keydownHandler);
    this.target.innerHTML = '';
  }
}

// Test Suite
console.log('🧪 Testing CommandMenu Component...\n');

try {
  // Test 3.1: CommandMenu component initialization
  console.log('📋 Test 3.1: CommandMenu component initialization');
  
  // Test 3.1.1: Component creation
  console.log('  Test 3.1.1: Create CommandMenu component');
  const container = document.getElementById('command-menu-mount');
  const commandMenu = new CommandMenu(container, {
    sessionId: 'test-session-1',
    commands: mockCommands
  });
  
  assert(commandMenu.commands.length === mockCommands.length, 'Should load provided commands');
  assert(commandMenu.sessionId === 'test-session-1', 'Should have correct session ID');
  assert(commandMenu.visible === false, 'Should not be visible initially');
  console.log('    ✅ Component created successfully');
  
  // Test 3.1.2: Initial state
  console.log('  Test 3.1.2: Initial component state');
  assert(commandMenu.searchQuery === '', 'Search query should be empty initially');
  assert(commandMenu.selectedIndex === 0, 'Selected index should be 0 initially');
  assert(commandMenu.filteredCommands.length === mockCommands.length, 'All commands should be visible initially');
  console.log('    ✅ Initial state correct');

  // Test 3.2: Command filtering and search
  console.log('\n📋 Test 3.2: Command filtering and search functionality');
  
  // Test 3.2.1: Search by command name
  console.log('  Test 3.2.1: Search by command name');
  commandMenu.updateSearch('/help');
  assert(commandMenu.filteredCommands.length === 1, 'Should find 1 command matching "/help"');
  assert(commandMenu.filteredCommands[0].name === '/help', 'Should find the help command');
  console.log('    ✅ Name search works correctly');
  
  // Test 3.2.2: Search by description
  console.log('  Test 3.2.2: Search by description');
  commandMenu.updateSearch('debug');
  assert(commandMenu.filteredCommands.length === 1, 'Should find 1 command with "debug"');
  assert(commandMenu.filteredCommands.some(cmd => cmd.id === 'debug'), 'Should include debug command');
  console.log('    ✅ Description search works correctly');
  
  // Test 3.2.3: Search by category
  console.log('  Test 3.2.3: Search by category');
  commandMenu.updateSearch('development');
  assert(commandMenu.filteredCommands.length === 3, 'Should find 3 development commands');
  console.log('    ✅ Category search works correctly');
  
  // Test 3.2.4: No results
  console.log('  Test 3.2.4: No search results');
  commandMenu.updateSearch('nonexistent');
  assert(commandMenu.filteredCommands.length === 0, 'Should find no commands');
  console.log('    ✅ No results handling works correctly');

  // Test 3.3: Keyboard navigation
  console.log('\n📋 Test 3.3: Keyboard navigation');
  
  // Reset search
  commandMenu.updateSearch('');
  
  // Test 3.3.1: Arrow key navigation
  console.log('  Test 3.3.1: Arrow key navigation');
  assert(commandMenu.selectedIndex === 0, 'Should start at index 0');
  
  commandMenu.selectNext();
  assert(commandMenu.selectedIndex === 1, 'Should move to index 1');
  
  commandMenu.selectNext();
  assert(commandMenu.selectedIndex === 2, 'Should move to index 2');
  
  commandMenu.selectPrevious();
  assert(commandMenu.selectedIndex === 1, 'Should move back to index 1');
  console.log('    ✅ Arrow key navigation works');
  
  // Test 3.3.2: Wraparound navigation
  console.log('  Test 3.3.2: Wraparound navigation');
  commandMenu.selectedIndex = 0;
  commandMenu.selectPrevious();
  assert(commandMenu.selectedIndex === mockCommands.length - 1, 'Should wrap to last index');
  
  commandMenu.selectNext();
  assert(commandMenu.selectedIndex === 0, 'Should wrap to first index');
  console.log('    ✅ Wraparound navigation works');

  // Test 3.4: Command execution
  console.log('\n📋 Test 3.4: Command execution');
  
  // Test 3.4.1: Execute selected command
  console.log('  Test 3.4.1: Execute selected command');
  let executedCommand = null;
  commandMenu.onExecuteCommand = (cmd) => { executedCommand = cmd; };
  
  commandMenu.selectedIndex = 1; // Select '/clear' command
  commandMenu.executeSelected();
  
  assert(executedCommand !== null, 'Command should be executed');
  assert(executedCommand.name === '/clear', 'Should execute the clear command');
  assert(commandMenu.visible === false, 'Menu should be hidden after execution');
  console.log('    ✅ Command execution works');
  
  // Test 3.4.2: Execute specific command
  console.log('  Test 3.4.2: Execute specific command');
  executedCommand = null;
  commandMenu.executeCommand(mockCommands[2]); // Execute debug command
  
  assert(executedCommand !== null, 'Command should be executed');
  assert(executedCommand.name === '/debug', 'Should execute the debug command');
  console.log('    ✅ Specific command execution works');

  // Test 3.5: Show/hide functionality
  console.log('\n📋 Test 3.5: Show/hide functionality');
  
  // Test 3.5.1: Show command menu
  console.log('  Test 3.5.1: Show command menu');
  commandMenu.show();
  assert(commandMenu.visible === true, 'Menu should be visible');
  
  const menuElement = container.querySelector('.command-menu');
  assert(menuElement !== null, 'Menu element should be rendered');
  console.log('    ✅ Show functionality works');
  
  // Test 3.5.2: Hide command menu
  console.log('  Test 3.5.2: Hide command menu');
  let closeCalled = false;
  commandMenu.onClose = () => { closeCalled = true; };
  
  commandMenu.hide();
  assert(commandMenu.visible === false, 'Menu should not be visible');
  assert(closeCalled === true, 'onClose callback should be called');
  
  const hiddenMenuElement = container.querySelector('.command-menu');
  assert(hiddenMenuElement === null, 'Menu element should not be rendered when hidden');
  console.log('    ✅ Hide functionality works');

  // Test 3.6: Keyboard shortcut handling
  console.log('\n📋 Test 3.6: Keyboard shortcut handling (Ctrl+K)');
  
  // Test 3.6.1: Global shortcut
  console.log('  Test 3.6.1: Global keyboard shortcut');
  commandMenu.hide(); // Ensure it's hidden
  
  // Simulate Ctrl+K
  const ctrlKEvent = new dom.window.KeyboardEvent('keydown', {
    key: 'k',
    ctrlKey: true,
    bubbles: true,
    cancelable: true
  });
  
  document.dispatchEvent(ctrlKEvent);
  assert(commandMenu.visible === true, 'Menu should be visible after Ctrl+K');
  console.log('    ✅ Global keyboard shortcut works');
  
  // Test 3.6.2: Escape to close
  console.log('  Test 3.6.2: Escape key to close');
  const escapeEvent = new dom.window.KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true
  });
  
  document.dispatchEvent(escapeEvent);
  assert(commandMenu.visible === false, 'Menu should be hidden after Escape');
  console.log('    ✅ Escape key closing works');

  // Test 3.7: Session-based command caching
  console.log('\n📋 Test 3.7: Session-based command caching');
  
  // Test 3.7.1: Save commands to cache
  console.log('  Test 3.7.1: Save commands to cache');
  const testCommands = [
    { id: 'test1', name: '/test1', description: 'Test command 1', category: 'test' }
  ];
  
  commandMenu.setCommands(testCommands);
  const cacheKey = 'command-cache-test-session-1';
  const cachedData = sessionStorage.getItem(cacheKey);
  assert(cachedData !== null, 'Commands should be saved to cache');
  
  const parsed = JSON.parse(cachedData);
  assert(parsed.commands.length === 1, 'Cached commands should match');
  assert(parsed.timestamp !== undefined, 'Cache should have timestamp');
  console.log('    ✅ Command caching works');
  
  // Test 3.7.2: Load commands from cache
  console.log('  Test 3.7.2: Load commands from cache');
  const newCommandMenu = new CommandMenu(document.createElement('div'), {
    sessionId: 'test-session-1',
    commands: [] // Start with empty commands
  });
  
  assert(newCommandMenu.commands.length === 1, 'Should load commands from cache');
  assert(newCommandMenu.commands[0].name === '/test1', 'Should load correct command');
  console.log('    ✅ Command loading from cache works');
  
  // Test 3.7.3: Clear cache
  console.log('  Test 3.7.3: Clear command cache');
  commandMenu.clearCache();
  assert(sessionStorage.getItem(cacheKey) === null, 'Cache should be cleared');
  console.log('    ✅ Cache clearing works');

  // Test 3.8: DOM interaction
  console.log('\n📋 Test 3.8: DOM interaction and event handling');
  
  // Test 3.8.1: Search input interaction
  console.log('  Test 3.8.1: Search input interaction');
  commandMenu.setCommands(mockCommands);
  commandMenu.show();
  
  const searchInput = container.querySelector('.command-search');
  assert(searchInput !== null, 'Search input should exist');
  
  // Simulate input
  searchInput.value = 'help';
  const inputEvent = new dom.window.Event('input', { bubbles: true });
  searchInput.dispatchEvent(inputEvent);
  
  // Check if search was updated
  assert(commandMenu.filteredCommands.length === 1, 'Search should filter commands');
  console.log('    ✅ Search input interaction works');
  
  // Test 3.8.2: Command item click
  console.log('  Test 3.8.2: Command item click interaction');
  executedCommand = null;
  commandMenu.updateSearch(''); // Reset search
  
  const commandItems = container.querySelectorAll('.command-item');
  assert(commandItems.length > 0, 'Command items should exist');
  
  commandItems[0].click();
  assert(executedCommand !== null, 'Command should be executed on click');
  console.log('    ✅ Command item click works');

  console.log('\n✅ All CommandMenu component tests passed!\n');
  
  // Cleanup
  commandMenu.destroy();
  newCommandMenu.destroy();
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}

// Export for use in actual implementation
export { CommandMenu };