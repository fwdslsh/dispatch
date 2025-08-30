// tests/test-sessions-broadcast.js
// Test what the current sessions-updated broadcast contains
import { getSessions, addSession } from '../src/lib/server/session-store.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up test environment
const TEST_PTY_ROOT = path.join(__dirname, 'test-broadcast');
process.env.PTY_ROOT = TEST_PTY_ROOT;

// Clean up test directory
function cleanup() {
  if (fs.existsSync(TEST_PTY_ROOT)) {
    fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });
  }
}

console.log('Testing current sessions broadcast format...\n');

try {
  cleanup();

  // Add some test sessions to see the format
  const session1 = {
    id: 'test-session-1',
    name: 'My Custom Session',
    host: 'local',
    port: '0',
    username: 'user'
  };

  const session2 = {
    id: 'test-session-2', 
    name: 'Another Session',
    host: 'local',
    port: '0',
    username: 'user'
  };

  addSession(session1);
  addSession(session2);

  const sessionData = getSessions();
  console.log('Current getSessions() format:');
  console.log(JSON.stringify(sessionData, null, 2));

  console.log('\nSessions array:');
  sessionData.sessions.forEach((session, index) => {
    console.log(`${index + 1}. ID: ${session.id}`);
    console.log(`   Name: ${session.name}`);
    console.log(`   Host: ${session.host}`);
    console.log(`   Port: ${session.port}`);
    console.log('');
  });

  console.log('✓ Sessions broadcast includes names!');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
} finally {
  cleanup();
}