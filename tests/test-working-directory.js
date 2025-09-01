// tests/test-working-directory.js
// Test working directory functionality for Claude sessions

import { TerminalManager } from '../src/lib/server/terminal.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Set up test environment
const TEST_PTY_ROOT = path.join(__dirname, 'test-working-dir');
process.env.PTY_ROOT = TEST_PTY_ROOT;

// Clean up test directory
function cleanup() {
  try {
    if (fs.existsSync(TEST_PTY_ROOT)) {
      fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('Cleanup warning:', err.message);
  }
}

console.log('Testing working directory functionality...\n');

try {
  cleanup();
  
  const terminalManager = new TerminalManager();
  const projectId = 'test-project';
  
  // Create a test project structure
  const projectDir = path.join(TEST_PTY_ROOT, projectId);
  fs.mkdirSync(projectDir, { recursive: true });
  
  // Create some test directories
  const subDir1 = path.join(projectDir, 'src');
  const subDir2 = path.join(projectDir, 'docs');
  const subDir3 = path.join(projectDir, 'src', 'components');
  
  fs.mkdirSync(subDir1, { recursive: true });
  fs.mkdirSync(subDir2, { recursive: true });
  fs.mkdirSync(subDir3, { recursive: true });
  
  // Create some test files
  fs.writeFileSync(path.join(projectDir, 'README.md'), '# Test Project');
  fs.writeFileSync(path.join(subDir1, 'main.js'), 'console.log("hello");');
  fs.writeFileSync(path.join(subDir2, 'guide.md'), '# Guide');
  
  console.log('✓ Created test project structure');
  
  // Test 1: List project directories
  console.log('\nTesting directory listing...');
  const rootDirectories = terminalManager.listProjectDirectories(projectId);
  
  assert(Array.isArray(rootDirectories), 'Should return an array');
  assert(rootDirectories.length >= 2, 'Should find at least src and docs directories');
  
  const srcDir = rootDirectories.find(d => d.name === 'src');
  const docsDir = rootDirectories.find(d => d.name === 'docs');
  
  assert(srcDir && srcDir.isDirectory, 'Should find src directory');
  assert(docsDir && docsDir.isDirectory, 'Should find docs directory');
  assertEqual(srcDir.path, 'src', 'Should have correct relative path for src');
  
  console.log('✓ Directory listing works correctly');
  
  // Test 2: List subdirectories
  console.log('\nTesting subdirectory listing...');
  const srcSubdirs = terminalManager.listProjectDirectories(projectId, 'src');
  
  assert(Array.isArray(srcSubdirs), 'Should return an array for subdirectories');
  const componentsDir = srcSubdirs.find(d => d.name === 'components');
  assert(componentsDir && componentsDir.isDirectory, 'Should find components subdirectory');
  assertEqual(componentsDir.path, 'src/components', 'Should have correct relative path for components');
  
  console.log('✓ Subdirectory listing works correctly');
  
  // Test 3: Security validation - prevent directory traversal
  console.log('\nTesting security validation...');
  let securityTestPassed = false;
  try {
    terminalManager.listProjectDirectories(projectId, '../../../etc');
    assert(false, 'Should have thrown error for directory traversal attempt');
  } catch (err) {
    assert(err.message.includes('Invalid path'), 'Should prevent directory traversal');
    securityTestPassed = true;
  }
  assert(securityTestPassed, 'Security validation should work');
  
  console.log('✓ Security validation prevents directory traversal');
  
  // Test 4: Create session with custom working directory
  console.log('\nTesting session creation with working directory...');
  const session1 = terminalManager.createSessionInProject(projectId, {
    mode: 'shell',
    cols: 80,
    rows: 24,
    name: 'Src Session',
    workingDirectory: 'src'
  });
  
  assert(session1.sessionId, 'Should return session ID');
  assert(session1.name === 'Src Session', 'Should return session name');
  assert(session1.pty, 'Should return PTY instance');
  console.log(`✓ Created session with working directory: ${session1.sessionId}`);
  
  // Test 5: Invalid working directory
  console.log('\nTesting invalid working directory handling...');
  let invalidDirTestPassed = false;
  try {
    terminalManager.createSessionInProject(projectId, {
      mode: 'shell',
      workingDirectory: 'nonexistent'
    });
    assert(false, 'Should have thrown error for nonexistent directory');
  } catch (err) {
    assert(err.message.includes('does not exist'), 'Should reject nonexistent directory');
    invalidDirTestPassed = true;
  }
  assert(invalidDirTestPassed, 'Should handle invalid working directory');
  
  console.log('✓ Invalid working directory properly rejected');
  
  // Test 6: Security test for session creation
  console.log('\nTesting session creation security validation...');
  let sessionSecurityTestPassed = false;
  try {
    terminalManager.createSessionInProject(projectId, {
      mode: 'shell',
      workingDirectory: '../../../etc'
    });
    assert(false, 'Should have thrown error for directory traversal in session creation');
  } catch (err) {
    assert(err.message.includes('Invalid working directory'), 'Should prevent directory traversal in session creation');
    sessionSecurityTestPassed = true;
  }
  assert(sessionSecurityTestPassed, 'Session creation security validation should work');
  
  console.log('✓ Session creation security validation works');
  
  // Cleanup
  console.log('\nCleaning up...');
  terminalManager.endSession(session1.sessionId);
  cleanup();
  console.log('✓ Cleanup completed');
  
  console.log('\n🎉 All working directory tests passed!');
  
} catch (err) {
  console.error('❌ Test failed:', err.message);
  console.error(err.stack);
  cleanup();
  process.exit(1);
}