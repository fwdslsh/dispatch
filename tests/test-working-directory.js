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
  
  // Create a proper test project through DirectoryManager
  const projectInfo = await terminalManager.directoryManager.createProject('test-project', {
    displayName: 'Test Project',
    description: 'A test project for working directory functionality'
  });
  
  const projectId = projectInfo.id;
  const projectDir = projectInfo.path;
  
  // Create some test directories in the workspace
  const srcDir = path.join(projectDir, 'workspace', 'src');
  const docsDir = path.join(projectDir, 'workspace', 'docs');
  const componentsDir = path.join(srcDir, 'components');
  
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(componentsDir, { recursive: true });
  
  // Create some test files
  fs.writeFileSync(path.join(projectDir, 'workspace', 'README.md'), '# Test Project');
  fs.writeFileSync(path.join(srcDir, 'main.js'), 'console.log("hello");');
  fs.writeFileSync(path.join(docsDir, 'guide.md'), '# Guide');
  
  console.log('✓ Created test project structure');
  
  // Test 1: List project directories
  console.log('\nTesting directory listing...');
  const rootDirectories = await terminalManager.listProjectDirectories(projectId);
  
  assert(Array.isArray(rootDirectories), 'Should return an array');
  assert(rootDirectories.length >= 1, 'Should find at least workspace directory');
  
  const workspaceDir = rootDirectories.find(d => d.name === 'workspace');
  assert(workspaceDir && workspaceDir.isDirectory, 'Should find workspace directory');
  
  console.log('✓ Directory listing returns correct structure');
  
  // Test 2: List subdirectories in workspace
  console.log('\nTesting subdirectory listing...');
  const workspaceContents = await terminalManager.listProjectDirectories(projectId, 'workspace');
  
  assert(Array.isArray(workspaceContents), 'Should return an array for workspace contents');
  
  const srcSubDir = workspaceContents.find(d => d.name === 'src');
  const docsSubDir = workspaceContents.find(d => d.name === 'docs');
  
  assert(srcSubDir && srcSubDir.isDirectory, 'Should find src directory in workspace');
  assert(docsSubDir && docsSubDir.isDirectory, 'Should find docs directory in workspace');
  assertEqual(srcSubDir.path, 'workspace/src', 'Should have correct relative path for src');
  
  console.log('✓ Subdirectory listing works correctly');
  
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