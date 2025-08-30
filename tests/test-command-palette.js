// tests/test-command-palette.js
// Test command palette functionality

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}. Expected: ${expected}, Actual: ${actual}`);
  }
}

console.log('🧪 Testing Mobile Command Palette System...\n');

async function runTests() {
  try {
    // Test 1: Fuzzy search algorithm
    console.log('🔧 Test 1: Fuzzy search algorithm');
    
    class FuzzySearch {
      constructor(items, keys = ['name', 'command']) {
        this.items = items;
        this.keys = keys;
      }
      
      search(query, maxResults = 10) {
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
    
    const testCommands = [
      { name: 'List files', command: 'ls -la', category: 'filesystem' },
      { name: 'Git status', command: 'git status', category: 'git' },
      { name: 'Git log', command: 'git log --oneline', category: 'git' },
      { name: 'List processes', command: 'ps aux', category: 'system' },
      { name: 'Network status', command: 'netstat -tuln', category: 'network' },
    ];
    
    const fuzzySearch = new FuzzySearch(testCommands);
    
    // Test exact match
    const exactResults = fuzzySearch.search('git status');
    assert(exactResults.length > 0, 'Should find exact match');
    assert(exactResults[0].command === 'git status', 'Exact match should be first');
    
    // Test partial match
    const partialResults = fuzzySearch.search('git');
    assert(partialResults.length >= 2, 'Should find multiple git commands');
    assert(partialResults.every(r => r.command.includes('git')), 'All results should contain git');
    
    // Test fuzzy match
    const fuzzyResults = fuzzySearch.search('lst');
    assert(fuzzyResults.length > 0, 'Should find fuzzy matches');
    
    console.log('   ✓ Fuzzy search algorithm works correctly\n');
    
    // Test 2: Command categorization
    console.log('🔧 Test 2: Command categorization');
    
    class CommandCategories {
      constructor() {
        this.categories = {
          recent: { name: 'Recent', icon: '🕐', priority: 1 },
          favorites: { name: 'Favorites', icon: '⭐', priority: 2 },
          filesystem: { name: 'File System', icon: '📁', priority: 3 },
          git: { name: 'Git', icon: '🌿', priority: 4 },
          system: { name: 'System', icon: '⚙️', priority: 5 },
          network: { name: 'Network', icon: '🌐', priority: 6 },
          custom: { name: 'Custom', icon: '🔧', priority: 7 }
        };
      }
      
      categorizeCommands(commands, recentCommands = [], favoriteCommands = []) {
        const categorized = {};
        
        // Initialize categories
        Object.keys(this.categories).forEach(key => {
          categorized[key] = {
            ...this.categories[key],
            commands: []
          };
        });
        
        // Add recent commands
        recentCommands.forEach(cmd => {
          categorized.recent.commands.push({ ...cmd, isRecent: true });
        });
        
        // Add favorite commands
        favoriteCommands.forEach(cmd => {
          categorized.favorites.commands.push({ ...cmd, isFavorite: true });
        });
        
        // Categorize other commands
        commands.forEach(cmd => {
          const category = cmd.category || 'custom';
          if (categorized[category] && !recentCommands.find(r => r.command === cmd.command) && 
              !favoriteCommands.find(f => f.command === cmd.command)) {
            categorized[category].commands.push(cmd);
          }
        });
        
        // Return only categories with commands, sorted by priority
        return Object.values(categorized)
          .filter(cat => cat.commands.length > 0)
          .sort((a, b) => a.priority - b.priority);
      }
    }
    
    const categorizer = new CommandCategories();
    const recentCommands = [testCommands[1]]; // Git status
    const favoriteCommands = [testCommands[0]]; // List files
    
    const categorized = categorizer.categorizeCommands(testCommands, recentCommands, favoriteCommands);
    
    assert(categorized.length >= 3, 'Should have multiple categories');
    assert(categorized[0].name === 'Recent', 'Recent should be first category');
    assert(categorized[1].name === 'Favorites', 'Favorites should be second category');
    assert(categorized[0].commands[0].command === 'git status', 'Recent should contain git status');
    
    console.log('   ✓ Command categorization works correctly\n');
    
    // Test 3: Command history management
    console.log('🔧 Test 3: Command history management');
    
    class CommandHistory {
      constructor(maxSize = 50) {
        this.maxSize = maxSize;
        this.history = [];
        this.favorites = new Set();
      }
      
      addCommand(command) {
        // Find existing entry if present
        const existingIndex = this.history.findIndex(h => h.command === command.command);
        let existingUseCount = 0;
        
        if (existingIndex !== -1) {
          existingUseCount = this.history[existingIndex].useCount || 0;
          this.history.splice(existingIndex, 1);
        }
        
        // Add to front with timestamp and incremented use count
        this.history.unshift({
          ...command,
          timestamp: Date.now(),
          useCount: existingUseCount + 1
        });
        
        // Trim to max size
        if (this.history.length > this.maxSize) {
          this.history = this.history.slice(0, this.maxSize);
        }
      }
      
      getRecentCommands(count = 10) {
        return this.history.slice(0, count);
      }
      
      getPopularCommands(count = 10) {
        return [...this.history]
          .sort((a, b) => b.useCount - a.useCount)
          .slice(0, count);
      }
      
      toggleFavorite(command) {
        if (this.favorites.has(command)) {
          this.favorites.delete(command);
          return false;
        } else {
          this.favorites.add(command);
          return true;
        }
      }
      
      getFavorites() {
        return this.history.filter(h => this.favorites.has(h.command));
      }
    }
    
    const history = new CommandHistory(5);
    
    // Test adding commands
    history.addCommand({ name: 'Test 1', command: 'test1' });
    history.addCommand({ name: 'Test 2', command: 'test2' });
    history.addCommand({ name: 'Test 1', command: 'test1' }); // Duplicate
    
    const recent = history.getRecentCommands();
    assertEqual(recent.length, 2, 'Should have 2 unique commands');
    assertEqual(recent[0].command, 'test1', 'Most recent should be first');
    assertEqual(recent[0].useCount, 2, 'Use count should be incremented');
    
    // Test favorites
    history.toggleFavorite('test1');
    const favorites = history.getFavorites();
    assertEqual(favorites.length, 1, 'Should have 1 favorite');
    assertEqual(favorites[0].command, 'test1', 'Favorite should be test1');
    
    console.log('   ✓ Command history management works correctly\n');
    
    // Test 4: Touch-friendly interface calculations
    console.log('🔧 Test 4: Touch-friendly interface calculations');
    
    class TouchInterface {
      constructor() {
        this.minTouchTarget = 44; // iOS HIG minimum
        this.maxItemsPerScreen = 8; // Prevent overcrowding
        this.searchInputHeight = 48;
        this.categoryHeaderHeight = 32;
        this.itemPadding = 12;
      }
      
      calculateLayout(screenHeight, itemCount) {
        const availableHeight = screenHeight - this.searchInputHeight - 40; // Margins
        const maxItemHeight = Math.floor(availableHeight / Math.min(itemCount, this.maxItemsPerScreen));
        const itemHeight = Math.max(this.minTouchTarget, Math.min(60, maxItemHeight));
        const maxVisibleItems = Math.min(this.maxItemsPerScreen, Math.floor(availableHeight / itemHeight));
        
        return {
          itemHeight,
          maxVisibleItems,
          needsScrolling: itemCount > maxVisibleItems,
          totalHeight: this.searchInputHeight + (itemHeight * Math.min(itemCount, maxVisibleItems))
        };
      }
      
      shouldShowKeyboardAvoidance(keyboardHeight, paletteHeight) {
        const screenHeight = window.innerHeight || 800;
        const availableSpace = screenHeight - keyboardHeight;
        return paletteHeight > availableSpace * 0.7;
      }
    }
    
    const touchInterface = new TouchInterface();
    
    // Test small screen with few items
    const smallLayout = touchInterface.calculateLayout(600, 3);
    assert(smallLayout.itemHeight >= 44, 'Items should meet minimum touch target size');
    assert(!smallLayout.needsScrolling, 'Should not need scrolling for few items');
    
    // Test large screen with many items
    const largeLayout = touchInterface.calculateLayout(800, 15);
    assert(largeLayout.needsScrolling, 'Should need scrolling for many items');
    assert(largeLayout.maxVisibleItems <= 8, 'Should not show more than max items');
    
    console.log('   ✓ Touch-friendly interface calculations work correctly\n');
    
    // Test 5: Keyboard avoidance logic
    console.log('🔧 Test 5: Keyboard avoidance logic');
    
    function calculatePalettePosition(screenWidth, screenHeight, keyboardHeight, paletteHeight) {
      const margin = 16;
      const availableHeight = screenHeight - keyboardHeight - margin * 2;
      
      let position = {
        top: 'auto',
        bottom: 'auto',
        left: margin,
        right: margin,
        maxHeight: Math.min(paletteHeight, availableHeight)
      };
      
      if (keyboardHeight > 0) {
        // Keyboard is visible, position above it
        position.bottom = keyboardHeight + margin;
      } else {
        // No keyboard, center vertically
        position.top = Math.max(margin, (screenHeight - paletteHeight) / 2);
      }
      
      return position;
    }
    
    // Test with keyboard visible
    const withKeyboard = calculatePalettePosition(375, 812, 300, 400);
    assert(withKeyboard.bottom === 316, 'Should position above keyboard');
    assert(withKeyboard.maxHeight <= 496, 'Should limit height when keyboard is visible');
    
    // Test without keyboard
    const withoutKeyboard = calculatePalettePosition(375, 812, 0, 400);
    assert(withoutKeyboard.top > 0, 'Should center when no keyboard');
    
    console.log('   ✓ Keyboard avoidance logic works correctly\n');
    
    // Test 6: Performance optimizations
    console.log('🔧 Test 6: Performance optimizations');
    
    class PerformanceOptimizer {
      constructor() {
        this.debounceTime = 150;
        this.maxSearchResults = 20;
        this.virtualScrollThreshold = 50;
      }
      
      debounce(func, delay = this.debounceTime) {
        let timeoutId;
        return function (...args) {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
      }
      
      shouldUseVirtualScrolling(itemCount) {
        return itemCount > this.virtualScrollThreshold;
      }
      
      optimizeSearchResults(results) {
        // Limit results and ensure high-quality matches
        return results
          .filter(r => r.score > 0.1) // Minimum relevance threshold
          .slice(0, this.maxSearchResults);
      }
    }
    
    const optimizer = new PerformanceOptimizer();
    
    // Test debouncing
    let callCount = 0;
    const debouncedFn = optimizer.debounce(() => callCount++, 10);
    debouncedFn();
    debouncedFn();
    debouncedFn();
    
    // Check after delay
    await new Promise(resolve => setTimeout(resolve, 15));
    assertEqual(callCount, 1, 'Debounced function should only call once');
    
    // Test virtual scrolling decision
    assert(!optimizer.shouldUseVirtualScrolling(20), 'Should not use virtual scrolling for small lists');
    assert(optimizer.shouldUseVirtualScrolling(100), 'Should use virtual scrolling for large lists');
    
    console.log('   ✓ Performance optimizations work correctly\n');
    
    console.log('🎉 All Mobile Command Palette tests passed!\n');
    
    // Summary
    console.log('📊 Test Summary:');
    console.log('   ✅ Fuzzy search algorithm');
    console.log('   ✅ Command categorization');
    console.log('   ✅ Command history management');
    console.log('   ✅ Touch-friendly interface calculations');
    console.log('   ✅ Keyboard avoidance logic');
    console.log('   ✅ Performance optimizations\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

runTests().catch((error) => {
  console.error('Mobile Command Palette test suite failed:', error);
  process.exit(1);
});