// tests/test-socket-handler-project-operations.js
// Tests for socket handler project operations using DirectoryManager
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { handleConnection } from '../src/lib/server/socket-handler.js';
import DirectoryManager from '../src/lib/server/directory-manager.js';

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

// Set up test environment with directory management
const TEST_CONFIG_DIR = path.join(os.tmpdir(), `test-dispatch-config-${Date.now()}`);
const TEST_PROJECTS_DIR = path.join(os.tmpdir(), `test-dispatch-projects-${Date.now()}`);
const TEST_PORT = 3041;

process.env.DISPATCH_CONFIG_DIR = TEST_CONFIG_DIR;
process.env.DISPATCH_PROJECTS_DIR = TEST_PROJECTS_DIR;
process.env.TERMINAL_KEY = 'test-key-secure'; // This will require authentication
process.env.PTY_MODE = 'shell';

// Clean up test directories
function cleanup() {
  if (fs.existsSync(TEST_CONFIG_DIR)) {
    fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(TEST_PROJECTS_DIR)) {
    fs.rmSync(TEST_PROJECTS_DIR, { recursive: true, force: true });
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
    client.emit('auth', 'test-key-secure', (response) => {
      if (response.success) {
        resolve(response);
      } else {
        reject(new Error(response.error || 'Auth failed'));
      }
    });
  });
}

console.log('🧪 Testing socket handler project operations...\n');

let httpServer, io, client;

async function runTests() {
  try {
    cleanup();
    
    // Initialize DirectoryManager for testing
    const directoryManager = new DirectoryManager();
    await directoryManager.initialize();
    console.log('✅ DirectoryManager initialized\n');
    
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
    console.log('✅ Test server started and authenticated\n');
    
    // Test 1: Create project
    console.log('🔧 Test 1: Create project');
    
    let projectsUpdated = false;
    let broadcastData = null;
    
    // Listen for projects-updated broadcast
    client.on('projects-updated', (data) => {
      projectsUpdated = true;
      broadcastData = data;
    });
    
    const uniqueProjectName = `Test Project ${Date.now()}`;
    const createProjectResult = await new Promise((resolve, reject) => {
      client.emit('create-project', {
        name: uniqueProjectName,
        description: 'A test project for socket handler testing'
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create project failed'));
        }
      });
    });
    
    assert(createProjectResult.project, 'Should return project object');
    assert(createProjectResult.project.id, 'Project should have ID');
    assert(createProjectResult.project.name.startsWith('test-project'), 'Project should have sanitized name');
    assert(createProjectResult.project.displayName === uniqueProjectName, 'Project should have original display name');
    assert(createProjectResult.project.description === 'A test project for socket handler testing', 'Project should have description');
    
    // Wait for projects-updated broadcast
    await new Promise(resolve => setTimeout(resolve, 100));
    assert(projectsUpdated, 'Should receive projects-updated broadcast');
    
    console.log(`   ✓ Created project: ${createProjectResult.project.id} named "${createProjectResult.project.displayName}"`);
    const testProjectId = createProjectResult.project.id;
    
    // Test 2: List projects
    console.log('🔧 Test 2: List projects');
    
    const listProjectsResult = await new Promise((resolve, reject) => {
      client.emit('list-projects', (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'List projects failed'));
        }
      });
    });
    
    assert(Array.isArray(listProjectsResult.projects), 'Should return projects array');
    assert(listProjectsResult.projects.length >= 1, 'Should have at least one project');
    
    const createdProject = listProjectsResult.projects.find(p => p.id === testProjectId);
    assert(createdProject, 'Created project should appear in list');
    assert(createdProject.name.startsWith('test-project'), 'Listed project should have correct name');
    
    console.log(`   ✓ Listed ${listProjectsResult.projects.length} projects, found test project`);
    
    // Test 3: Get single project
    console.log('🔧 Test 3: Get single project');
    
    const getProjectResult = await new Promise((resolve, reject) => {
      client.emit('get-project', {
        projectId: testProjectId
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Get project failed'));
        }
      });
    });
    
    assert(getProjectResult.project, 'Should return project object');
    assert(getProjectResult.project.id === testProjectId, 'Should return correct project');
    assert(Array.isArray(getProjectResult.project.activeSessions), 'Should include active sessions array');
    assert(getProjectResult.project.activeSessions.length === 0, 'Should start with no active sessions');
    
    console.log(`   ✓ Retrieved project: ${getProjectResult.project.displayName} with ${getProjectResult.project.activeSessions.length} active sessions`);
    
    // Test 4: Create session in project
    console.log('🔧 Test 4: Create session in project');
    
    const createSessionResult = await new Promise((resolve, reject) => {
      client.emit('create-session-in-project', {
        projectId: testProjectId,
        sessionOpts: {
          mode: 'shell',
          cols: 80,
          rows: 24,
          name: 'Test Session'
        }
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create session in project failed'));
        }
      });
    });
    
    assert(createSessionResult.sessionId, 'Should return session ID');
    assert(createSessionResult.name === 'Test Session', 'Should return session name');
    assert(createSessionResult.projectId === testProjectId, 'Should return correct project ID');
    
    console.log(`   ✓ Created session: ${createSessionResult.sessionId} in project ${testProjectId}`);
    const testSessionId = createSessionResult.sessionId;
    
    // Test 5: Get project with sessions
    console.log('🔧 Test 5: Get project with active sessions');
    
    // Wait a moment for session to be registered
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const getProjectWithSessionsResult = await new Promise((resolve, reject) => {
      client.emit('get-project', {
        projectId: testProjectId
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Get project with sessions failed'));
        }
      });
    });
    
    assert(getProjectWithSessionsResult.project.activeSessions.length >= 1, 'Should have at least one active session');
    
    const activeSession = getProjectWithSessionsResult.project.activeSessions.find(s => 
      s.id === testSessionId || s.sessionId === testSessionId
    );
    assert(activeSession, 'Should find the created session in active sessions');
    assert(activeSession.projectId === testProjectId, 'Session should have correct project ID');
    
    console.log(`   ✓ Project now has ${getProjectWithSessionsResult.project.activeSessions.length} active sessions`);
    
    // Test 6: Invalid project operations
    console.log('🔧 Test 6: Invalid project operations');
    
    // Test invalid project creation
    const invalidCreateResult = await new Promise((resolve, reject) => {
      client.emit('create-project', {
        name: '', // Empty name
        description: 'Invalid project'
      }, (response) => {
        resolve(response); // Don't reject, we want to test the error response
      });
    });
    
    assert(!invalidCreateResult.success, 'Should fail with empty project name');
    assert(invalidCreateResult.error, 'Should return error message');
    
    // Test getting non-existent project
    const nonExistentProjectResult = await new Promise((resolve, reject) => {
      client.emit('get-project', {
        projectId: 'non-existent-id'
      }, (response) => {
        resolve(response); // Don't reject, we want to test the error response
      });
    });
    
    assert(!nonExistentProjectResult.success, 'Should fail with non-existent project ID');
    assert(nonExistentProjectResult.error, 'Should return error message');
    
    console.log('   ✓ Invalid operations handled correctly');
    
    // Test 7: Project name sanitization
    console.log('🔧 Test 7: Project name sanitization');
    
    const sanitizationProjectName = `Project With @Special# Characters! ${Date.now()}`;
    const sanitizationTestResult = await new Promise((resolve, reject) => {
      client.emit('create-project', {
        name: sanitizationProjectName,
        description: 'Testing name sanitization'
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Sanitization test failed'));
        }
      });
    });
    
    assert(sanitizationTestResult.project.name.includes('project-with-special-characters'), 'Name should be sanitized');
    assert(sanitizationTestResult.project.displayName === sanitizationProjectName, 'Display name should be preserved');
    
    console.log(`   ✓ Name sanitized: "${sanitizationTestResult.project.displayName}" -> "${sanitizationTestResult.project.name}"`);
    
    console.log('   ✓ All core socket handler project operations working correctly');
    
    console.log('\n🎉 All socket handler project operation tests passed!\n');
    
    // Summary
    console.log('📊 Test Summary:');
    console.log('   ✅ Project creation with broadcast');
    console.log('   ✅ Project listing');
    console.log('   ✅ Single project retrieval');
    console.log('   ✅ Session creation in project');
    console.log('   ✅ Project with active sessions');
    console.log('   ✅ Invalid operation handling');
    console.log('   ✅ Name sanitization');
    console.log('   ✅ Core socket operations verified\n');
    
  } catch (error) {
    console.error('❌ Socket handler project operations test failed:', error.message);
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
  console.error('Socket handler project operations test suite failed:', error);
  process.exit(1);
});