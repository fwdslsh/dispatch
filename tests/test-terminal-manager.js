// tests/test-terminal-manager.js
// Quick test to verify TerminalManager integration with session naming
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

// Set up test environment
const TEST_PTY_ROOT = path.join(__dirname, 'test-terminal');
process.env.PTY_ROOT = TEST_PTY_ROOT;

// Clean up test directory
function cleanup() {
  if (fs.existsSync(TEST_PTY_ROOT)) {
    fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });
  }
}

console.log('Testing TerminalManager session naming integration...\n');

try {
  cleanup();
  
  const terminalManager = new TerminalManager();
  
  console.log('Testing session creation with custom name...');
  const session1 = terminalManager.createSession({
    mode: 'shell',
    cols: 80,
    rows: 24,
    name: 'My Test Session'
  });
  
  assert(session1.sessionId, 'Should return session ID');
  assert(session1.name === 'My Test Session', 'Should return session name');
  assert(session1.pty, 'Should return PTY instance');
  console.log(`✓ Created session: ${session1.sessionId} named "${session1.name}"`);
  
  console.log('Testing session creation without custom name...');
  const session2 = terminalManager.createSession({
    mode: 'shell',
    cols: 80,
    rows: 24
  });
  
  assert(session2.sessionId, 'Should return session ID');
  assert(session2.name.includes('Session'), 'Should generate fallback name');
  console.log(`✓ Created session: ${session2.sessionId} named "${session2.name}"`);
  
  console.log('Testing session metadata...');
  const metadata1 = terminalManager.getSessionMetadata(session1.sessionId);
  assert(metadata1, 'Should return metadata');
  assert(metadata1.name === 'My Test Session', 'Should store correct name');
  assert(metadata1.symlinkName, 'Should have symlink name');
  console.log(`✓ Session metadata: name="${metadata1.name}", symlink="${metadata1.symlinkName}"`);
  
  console.log('Testing symlink creation...');
  const byNamePath = path.join(TEST_PTY_ROOT, 'by-name');
  assert(fs.existsSync(byNamePath), 'Should create by-name directory');
  
  const symlinkPath = path.join(byNamePath, metadata1.symlinkName);
  assert(fs.existsSync(symlinkPath), 'Should create symlink');
  
  const stats = fs.lstatSync(symlinkPath);
  assert(stats.isSymbolicLink(), 'Should be a symbolic link');
  console.log('✓ Symlink created successfully');
  
  console.log('Testing session renaming...');
  const newName = terminalManager.renameSession(session1.sessionId, 'Renamed Session');
  // Since resolveNameConflict might add suffix for conflicts, check it starts with our desired name
  assert(newName.startsWith('Renamed Session'), 'Should return new name (possibly with conflict resolution)');
  
  const updatedMetadata = terminalManager.getSessionMetadata(session1.sessionId);
  assert(updatedMetadata.name === newName, 'Should update metadata with resolved name');
  console.log(`✓ Session renamed to "${newName}"`);
  
  console.log('Testing session cleanup...');
  terminalManager.endSession(session1.sessionId);
  terminalManager.endSession(session2.sessionId);
  
  // Give a moment for cleanup
  setTimeout(() => {
    const finalMetadata = terminalManager.getSessionMetadata(session1.sessionId);
    assert(!finalMetadata, 'Should clean up metadata');
    console.log('✓ Session cleanup successful');
    
    console.log('\n🎉 All TerminalManager integration tests passed!');
    cleanup();
  }, 100);
  
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error.stack);
  cleanup();
  process.exit(1);
}
