// tests/run-socket-io-rename-tests.js  
// Test Socket.IO rename event functionality
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

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}. Expected: ${expected}, Actual: ${actual}`);
  }
}

// Set up test environment
const TEST_PTY_ROOT = path.join(__dirname, 'test-rename');
const TEST_PORT = 3032;
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

// Helper to create a session
function createSession(client, name) {
  return new Promise((resolve, reject) => {
    client.emit('create', {
      mode: 'shell',
      cols: 80,
      rows: 24,
      name: name
    }, (response) => {
      if (response.ok) {
        resolve(response);
      } else {
        reject(new Error(response.error || 'Create failed'));
      }
    });
  });
}

console.log('Running Socket.IO rename event tests...\n');

let httpServer, io, client;

async function runTests() {
  try {
    cleanup();
    
    // Start test server
    console.log('Starting test server...');
    const server = await createTestServer();
    httpServer = server.httpServer;
    io = server.io;
    
    // Test 1: Basic rename functionality
    console.log('Testing basic rename functionality...');
    client = SocketIOClient(`http://localhost:${TEST_PORT}`);
    
    await new Promise((resolve) => {
      client.on('connect', resolve);
    });
    
    await authenticateClient(client);
    
    // Create a session to rename
    const session = await createSession(client, 'Original Name');
    console.log(`Created session: ${session.sessionId} named "${session.name}"`);
    
    // Rename the session
    const renameResponse = await new Promise((resolve, reject) => {
      client.emit('rename', {
        sessionId: session.sessionId,
        newName: 'Renamed Session'
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Rename failed'));
        }
      });
    });
    
    assert(renameResponse.success, 'Rename should succeed');
    assertEqual(renameResponse.sessionId, session.sessionId, 'Should return same session ID');
    assertEqual(renameResponse.oldName, 'Original Name', 'Should return old name');
    assertEqual(renameResponse.newName, 'Renamed Session', 'Should return new name');
    console.log(`✓ Renamed session from "${renameResponse.oldName}" to "${renameResponse.newName}"`);
    
    client.disconnect();
    
    // Test 2: Rename with invalid name
    console.log('Testing rename with invalid name...');
    client = SocketIOClient(`http://localhost:${TEST_PORT}`);
    
    await new Promise((resolve) => {
      client.on('connect', resolve);
    });
    
    await authenticateClient(client);
    
    // Create a session to rename
    const session2 = await createSession(client, 'Test Session');
    
    // Try to rename with invalid name
    try {
      await new Promise((resolve, reject) => {
        client.emit('rename', {
          sessionId: session2.sessionId,
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
      console.log(`✓ Correctly rejected invalid name: ${err.message}`);
    }
    
    client.disconnect();
    
    // Test 3: Rename non-existent session
    console.log('Testing rename of non-existent session...');
    client = SocketIOClient(`http://localhost:${TEST_PORT}`);
    
    await new Promise((resolve) => {
      client.on('connect', resolve);
    });
    
    await authenticateClient(client);
    
    // Try to rename non-existent session
    try {
      await new Promise((resolve, reject) => {
        client.emit('rename', {
          sessionId: 'non-existent-session-id',
          newName: 'New Name'
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
      console.log(`✓ Correctly rejected non-existent session: ${err.message}`);
    }
    
    client.disconnect();
    
    // Test 4: Name conflict resolution
    console.log('Testing name conflict resolution...');
    client = SocketIOClient(`http://localhost:${TEST_PORT}`);
    
    await new Promise((resolve) => {
      client.on('connect', resolve);
    });
    
    await authenticateClient(client);
    
    // Create two sessions
    const sessionA = await createSession(client, 'Session A');
    const sessionB = await createSession(client, 'Session B');
    
    // Try to rename sessionB to same name as sessionA
    const conflictResponse = await new Promise((resolve, reject) => {
      client.emit('rename', {
        sessionId: sessionB.sessionId,
        newName: 'Session A'
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Rename failed'));
        }
      });
    });
    
    assert(conflictResponse.success, 'Should handle name conflict');
    assertEqual(conflictResponse.newName, 'Session A (2)', 'Should resolve conflict with suffix');
    console.log(`✓ Conflict resolved: "${conflictResponse.newName}"`);
    
    client.disconnect();
    
    console.log('\n🎉 All Socket.IO rename event tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
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