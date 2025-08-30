// tests/run-socket-io-tests.js  
// Test Socket.IO API extensions for session naming
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
const TEST_PTY_ROOT = path.join(__dirname, `test-socket-${Date.now()}`);
const TEST_PORT = 3031;
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

console.log('Running Socket.IO API extension tests...\n');

let httpServer, io, client;

async function runTests() {
  try {
    cleanup();
    
    // Start test server
    console.log('Starting test server...');
    const server = await createTestServer();
    httpServer = server.httpServer;
    io = server.io;
    
    // Test 1: Extended create event with custom name
    console.log('Testing extended create event with custom name...');
    client = createTestClient();
    
    await new Promise((resolve) => {
      client.on('connect', resolve);
    });
    
    await authenticateClient(client);
    
    const createResponse = await new Promise((resolve, reject) => {
      client.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: 'My Custom Session'
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(createResponse.sessionId, 'Should return session ID');
    assert(createResponse.name, 'Should return session name');
    // Name might be "My Custom Session" or "My Custom Session (2)" etc. due to conflict resolution
    assert(createResponse.name.startsWith('My Custom Session'), 'Should return custom name or resolved conflict');
    console.log(`✓ Created session: ${createResponse.sessionId} named "${createResponse.name}"`);
    
    client.disconnect();
    
    // Test 2: Create event without custom name (fallback)
    console.log('Testing create event without custom name...');
    client = createTestClient();
    
    await new Promise((resolve) => {
      client.on('connect', resolve);
    });
    
    await authenticateClient(client);
    
    const fallbackResponse = await new Promise((resolve, reject) => {
      client.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(fallbackResponse.sessionId, 'Should return session ID for fallback');
    assert(fallbackResponse.name, 'Should return fallback name');
    assert(fallbackResponse.name.startsWith('Session '), 'Should generate fallback name with Session prefix');
    console.log(`✓ Created fallback session: ${fallbackResponse.sessionId} named "${fallbackResponse.name}"`);
    
    client.disconnect();
    
    // Test 3: Invalid session name (should fall back to generated name)
    console.log('Testing create event with invalid name...');
    client = createTestClient();
    
    await new Promise((resolve) => {
      client.on('connect', resolve);
    });
    
    await authenticateClient(client);
    
    const invalidNameResponse = await new Promise((resolve, reject) => {
      client.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: 'a'.repeat(51) // Too long - should fall back to generated name
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(invalidNameResponse.sessionId, 'Should create session even with invalid name');
    assert(invalidNameResponse.name.startsWith('Session '), 'Should fall back to generated name');
    console.log(`✓ Invalid name fell back to: "${invalidNameResponse.name}"`);
    
    client.disconnect();
    
    console.log('\n🎉 Socket.IO API extension tests completed!');
    console.log('Note: Some tests verify current behavior - will be updated as we implement the features');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  } finally {
    // Cleanup
    if (client) client.disconnect();
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