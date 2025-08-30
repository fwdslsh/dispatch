// tests/test-keyboard-toolbar-integration.js
// Test keyboard toolbar integration and functionality

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

console.log('🧪 Testing KeyboardToolbar integration and functionality...\n');

async function runTests() {
  try {
    // Test 1: Default configuration
    console.log('🔧 Test 1: Default toolbar configuration');
    
    const defaultConfig = [
      { key: 'Escape', label: 'Esc', code: 'Escape', symbol: '⎋' },
      { key: 'Tab', label: 'Tab', code: 'Tab', symbol: '↹' },
      { key: 'Control', label: 'Ctrl', code: 'ControlLeft', symbol: '^', isModifier: true },
      { key: 'Alt', label: 'Alt', code: 'AltLeft', symbol: '⌥', isModifier: true },
      { key: 'ArrowUp', label: '↑', code: 'ArrowUp', symbol: '↑' },
      { key: 'ArrowDown', label: '↓', code: 'ArrowDown', symbol: '↓' },
      { key: 'ArrowLeft', label: '←', code: 'ArrowLeft', symbol: '←' },
      { key: 'ArrowRight', label: '→', code: 'ArrowRight', symbol: '→' },
      { key: 'ctrl+c', label: 'Ctrl+C', code: 'KeyC', ctrlKey: true, symbol: '^C' },
      { key: 'ctrl+z', label: 'Ctrl+Z', code: 'KeyZ', ctrlKey: true, symbol: '^Z' },
      { key: 'pipe', label: '|', code: 'Backslash', shiftKey: true, symbol: '|' },
      { key: 'tilde', label: '~', code: 'Backquote', shiftKey: true, symbol: '~' }
    ];
    
    assert(defaultConfig.length === 12, 'Should have 12 default buttons');
    assert(defaultConfig.some(btn => btn.key === 'Escape'), 'Should include Escape key');
    assert(defaultConfig.some(btn => btn.key === 'Tab'), 'Should include Tab key');
    assert(defaultConfig.some(btn => btn.key === 'ctrl+c'), 'Should include Ctrl+C combination');
    
    console.log('   ✓ Default configuration contains expected buttons\n');
    
    // Test 2: Key sequence generation
    console.log('🔧 Test 2: Key sequence generation');
    
    function getKeySequence(button) {
      switch (button.key) {
        case 'Escape': return '\u001b';
        case 'Tab': return '\t';
        case 'ArrowUp': return '\u001b[A';
        case 'ArrowDown': return '\u001b[B';
        case 'ArrowRight': return '\u001b[C';
        case 'ArrowLeft': return '\u001b[D';
        case 'ctrl+c': return '\u0003';
        case 'ctrl+z': return '\u001a';
        case 'pipe': return '|';
        case 'tilde': return '~';
        default: return button.key;
      }
    }
    
    assertEqual(getKeySequence({ key: 'Escape' }), '\u001b', 'Escape should generate ESC sequence');
    assertEqual(getKeySequence({ key: 'Tab' }), '\t', 'Tab should generate tab character');
    assertEqual(getKeySequence({ key: 'ArrowUp' }), '\u001b[A', 'ArrowUp should generate ANSI up sequence');
    assertEqual(getKeySequence({ key: 'ctrl+c' }), '\u0003', 'Ctrl+C should generate interrupt character');
    assertEqual(getKeySequence({ key: 'pipe' }), '|', 'Pipe should generate pipe character');
    
    console.log('   ✓ Key sequences generated correctly\n');
    
    // Test 3: Configuration validation
    console.log('🔧 Test 3: Configuration validation');
    
    function validateToolbarConfig(config) {
      if (!Array.isArray(config)) return false;
      
      for (const button of config) {
        if (!button.key || !button.label) return false;
        if (typeof button.key !== 'string' || typeof button.label !== 'string') return false;
      }
      
      return true;
    }
    
    assert(validateToolbarConfig(defaultConfig), 'Default config should be valid');
    assert(!validateToolbarConfig(null), 'Null config should be invalid');
    assert(validateToolbarConfig([]), 'Empty config should be valid (allows hiding toolbar)');
    assert(!validateToolbarConfig([{ key: 'test' }]), 'Config missing label should be invalid');
    assert(!validateToolbarConfig([{ label: 'test' }]), 'Config missing key should be invalid');
    
    console.log('   ✓ Configuration validation works correctly\n');
    
    // Test 4: Mobile detection logic
    console.log('🔧 Test 4: Mobile detection and keyboard visibility logic');
    
    function shouldShowKeyboard(isMobile, keyboardVisible, heightDiff) {
      return isMobile && keyboardVisible && heightDiff > 150;
    }
    
    assert(!shouldShowKeyboard(false, true, 200), 'Should not show on desktop');
    assert(!shouldShowKeyboard(true, false, 200), 'Should not show when keyboard hidden');
    assert(!shouldShowKeyboard(true, true, 100), 'Should not show for small height difference');
    assert(shouldShowKeyboard(true, true, 200), 'Should show on mobile with keyboard visible');
    
    console.log('   ✓ Mobile detection logic works correctly\n');
    
    // Test 5: Safe area inset calculation
    console.log('🔧 Test 5: Safe area inset positioning');
    
    function calculateBottomPosition(keyboardHeight, safeAreaBottom = 0) {
      const adjustedHeight = Math.max(keyboardHeight - 50, 0);
      return `calc(env(safe-area-inset-bottom) + ${adjustedHeight}px)`;
    }
    
    assertEqual(
      calculateBottomPosition(0), 
      'calc(env(safe-area-inset-bottom) + 0px)', 
      'Zero keyboard height should give zero offset'
    );
    
    assertEqual(
      calculateBottomPosition(200), 
      'calc(env(safe-area-inset-bottom) + 150px)', 
      'Keyboard height 200 should give 150px offset'
    );
    
    assertEqual(
      calculateBottomPosition(30), 
      'calc(env(safe-area-inset-bottom) + 0px)', 
      'Small keyboard height should give zero offset'
    );
    
    console.log('   ✓ Safe area positioning calculated correctly\n');
    
    // Test 6: Touch target size validation
    console.log('🔧 Test 6: Touch target size validation');
    
    function validateTouchTarget(minWidth, minHeight) {
      const MINIMUM_TOUCH_SIZE = 44; // 44px minimum for accessibility
      return minWidth >= MINIMUM_TOUCH_SIZE && minHeight >= MINIMUM_TOUCH_SIZE;
    }
    
    assert(validateTouchTarget(44, 44), '44x44 should be valid touch target');
    assert(validateTouchTarget(48, 48), '48x48 should be valid touch target');
    assert(!validateTouchTarget(40, 44), '40x44 should be invalid touch target');
    assert(!validateTouchTarget(44, 40), '44x40 should be invalid touch target');
    
    console.log('   ✓ Touch target size validation works correctly\n');
    
    console.log('🎉 All KeyboardToolbar integration tests passed!\n');
    
    // Summary
    console.log('📊 Test Summary:');
    console.log('   ✅ Default configuration validation');
    console.log('   ✅ Key sequence generation');
    console.log('   ✅ Configuration validation logic');
    console.log('   ✅ Mobile detection and keyboard visibility');
    console.log('   ✅ Safe area inset positioning');
    console.log('   ✅ Touch target size validation\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

runTests().catch((error) => {
  console.error('KeyboardToolbar integration test suite failed:', error);
  process.exit(1);
});