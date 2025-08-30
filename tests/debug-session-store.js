// tests/debug-session-store.js
import { addSession, getSessions } from '../src/lib/server/session-store.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PTY_ROOT = path.join(__dirname, 'debug-sessions');
process.env.PTY_ROOT = TEST_PTY_ROOT;

// Clean up and setup
if (fs.existsSync(TEST_PTY_ROOT)) {
  fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });
}

console.log('Testing basic session functionality...');

try {
  const session = {
    id: 'test-session-1',
    name: 'My Custom Session',
    host: 'local',
    port: '0',
    username: 'user'
  };
  
  console.log('Adding session:', session);
  addSession(session);
  
  const sessions = getSessions();
  console.log('Retrieved sessions:', JSON.stringify(sessions, null, 2));
  
} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
} finally {
  // Cleanup
  if (fs.existsSync(TEST_PTY_ROOT)) {
    fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });
  }
}