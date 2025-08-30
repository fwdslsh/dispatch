// tests/test-session-creation-integration.js
// Integration test for complete session creation flow with custom names
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
const TEST_PTY_ROOT = path.join(__dirname, `test-integration-${Date.now()}`);
const TEST_PORT = 3036;
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

console.log('🧪 Testing complete session creation integration...\\n');

let httpServer, io, client;

async function runTests() {
  try {
    cleanup();
    
    // Start test server
    console.log('Starting integration test server...');
    const server = await createTestServer();
    httpServer = server.httpServer;
    io = server.io;
    
    client = createTestClient();
    
    await new Promise((resolve) => {
      client.on('connect', resolve);
    });
    
    await authenticateClient(client);
    console.log('✅ Integration test server started\\n');
    
    // Test 1: Complete session creation workflow with custom name
    console.log('🔧 Test 1: Complete custom name session creation');
    
    let sessionsUpdated = false;
    let broadcastData = null;
    
    // Listen for sessions-updated broadcast
    client.on('sessions-updated', (data) => {
      sessionsUpdated = true;
      broadcastData = data;
    });
    
    // Create session with custom name (simulating frontend form submission)
    const customSessionResult = await new Promise((resolve, reject) => {
      client.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: 'Integration Test Session'
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(customSessionResult.sessionId, 'Should return session ID');
    assert(customSessionResult.name === 'Integration Test Session', 'Should return custom name');
    
    // Wait for sessions-updated broadcast
    await new Promise(resolve => setTimeout(resolve, 100));
    assert(sessionsUpdated, 'Should receive sessions-updated broadcast');
    
    // Verify session appears in sessions list with correct name
    const sessionsList = await new Promise((resolve, reject) => {
      client.emit('list', (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'List failed'));
        }
      });
    });
    
    const createdSession = sessionsList.sessions.find(s => s.id === customSessionResult.sessionId);
    assert(createdSession, 'Created session should appear in sessions list');
    assert(createdSession.name === 'Integration Test Session', 'Session should have correct name in list');
    
    console.log(`   ✓ Session "${createdSession.name}" created and listed successfully\\n`);
    
    // Test 2: Session creation with empty name (fallback workflow)
    console.log('🔧 Test 2: Empty name fallback workflow');
    
    sessionsUpdated = false;
    broadcastData = null;
    
    const fallbackSessionResult = await new Promise((resolve, reject) => {
      client.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: '' // Empty name, should trigger fallback
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(fallbackSessionResult.sessionId, 'Should create session with empty name');
    assert(fallbackSessionResult.name.startsWith('Session '), 'Should generate fallback name');
    
    console.log(`   ✓ Empty name fell back to: "${fallbackSessionResult.name}"\\n`);
    
    // Test 3: Name conflict resolution workflow
    console.log('🔧 Test 3: Name conflict resolution workflow');
    
    const conflictSessionResult = await new Promise((resolve, reject) => {
      client.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: 'Integration Test Session' // Same name as first session
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(conflictSessionResult.sessionId, 'Should create session despite name conflict');
    assert(conflictSessionResult.name.startsWith('Integration Test Session') && conflictSessionResult.name.includes('('), 'Should resolve conflict with suffix');
    
    console.log(`   ✓ Name conflict resolved to: "${conflictSessionResult.name}"\\n`);
    
    // Test 4: Session renaming workflow
    console.log('🔧 Test 4: Session renaming workflow');
    
    sessionsUpdated = false;
    
    const renameResult = await new Promise((resolve, reject) => {
      client.emit('rename', {
        sessionId: customSessionResult.sessionId,
        newName: 'Renamed Integration Session'
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Rename failed'));
        }
      });
    });
    
    assert(renameResult.success, 'Rename should succeed');
    assert(renameResult.oldName === 'Integration Test Session', 'Should return correct old name');
    assert(renameResult.newName.startsWith('Renamed Integration Session'), 'Should return new name (possibly with conflict resolution suffix)');
    
    // Wait for broadcast and verify
    await new Promise(resolve => setTimeout(resolve, 100));
    assert(sessionsUpdated, 'Should receive sessions-updated broadcast for rename');
    
    // Verify renamed session in list
    const updatedSessionsList = await new Promise((resolve, reject) => {
      client.emit('list', (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'List failed'));
        }
      });
    });
    
    const renamedSession = updatedSessionsList.sessions.find(s => s.id === customSessionResult.sessionId);
    assert(renamedSession, 'Renamed session should still be in list');
    assert(renamedSession.name.startsWith('Renamed Integration Session'), 'Session should have new name (with possible conflict suffix) in list');
    
    console.log(`   ✓ Session renamed to: "${renamedSession.name}"\\n`);
    
    // Test 5: Invalid name handling workflow
    console.log('🔧 Test 5: Invalid name handling workflow');
    
    const invalidNameResult = await new Promise((resolve, reject) => {
      client.emit('create', {
        mode: 'shell',
        cols: 80,
        rows: 24,
        name: 'Invalid@Name#Characters!' // Contains invalid characters
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create failed'));
        }
      });
    });
    
    assert(invalidNameResult.sessionId, 'Should create session even with invalid name');
    assert(invalidNameResult.name.startsWith('Session '), 'Should fall back to generated name for invalid characters');
    
    console.log(`   ✓ Invalid name fell back to: "${invalidNameResult.name}"\\n`);
    
    // Test 6: Verify filesystem symlinks are created correctly
    console.log('🔧 Test 6: Filesystem symlinks verification');
    
    const byNameDir = path.join(TEST_PTY_ROOT, 'by-name');
    assert(fs.existsSync(byNameDir), 'by-name directory should exist');
    
    // List all symlinks in by-name directory to see what we have
    const symlinks = fs.readdirSync(byNameDir);
    console.log(`   Available symlinks: ${symlinks.join(', ')}`);
    
    // Check if renamed session symlink exists
    const renamedSymlinkName = 'renamed-integration-session';
    const renamedSymlinkPath = path.join(byNameDir, renamedSymlinkName);
    
    if (fs.existsSync(renamedSymlinkPath)) {
      // Verify symlink points to correct session directory
      const symlinkTarget = fs.readlinkSync(renamedSymlinkPath);
      const expectedTarget = path.join('..', customSessionResult.sessionId);
      assert(symlinkTarget === expectedTarget, `Symlink should point to ${expectedTarget}, got ${symlinkTarget}`);
      console.log(`   ✓ Symlink "${renamedSymlinkName}" -> "${symlinkTarget}" verified`);
    } else {
      // If exact symlink doesn't exist, verify at least one symlink points to our session
      let foundSymlink = false;
      for (const symlinkName of symlinks) {
        const symlinkPath = path.join(byNameDir, symlinkName);
        try {
          const target = fs.readlinkSync(symlinkPath);
          if (target === path.join('..', customSessionResult.sessionId)) {
            console.log(`   ✓ Found symlink "${symlinkName}" -> "${target}" for renamed session`);
            foundSymlink = true;
            break;
          }
        } catch (err) {
          // Ignore broken symlinks
        }
      }
      assert(foundSymlink, 'Should have at least one symlink pointing to the renamed session');
    }
    
    console.log();
    
    // Test 7: Complete workflow summary
    console.log('🔧 Test 7: Complete workflow verification');
    
    const finalSessionsList = await new Promise((resolve, reject) => {
      client.emit('list', (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'List failed'));
        }
      });
    });
    
    assert(finalSessionsList.sessions.length >= 5, 'Should have all created sessions');
    
    // Verify all sessions have proper names and IDs
    const allSessionsHaveNames = finalSessionsList.sessions.every(s => s.name && s.name.length > 0);
    const allSessionsHaveIds = finalSessionsList.sessions.every(s => s.id && s.id.length > 0);
    
    assert(allSessionsHaveNames, 'All sessions should have non-empty names');
    assert(allSessionsHaveIds, 'All sessions should have valid IDs');
    
    console.log(`   ✓ All ${finalSessionsList.sessions.length} sessions have proper names and IDs\\n`);
    
    console.log('🎉 All session creation integration tests passed!\\n');
    
    // Summary
    console.log('📊 Integration Test Summary:');
    console.log('   ✅ Custom name session creation workflow');
    console.log('   ✅ Empty name fallback workflow');
    console.log('   ✅ Name conflict resolution workflow');
    console.log('   ✅ Session renaming workflow');
    console.log('   ✅ Invalid name handling workflow');
    console.log('   ✅ Filesystem symlinks verification');
    console.log('   ✅ Complete workflow integrity\\n');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
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
  console.error('Integration test suite failed:', error);
  process.exit(1);
});