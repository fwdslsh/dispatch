// tests/test-session-creation-form.js
// Test session creation form with name input field
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { handleConnection } from '../src/lib/server/socket-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Set up test environment
const TEST_PTY_ROOT = path.join(__dirname, `test-form-${Date.now()}`);
const TEST_PORT = 3035;
process.env.PTY_ROOT = TEST_PTY_ROOT;
process.env.TERMINAL_KEY = 'test-key';
process.env.PTY_MODE = 'shell';

// Clean up test directory
function cleanup() {
  if (fs.existsSync(TEST_PTY_ROOT)) {
    fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });
  }
}

// Helper to create test server
function createTestServer() {
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });
  
  io.on('connection', handleConnection);
  
  return new Promise((resolve) => {
    httpServer.listen(TEST_PORT, () => {
      resolve({ httpServer, io });
    });
  });
}

// Helper to create test client
function createTestClient() {
  return SocketIOClient(`http://localhost:${TEST_PORT}`);
}

// Helper to authenticate client
function authenticateClient(client) {
  return new Promise((resolve, reject) => {
    client.emit('auth', 'test-key', (response) => {
      if (response.ok) {
        resolve(response);
      } else {
        reject(new Error(response.error || 'Auth failed'));
      }
    });
  });
}

console.log('🧪 Testing session creation form functionality...\\n');

let httpServer, io, client;

async function runTests() {
  try {
    cleanup();
    
    // Start test server
    console.log('Starting test server...');
    const server = await createTestServer();
    httpServer = server.httpServer;
    io = server.io;
    
    client = createTestClient();
    
    await new Promise((resolve) => {
      client.on('connect', resolve);
    });
    
    await authenticateClient(client);
    console.log('✅ Test server started and client connected\\n');
    
    // Test 1: Session creation with custom name via Socket.IO API
    console.log('🔧 Test 1: Session creation with custom name');
    const sessionWithName = await new Promise((resolve, reject) => {
      client.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: 'Frontend Test Session'
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(sessionWithName.sessionId, 'Should return session ID');
    assert(sessionWithName.name.startsWith('Frontend Test Session'), 'Should return custom name or resolved conflict');
    console.log(`   ✓ Created session with custom name: "${sessionWithName.name}"\\n`);
    
    // Test 2: Session creation without name (fallback)
    console.log('🔧 Test 2: Session creation with fallback name');
    const sessionWithFallback = await new Promise((resolve, reject) => {
      client.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24
        // No name provided
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(sessionWithFallback.sessionId, 'Should return session ID for fallback');
    assert(sessionWithFallback.name.startsWith('Session '), 'Should generate fallback name');
    console.log(`   ✓ Created session with fallback name: "${sessionWithFallback.name}"\\n`);
    
    // Test 3: Empty name should fall back to generated name
    console.log('🔧 Test 3: Empty name fallback');
    const sessionWithEmptyName = await new Promise((resolve, reject) => {
      client.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: ''
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(sessionWithEmptyName.sessionId, 'Should create session even with empty name');
    assert(sessionWithEmptyName.name.startsWith('Session '), 'Should fall back to generated name for empty string');
    console.log(`   ✓ Empty name fell back to: "${sessionWithEmptyName.name}"\\n`);
    
    // Test 4: Name validation - too long name should be truncated/fallback
    console.log('🔧 Test 4: Long name handling');
    const longName = 'a'.repeat(60); // Longer than 50 character limit
    const sessionWithLongName = await new Promise((resolve, reject) => {
      client.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: longName
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(sessionWithLongName.sessionId, 'Should create session even with too long name');
    assert(sessionWithLongName.name.startsWith('Session '), 'Should fall back to generated name for invalid long name');
    console.log(`   ✓ Long name fell back to: "${sessionWithLongName.name}"\\n`);
    
    // Test 5: Name conflict resolution
    console.log('🔧 Test 5: Name conflict resolution');
    const conflictSession = await new Promise((resolve, reject) => {
      client.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: 'Frontend Test Session' // Same as first session
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(conflictSession.sessionId, 'Should create session with conflicting name');
    assert(conflictSession.name.startsWith('Frontend Test Session') && conflictSession.name.includes('('), 'Should resolve conflict with suffix');
    console.log(`   ✓ Name conflict resolved: "${conflictSession.name}"\\n`);
    
    // Test 6: Special characters in name (only valid ones)
    console.log('🔧 Test 6: Valid special characters handling');
    const specialSession = await new Promise((resolve, reject) => {
      client.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: 'Test-Session_123'
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(specialSession.sessionId, 'Should create session with valid special characters');
    assert(specialSession.name.startsWith('Test-Session_123'), 'Should preserve valid special characters (possibly with conflict suffix)');
    console.log(`   ✓ Special characters preserved: "${specialSession.name}"\\n`);
    
    // Test 7: Verify sessions list includes all created sessions with names
    console.log('🔧 Test 7: Verify sessions list includes names');
    const sessionsList = await new Promise((resolve, reject) => {
      client.emit('list', (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'List failed'));
        }
      });
    });
    
    assert(Array.isArray(sessionsList.sessions), 'Should return sessions array');
    assert(sessionsList.sessions.length >= 6, 'Should have all created sessions'); // We created 6 sessions
    
    // Verify all sessions have names
    const sessionNames = sessionsList.sessions.map(s => s.name);
    const hasCustomName = sessionNames.some(name => name.startsWith('Frontend Test Session'));
    const hasConflictResolved = sessionNames.some(name => name.startsWith('Frontend Test Session ('));
    const hasSpecialChars = sessionNames.some(name => name.startsWith('Test-Session_123'));
    const hasFallbackNames = sessionNames.some(name => name.startsWith('Session '));
    
    assert(hasCustomName, 'Should include custom name (possibly with conflict suffix)');
    assert(hasConflictResolved, 'Should include conflict-resolved name');
    assert(hasSpecialChars, 'Should include special character name');
    assert(hasFallbackNames, 'Should include fallback names');
    
    console.log(`   ✓ All ${sessionsList.sessions.length} sessions have proper names\\n`);
    
    console.log('🎉 All session creation form tests passed!\\n');
    
    // Summary
    console.log('📊 Test Summary:');
    console.log('   ✅ Custom name session creation');
    console.log('   ✅ Fallback name generation');
    console.log('   ✅ Empty name fallback handling');
    console.log('   ✅ Long name validation');
    console.log('   ✅ Name conflict resolution');
    console.log('   ✅ Special character preservation');
    console.log('   ✅ Session list name verification\\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    // Cleanup
    if (client && client.connected) client.disconnect();
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
    }
    cleanup();
  }
}

runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});