// tests/run-name-validation-tests.js
// Simple test runner for name validation utilities
import { validateSessionName, sanitizeSessionName, generateFallbackName, resolveNameConflict } from '../src/lib/server/name-validation.js';

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

console.log('Running name validation tests...\n');

// Test validateSessionName
console.log('Testing validateSessionName...');
assert(validateSessionName('My Project'), 'Should accept valid name');
assert(validateSessionName('react-frontend'), 'Should accept name with hyphens');
assert(validateSessionName('API_Server_2024'), 'Should accept name with underscores and numbers');
assert(!validateSessionName(''), 'Should reject empty string');
assert(!validateSessionName('   '), 'Should reject whitespace only');
assert(!validateSessionName('a'.repeat(51)), 'Should reject names longer than 50 characters');
assert(!validateSessionName('My/Project'), 'Should reject names with invalid characters');
assert(validateSessionName('a'), 'Should accept single character');
assert(validateSessionName('a'.repeat(50)), 'Should accept 50 character name');
console.log('✓ validateSessionName tests passed');

// Test sanitizeSessionName
console.log('Testing sanitizeSessionName...');
assertEqual(sanitizeSessionName('My Project'), 'my-project', 'Should replace spaces with hyphens');
assertEqual(sanitizeSessionName('My/Project'), 'my-project', 'Should replace invalid chars with hyphens');
assertEqual(sanitizeSessionName('My   Project'), 'my-project', 'Should collapse multiple spaces');
assertEqual(sanitizeSessionName('  My Project  '), 'my-project', 'Should trim whitespace');
assertEqual(sanitizeSessionName('API Server'), 'api-server', 'Should convert to lowercase');
assertEqual(sanitizeSessionName(''), '', 'Should handle empty input');
assertEqual(sanitizeSessionName('   '), '', 'Should handle whitespace only');
console.log('✓ sanitizeSessionName tests passed');

// Test generateFallbackName
console.log('Testing generateFallbackName...');
const sessionId = '12345678-1234-1234-1234-123456789012';
assertEqual(generateFallbackName(sessionId), 'Session 12345678', 'Should use first 8 chars of UUID');
assertEqual(generateFallbackName('1234567'), 'Session 1234567', 'Should handle short IDs');
assertEqual(generateFallbackName('123'), 'Session 123', 'Should use full short ID');
console.log('✓ generateFallbackName tests passed');

// Test resolveNameConflict  
console.log('Testing resolveNameConflict...');
const existingNames = ['My Project', 'Test Session', 'My Project (2)'];
assertEqual(resolveNameConflict('New Project', existingNames), 'New Project', 'Should return name if no conflict');
assertEqual(resolveNameConflict('My Project', existingNames), 'My Project (3)', 'Should resolve conflict with incremental number');
assertEqual(resolveNameConflict('Test Session', existingNames), 'Test Session (2)', 'Should start with (2) for first conflict');
console.log('✓ resolveNameConflict tests passed');

console.log('\n🎉 All name validation tests passed!');