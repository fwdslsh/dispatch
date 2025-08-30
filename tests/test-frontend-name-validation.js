// tests/test-frontend-name-validation.js
// Test frontend session name validation utilities
import { 
  validateSessionName, 
  validateSessionNameWithFeedback, 
  validateSessionNameRealtime 
} from '../src/lib/utils/session-name-validation.js';

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

console.log('🧪 Testing frontend name validation utilities...\\n');

async function runTests() {
  try {
    // Test 1: Basic validateSessionName function
    console.log('🔧 Test 1: Basic validation function');
    
    // Valid names
    let result = validateSessionName('My Session');
    assert(result.isValid, 'Should accept valid name with space');
    
    result = validateSessionName('test-session_123');
    assert(result.isValid, 'Should accept valid name with hyphens and underscores');
    
    result = validateSessionName('a');
    assert(result.isValid, 'Should accept single character');
    
    // Invalid names
    result = validateSessionName('');
    assert(!result.isValid && result.error, 'Should reject empty string');
    
    result = validateSessionName('   ');
    assert(!result.isValid && result.error, 'Should reject whitespace-only string');
    
    result = validateSessionName('a'.repeat(51));
    assert(!result.isValid && result.error, 'Should reject names longer than 50 characters');
    
    result = validateSessionName('test@session');
    assert(!result.isValid && result.error, 'Should reject names with invalid characters');
    
    result = validateSessionName('test(session)');
    assert(!result.isValid && result.error, 'Should reject names with parentheses');
    
    console.log('   ✓ Basic validation works correctly\\n');
    
    // Test 2: validateSessionNameWithFeedback function
    console.log('🔧 Test 2: Validation with user feedback');
    
    // Empty name (allowed)
    result = validateSessionNameWithFeedback('');
    assert(result.isValid, 'Should allow empty name');
    assert(result.message && result.severity === 'info', 'Should provide info message for empty name');
    
    result = validateSessionNameWithFeedback('   ');
    assert(result.isValid, 'Should allow whitespace-only name');
    
    // Short name warning
    result = validateSessionNameWithFeedback('ab');
    assert(result.isValid, 'Should allow short name');
    assert(result.severity === 'warning', 'Should warn about very short name');
    
    // Long name warning
    result = validateSessionNameWithFeedback('a'.repeat(35));
    assert(result.isValid, 'Should allow long valid name');
    assert(result.severity === 'warning', 'Should warn about long name');
    
    // Invalid name
    result = validateSessionNameWithFeedback('test@session');
    assert(!result.isValid, 'Should reject invalid name');
    assert(result.severity === 'error', 'Should show error for invalid name');
    
    // Perfect name
    result = validateSessionNameWithFeedback('My Session');
    assert(result.isValid, 'Should accept good name');
    assert(!result.message, 'Should not show message for perfect name');
    
    console.log('   ✓ Feedback validation works correctly\\n');
    
    // Test 3: validateSessionNameRealtime function
    console.log('🔧 Test 3: Real-time validation');
    
    // Empty input (no error while typing)
    result = validateSessionNameRealtime('');
    assert(result.isValid, 'Should not show error for empty input');
    assert(!result.message, 'Should not show message for empty input');
    
    // Normal typing
    result = validateSessionNameRealtime('My Sess');
    assert(result.isValid, 'Should accept normal input');
    assert(!result.message, 'Should not show message for normal input');
    
    // Approaching character limit
    result = validateSessionNameRealtime('a'.repeat(46));
    assert(result.isValid, 'Should accept input near limit');
    assert(result.message && result.severity === 'warning', 'Should warn when approaching limit');
    
    // At character limit
    result = validateSessionNameRealtime('a'.repeat(50));
    assert(result.isValid, 'Should accept input at limit');
    assert(result.message && result.message.includes('0 characters remaining'), 'Should show 0 remaining');
    
    // Over character limit
    result = validateSessionNameRealtime('a'.repeat(51));
    assert(!result.isValid, 'Should reject input over limit');
    assert(result.severity === 'error', 'Should show error for too long input');
    
    // Invalid characters
    result = validateSessionNameRealtime('test@');
    assert(!result.isValid, 'Should reject invalid characters');
    assert(result.severity === 'error', 'Should show error for invalid characters');
    
    console.log('   ✓ Real-time validation works correctly\\n');
    
    // Test 4: Edge cases
    console.log('🔧 Test 4: Edge cases');
    
    // Null and undefined
    result = validateSessionName(null);
    assert(!result.isValid, 'Should reject null');
    
    result = validateSessionName(undefined);
    assert(!result.isValid, 'Should reject undefined');
    
    // Non-string input
    result = validateSessionName(123);
    assert(!result.isValid, 'Should reject number input');
    
    result = validateSessionName({});
    assert(!result.isValid, 'Should reject object input');
    
    // Exactly 50 characters
    const fiftyChars = 'a'.repeat(50);
    result = validateSessionName(fiftyChars);
    assert(result.isValid, 'Should accept exactly 50 characters');
    assertEqual(fiftyChars.length, 50, 'Test string should be exactly 50 characters');
    
    // Various valid special characters
    result = validateSessionName('test-session_123 name');
    assert(result.isValid, 'Should accept hyphens, underscores, and spaces');
    
    console.log('   ✓ Edge cases handled correctly\\n');
    
    console.log('🎉 All frontend name validation tests passed!\\n');
    
    // Summary
    console.log('📊 Test Summary:');
    console.log('   ✅ Basic validation function');
    console.log('   ✅ User feedback validation');
    console.log('   ✅ Real-time validation');
    console.log('   ✅ Edge case handling\\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});