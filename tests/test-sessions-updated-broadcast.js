// tests/test-sessions-updated-broadcast.js
// Test that sessions-updated broadcasts include session names
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
const TEST_PTY_ROOT = path.join(__dirname, 'test-broadcast');
const TEST_PORT = 3033;
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

console.log('Testing sessions-updated broadcast with names...\n');

let httpServer, io, client1, client2;

async function runTests() {
  try {
    cleanup();
    
    // Start test server
    console.log('Starting test server...');
    const server = await createTestServer();
    httpServer = server.httpServer;
    io = server.io;
    
    // Create two clients to test broadcasts
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
    
    // Test 1: Verify sessions-updated broadcast on session creation
    console.log('Testing sessions-updated broadcast on session creation...');
    
    let sessionsUpdateReceived = false;
    let broadcastData = null;
    
    // Client2 listens for sessions-updated broadcast
    client2.on('sessions-updated', (data) => {
      sessionsUpdateReceived = true;
      broadcastData = data;
    });
    
    // Client1 creates a session
    const createResponse = await new Promise((resolve, reject) => {
      client1.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: 'Broadcast Test Session'
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    // Wait a moment for the broadcast
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert(sessionsUpdateReceived, 'Should receive sessions-updated broadcast');
    assert(broadcastData, 'Should receive broadcast data');
    assert(Array.isArray(broadcastData.sessions), 'Should have sessions array');
    
    // Find our session in the broadcast
    const ourSession = broadcastData.sessions.find(s => s.id === createResponse.sessionId);
    assert(ourSession, 'Should find our session in broadcast');
    assert(ourSession.name === 'Broadcast Test Session', 'Session should have correct name in broadcast');
    console.log(`✓ Session "${ourSession.name}" found in broadcast`);
    
    // Test 2: Verify sessions-updated broadcast on session rename
    console.log('Testing sessions-updated broadcast on session rename...');
    
    sessionsUpdateReceived = false;
    broadcastData = null;
    
    // Rename the session
    await new Promise((resolve, reject) => {
      client1.emit('rename', {
        sessionId: createResponse.sessionId,
        newName: 'Renamed Broadcast Session'
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Rename failed'));
        }
      });
    });
    
    // Wait a moment for the broadcast
    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert(sessionsUpdateReceived, 'Should receive sessions-updated broadcast on rename');
    assert(broadcastData, 'Should receive rename broadcast data');
    
    // Find the renamed session
    const renamedSession = broadcastData.sessions.find(s => s.id === createResponse.sessionId);
    assert(renamedSession, 'Should find renamed session in broadcast');
    assert(renamedSession.name === 'Renamed Broadcast Session', 'Session should have new name in broadcast');
    console.log(`✓ Session renamed to "${renamedSession.name}" in broadcast`);
    
    // Test 3: Verify broadcast contains required fields
    console.log('Testing broadcast data format...');
    
    renamedSession && (() => {
      assert(renamedSession.id, 'Session should have ID');
      assert(renamedSession.name, 'Session should have name');
      assert(typeof renamedSession.name === 'string', 'Session name should be string');
      assert(renamedSession.host, 'Session should have host');
      assert(renamedSession.port, 'Session should have port');
      assert(renamedSession.username, 'Session should have username');
    })();
    
    console.log('✓ Broadcast data format is correct');
    
    console.log('\n🎉 All sessions-updated broadcast tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
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