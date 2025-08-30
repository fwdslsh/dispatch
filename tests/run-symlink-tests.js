// tests/run-symlink-tests.js
// Test symlink management for named sessions
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSymlink, removeSymlink, cleanupOrphanedSymlinks, getByNamePath } from '../src/lib/server/symlink-manager.js';

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
const TEST_PTY_ROOT = path.join(__dirname, 'test-symlinks');
process.env.PTY_ROOT = TEST_PTY_ROOT;

// Clean up test directory
function cleanupTestDir() {
  if (fs.existsSync(TEST_PTY_ROOT)) {
    fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });
  }
}

// Setup and cleanup
function setupTest() {
  cleanupTestDir();
  fs.mkdirSync(TEST_PTY_ROOT, { recursive: true });
  
  // Create some test session directories
  const sessionDirs = [
    'session-uuid-1',
    'session-uuid-2', 
    'session-uuid-3'
  ];
  
  for (const dir of sessionDirs) {
    fs.mkdirSync(path.join(TEST_PTY_ROOT, dir), { recursive: true });
    // Create a test file to verify the directory exists
    fs.writeFileSync(path.join(TEST_PTY_ROOT, dir, 'test.txt'), 'test content');
  }
}

function teardownTest() {
  cleanupTestDir();
}

console.log('Running symlink management tests...\n');

try {
  setupTest();

  // Test getByNamePath  
  console.log('Testing getByNamePath...');
  const byNamePath = getByNamePath();
  assertEqual(byNamePath, path.join(TEST_PTY_ROOT, 'by-name'), 'Should return correct by-name path');
  console.log('✓ getByNamePath works');

  // Test createSymlink
  console.log('Testing createSymlink...');
  const sessionUuid = 'session-uuid-1';
  const sessionName = 'My Test Session';
  
  createSymlink(sessionUuid, sessionName);
  
  // Check if by-name directory was created
  assert(fs.existsSync(byNamePath), 'Should create by-name directory');
  
  // Check if symlink was created
  const symlinkPath = path.join(byNamePath, 'my-test-session');
  assert(fs.existsSync(symlinkPath), 'Should create symlink');
  
  // Verify symlink points to correct directory
  const stats = fs.lstatSync(symlinkPath);
  assert(stats.isSymbolicLink(), 'Should be a symbolic link');
  
  const linkTarget = fs.readlinkSync(symlinkPath);
  const expectedTarget = path.join('..', sessionUuid);
  assertEqual(linkTarget, expectedTarget, 'Should link to correct target');
  
  // Verify we can access the target through the symlink
  const testFilePath = path.join(symlinkPath, 'test.txt');
  assert(fs.existsSync(testFilePath), 'Should be able to access target through symlink');
  assertEqual(fs.readFileSync(testFilePath, 'utf-8'), 'test content', 'Should read correct content through symlink');
  console.log('✓ createSymlink works');

  // Test createSymlink with conflicting name
  console.log('Testing createSymlink with name conflict...');
  const sessionUuid2 = 'session-uuid-2';
  const conflictingName = 'My Test Session'; // Same name as before
  
  createSymlink(sessionUuid2, conflictingName);
  
  // Should create symlink with incremental suffix
  const conflictSymlinkPath = path.join(byNamePath, 'my-test-session-2');
  assert(fs.existsSync(conflictSymlinkPath), 'Should create symlink with suffix for conflict');
  
  const conflictLinkTarget = fs.readlinkSync(conflictSymlinkPath);
  const expectedConflictTarget = path.join('..', sessionUuid2);
  assertEqual(conflictLinkTarget, expectedConflictTarget, 'Conflict symlink should point to correct target');
  console.log('✓ createSymlink conflict resolution works');

  // Test removeSymlink
  console.log('Testing removeSymlink...');
  removeSymlink('My Test Session');
  
  assert(!fs.existsSync(symlinkPath), 'Should remove original symlink');
  assert(fs.existsSync(conflictSymlinkPath), 'Should not affect other symlinks');
  
  // Original session directory should still exist
  const originalSessionPath = path.join(TEST_PTY_ROOT, sessionUuid);
  assert(fs.existsSync(originalSessionPath), 'Should not remove original session directory');
  console.log('✓ removeSymlink works');

  // Test cleanupOrphanedSymlinks
  console.log('Testing cleanupOrphanedSymlinks...');
  
  // Create symlink pointing to non-existent directory
  const orphanSymlinkPath = path.join(byNamePath, 'orphaned-session');
  const orphanTarget = path.join('..', 'non-existent-session');
  fs.symlinkSync(orphanTarget, orphanSymlinkPath);
  
  // Check that the symlink itself exists (not its target)
  let orphanSymlinkExists = false;
  try {
    const stats = fs.lstatSync(orphanSymlinkPath);
    orphanSymlinkExists = stats.isSymbolicLink();
  } catch {}
  assert(orphanSymlinkExists, 'Orphaned symlink should exist before cleanup');
  
  cleanupOrphanedSymlinks();
  
  // Check that orphaned symlink was removed
  let orphanStillExists = false;
  try {
    const stats = fs.lstatSync(orphanSymlinkPath);
    orphanStillExists = stats.isSymbolicLink();
  } catch {}
  assert(!orphanStillExists, 'Should remove orphaned symlink');
  assert(fs.existsSync(conflictSymlinkPath), 'Should keep valid symlinks');
  console.log('✓ cleanupOrphanedSymlinks works');

  // Test createSymlink with special characters
  console.log('Testing createSymlink with special characters...');
  const sessionUuid3 = 'session-uuid-3';
  const specialName = 'My/Special\\Session*Name!';
  
  createSymlink(sessionUuid3, specialName);
  
  // Should sanitize name for filesystem
  const sanitizedSymlinkPath = path.join(byNamePath, 'my-special-session-name');
  assert(fs.existsSync(sanitizedSymlinkPath), 'Should create symlink with sanitized name');
  console.log('✓ createSymlink sanitization works');

  console.log('\n🎉 All symlink management tests passed!');

} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  teardownTest();
}