// tests/run-session-store-tests.js
// Test enhanced session storage with custom names
import { addSession, endSession, getSessions, updateSessionName, getAllSessionNames } from '../src/lib/server/session-store.js';
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
const TEST_PTY_ROOT = path.join(__dirname, 'test-sessions');
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
}

function teardownTest() {
  cleanupTestDir();
}

console.log('Running enhanced session storage tests...\n');

try {
  setupTest();

  // Test addSession with custom name
  console.log('Testing addSession with custom name...');
  const session1 = {
    id: 'test-session-1',
    name: 'My Custom Session',
    host: 'local',
    port: '0',
    username: 'user'
  };
  
  addSession(session1);
  const sessions = getSessions();
  
  // Find our session in the list
  const ourSession = sessions.sessions.find(s => s.id === 'test-session-1');
  assert(ourSession, 'Should find our session');
  assertEqual(ourSession.name, 'My Custom Session', 'Should store custom name');
  console.log('✓ addSession with custom name works');

  // Test getAllSessionNames
  console.log('Testing getAllSessionNames...');
  const session2 = {
    id: 'test-session-2', 
    name: 'Another Session',
    host: 'local',
    port: '0', 
    username: 'user'
  };
  addSession(session2);
  
  const allNames = getAllSessionNames();
  assert(allNames.includes('My Custom Session'), 'Should include first session name');
  assert(allNames.includes('Another Session'), 'Should include second session name');
  assert(allNames.length >= 2, 'Should have at least 2 session names');
  console.log('✓ getAllSessionNames works');

  // Test updateSessionName
  console.log('Testing updateSessionName...');
  updateSessionName('test-session-1', 'Updated Session Name');
  const updatedSessions = getSessions();
  const updatedSession = updatedSessions.sessions.find(s => s.id === 'test-session-1');
  assertEqual(updatedSession.name, 'Updated Session Name', 'Should update session name');
  console.log('✓ updateSessionName works');

  // Test updateSessionName with non-existent session
  console.log('Testing updateSessionName with invalid session...');
  try {
    updateSessionName('non-existent-session', 'New Name');
    assert(false, 'Should throw error for non-existent session');
  } catch (err) {
    assert(err.message.includes('Session not found'), 'Should throw appropriate error');
  }
  console.log('✓ updateSessionName error handling works');

  // Test endSession cleanup
  console.log('Testing endSession...');
  endSession('test-session-1');
  const finalSessions = getSessions();
  assert(!finalSessions.sessions.find(s => s.id === 'test-session-1'), 'Should remove session');
  assert(finalSessions.sessions.find(s => s.id === 'test-session-2'), 'Should keep other session');
  console.log('✓ endSession cleanup works');

  console.log('\n🎉 All session storage tests passed!');

} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
} finally {
  teardownTest();
}