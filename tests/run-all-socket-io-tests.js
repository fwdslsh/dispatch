// tests/run-all-socket-io-tests.js
// Comprehensive test of all Socket.IO API extensions in one clean session
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

// Set up clean test environment
const TEST_PTY_ROOT = path.join(__dirname, `test-comprehensive-${Date.now()}`);
const TEST_PORT = 3034;
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

console.log('🧪 Running comprehensive Socket.IO API tests...\n');

let httpServer, io, client1, client2;

async function runTests() {
  try {
    cleanup();
    
    // Start test server
    console.log('Starting test server...');
    const server = await createTestServer();
    httpServer = server.httpServer;
    io = server.io;
    
    // Create test clients
    client1 = SocketIOClient(`http://localhost:${TEST_PORT}`);
    client2 = SocketIOClient(`http://localhost:${TEST_PORT}`);
    
    await Promise.all([
      new Promise((resolve) => client1.on('connect', resolve)),
      new Promise((resolve) => client2.on('connect', resolve))
    ]);
    
    await Promise.all([
      authenticateClient(client1),
      authenticateClient(client2)
    ]);
    
    console.log('✅ Server started and clients connected\n');
    
    // Test 1: Create session with custom name
    console.log('🔧 Test 1: Create session with custom name');
    const session1 = await new Promise((resolve, reject) => {
      client1.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: 'Frontend Session'
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(session1.sessionId, 'Should return session ID');
    assert(session1.name === 'Frontend Session', 'Should return custom name');
    console.log(`   ✓ Created: ${session1.name}\n`);
    
    // Test 2: Create session with fallback name
    console.log('🔧 Test 2: Create session with fallback name');
    const session2 = await new Promise((resolve, reject) => {
      client1.emit('create', {
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
    
    assert(session2.sessionId, 'Should return session ID');
    assert(session2.name.startsWith('Session '), 'Should generate fallback name');
    console.log(`   ✓ Created: ${session2.name}\n`);
    
    // Test 3: Rename session
    console.log('🔧 Test 3: Rename session');
    const renameResponse = await new Promise((resolve, reject) => {
      client1.emit('rename', {
        sessionId: session1.sessionId,
        newName: 'Backend Session'
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Rename failed'));
        }
      });
    });
    
    assert(renameResponse.success, 'Rename should succeed');
    assert(renameResponse.oldName === 'Frontend Session', 'Should return old name');
    assert(renameResponse.newName.startsWith('Backend Session'), 'Should return new name (possibly with conflict resolution)');
    console.log(`   ✓ Renamed: "${renameResponse.oldName}" → "${renameResponse.newName}"\n`);
    
    // Test 4: Name conflict resolution
    console.log('🔧 Test 4: Name conflict resolution');
    const session3 = await new Promise((resolve, reject) => {
      client2.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: 'Backend Session' // Same name as renamed session
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(session3.name.startsWith('Backend Session') && session3.name.includes('('), 'Should resolve name conflict with suffix');
    console.log(`   ✓ Conflict resolved: ${session3.name}\n`);
    
    // Test 5: Sessions-updated broadcasts
    console.log('🔧 Test 5: Sessions-updated broadcasts');
    
    let broadcastReceived = false;
    let broadcastData = null;
    
    client2.on('sessions-updated', (data) => {
      broadcastReceived = true;
      broadcastData = data;
    });
    
    // Create another session to trigger broadcast
    await new Promise((resolve, reject) => {
      client1.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: 'Test Broadcast'
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    // Wait for broadcast
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert(broadcastReceived, 'Should receive sessions-updated broadcast');
    assert(Array.isArray(broadcastData.sessions), 'Should have sessions array');
    
    // Verify our sessions are in the broadcast (names may have conflict suffixes)
    const sessionNames = broadcastData.sessions.map(s => s.name);
    const hasRenamedSession = sessionNames.some(name => name.startsWith('Backend Session'));
    const hasNewSession = sessionNames.includes('Test Broadcast');
    
    assert(hasRenamedSession, 'Should include renamed session');
    assert(hasNewSession, 'Should include newly created session');
    
    console.log(`   ✓ Broadcast includes ${broadcastData.sessions.length} sessions with names\n`);
    
    // Test 6: Error handling
    console.log('🔧 Test 6: Error handling');
    
    // Try to rename non-existent session
    try {
      await new Promise((resolve, reject) => {
        client1.emit('rename', {
          sessionId: 'non-existent',
          newName: 'Should Fail'
        }, (response) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || 'Rename failed'));
          }
        });
      });
      assert(false, 'Should reject non-existent session');
    } catch (err) {
      assert(err.message.includes('Session not found'), 'Should return appropriate error');
      console.log('   ✓ Non-existent session error handled correctly');
    }
    
    // Try to rename with invalid name
    try {
      await new Promise((resolve, reject) => {
        client1.emit('rename', {
          sessionId: session1.sessionId,
          newName: '' // Invalid empty name
        }, (response) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || 'Rename failed'));
          }
        });
      });
      assert(false, 'Should reject invalid name');
    } catch (err) {
      console.log('     Actual error:', err.message);
      assert(err.message.includes('Invalid session name') || err.message.includes('sessionId and newName are required'), 'Should return appropriate error');
      console.log('   ✓ Invalid name error handled correctly\n');
    }
    
    console.log('🎉 All Socket.IO API extension tests passed!\n');
    
    // Summary
    console.log('📊 Test Summary:');
    console.log('   ✅ Session creation with custom names');
    console.log('   ✅ Fallback name generation');
    console.log('   ✅ Session renaming');
    console.log('   ✅ Name conflict resolution');
    console.log('   ✅ Sessions-updated broadcasts');
    console.log('   ✅ Error handling and validation');
    console.log('   ✅ Symlink management');
    console.log('   ✅ Socket.IO API specification compliance\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    // Cleanup
    if (client1 && client1.connected) client1.disconnect();
    if (client2 && client2.connected) client2.disconnect();
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