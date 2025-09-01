// tests/test-frontend-project-context.js
// Tests for frontend project context functionality and state management
import fs from 'fs';
import path from 'path';
import os from 'os';
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
const TEST_CONFIG_DIR = path.join(os.tmpdir(), `test-dispatch-config-fe-${Date.now()}`);
const TEST_PROJECTS_DIR = path.join(os.tmpdir(), `test-dispatch-projects-fe-${Date.now()}`);
const TEST_PORT = 3042;

process.env.DISPATCH_CONFIG_DIR = TEST_CONFIG_DIR;
process.env.DISPATCH_PROJECTS_DIR = TEST_PROJECTS_DIR;
process.env.TERMINAL_KEY = 'test-frontend-key';
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
    client.emit('auth', 'test-frontend-key', (response) => {
      if (response.success) {
        resolve(response);
      } else {
        reject(new Error(response.error || 'Auth failed'));
      }
    });
  });
}

// Mock frontend project context state
class ProjectContext {
  constructor() {
    this.currentProject = null;
    this.projects = [];
    this.activeSessions = [];
    this.isLoading = false;
    this.error = null;
  }

  // Simulate frontend project loading
  async loadProject(socket, projectId) {
    this.isLoading = true;
    this.error = null;
    
    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('get-project', { projectId }, (response) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || 'Failed to load project'));
          }
        });
      });
      
      this.currentProject = result.project;
      this.activeSessions = result.project.activeSessions || [];
      this.isLoading = false;
      return result.project;
    } catch (err) {
      this.error = err.message;
      this.isLoading = false;
      throw err;
    }
  }

  // Simulate frontend project list loading
  async loadProjects(socket) {
    this.isLoading = true;
    this.error = null;
    
    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('list-projects', (response) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || 'Failed to load projects'));
          }
        });
      });
      
      this.projects = result.projects;
      this.isLoading = false;
      return result.projects;
    } catch (err) {
      this.error = err.message;
      this.isLoading = false;
      throw err;
    }
  }

  // Simulate frontend session creation in project context
  async createSessionInProject(socket, sessionOpts) {
    if (!this.currentProject) {
      throw new Error('No project context available');
    }
    
    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('create-session-in-project', {
          projectId: this.currentProject.id,
          sessionOpts
        }, (response) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || 'Failed to create session'));
          }
        });
      });
      
      // Update active sessions in context
      await this.loadProject(socket, this.currentProject.id);
      return result;
    } catch (err) {
      this.error = err.message;
      throw err;
    }
  }

  // Simulate frontend project filtering for sessions
  async getProjectSessions(socket, projectId = null) {
    const targetProjectId = projectId || this.currentProject?.id;
    if (!targetProjectId) {
      return [];
    }
    
    try {
      const result = await new Promise((resolve, reject) => {
        socket.emit('list', { projectId: targetProjectId }, (response) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || 'Failed to get project sessions'));
          }
        });
      });
      
      return result.sessions || [];
    } catch (err) {
      this.error = err.message;
      throw err;
    }
  }

  // Reset context state
  reset() {
    this.currentProject = null;
    this.projects = [];
    this.activeSessions = [];
    this.isLoading = false;
    this.error = null;
  }
}

console.log('🧪 Testing frontend project context functionality...\n');

let httpServer, io, client, projectContext;

async function runTests() {
  try {
    cleanup();
    
    // Start test server
    console.log('Starting frontend project context test server...');
    const server = await createTestServer();
    httpServer = server.httpServer;
    io = server.io;
    
    client = createTestClient();
    projectContext = new ProjectContext();
    
    await new Promise((resolve) => {
      client.on('connect', resolve);
    });
    
    await authenticateClient(client);
    console.log('✅ Frontend test server started and authenticated\n');
    
    // Test 1: Project Context State Management
    console.log('🔧 Test 1: Project context state management');
    
    // Initial state should be empty
    assert(projectContext.currentProject === null, 'Initial project should be null');
    assert(projectContext.projects.length === 0, 'Initial projects list should be empty');
    assert(projectContext.activeSessions.length === 0, 'Initial active sessions should be empty');
    assert(!projectContext.isLoading, 'Should not be loading initially');
    assert(projectContext.error === null, 'Should have no errors initially');
    
    console.log('   ✓ Initial project context state is correct');
    
    // Test 2: Load Projects List into Context
    console.log('🔧 Test 2: Load projects list into context');
    
    // Create test project first
    const createResult = await new Promise((resolve, reject) => {
      client.emit('create-project', {
        name: `Frontend Test Project ${Date.now()}`,
        description: 'A project for testing frontend context'
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create project failed'));
        }
      });
    });
    
    const testProjectId = createResult.project.id;
    
    // Load projects into context
    const projects = await projectContext.loadProjects(client);
    assert(Array.isArray(projects), 'Projects should be an array');
    assert(projects.length >= 1, 'Should have at least one project');
    
    const testProject = projects.find(p => p.id === testProjectId);
    assert(testProject, 'Should find the test project in projects list');
    
    assert(projectContext.projects === projects, 'Context should store projects');
    assert(!projectContext.isLoading, 'Should not be loading after completion');
    
    console.log(`   ✓ Loaded ${projects.length} projects into context`);
    
    // Test 3: Load Specific Project Context
    console.log('🔧 Test 3: Load specific project context');
    
    const project = await projectContext.loadProject(client, testProjectId);
    assert(project.id === testProjectId, 'Should load correct project');
    assert(projectContext.currentProject === project, 'Context should store current project');
    assert(Array.isArray(projectContext.activeSessions), 'Active sessions should be an array');
    
    console.log(`   ✓ Loaded project "${project.displayName}" into context`);
    
    // Test 4: Session Creation in Project Context
    console.log('🔧 Test 4: Session creation in project context');
    
    const initialSessionCount = projectContext.activeSessions.length;
    
    const sessionResult = await projectContext.createSessionInProject(client, {
      mode: 'shell',
      cols: 80,
      rows: 24,
      name: 'Frontend Context Test Session'
    });
    
    assert(sessionResult.sessionId, 'Should return session ID');
    assert(sessionResult.projectId === testProjectId, 'Session should belong to current project');
    assert(projectContext.activeSessions.length > initialSessionCount, 'Active sessions should increase');
    
    const newSession = projectContext.activeSessions.find(s => s.id === sessionResult.sessionId || s.sessionId === sessionResult.sessionId);
    assert(newSession, 'New session should appear in active sessions');
    
    console.log(`   ✓ Created session in project context: ${sessionResult.sessionId}`);
    
    // Test 5: Project Session Filtering
    console.log('🔧 Test 5: Project session filtering');
    
    const projectSessions = await projectContext.getProjectSessions(client);
    assert(Array.isArray(projectSessions), 'Project sessions should be an array');
    assert(projectSessions.length >= 1, 'Should have at least one session');
    
    const testSession = projectSessions.find(s => s.id === sessionResult.sessionId || s.sessionId === sessionResult.sessionId);
    assert(testSession, 'Should find the test session in project sessions');
    assert(testSession.projectId === testProjectId, 'Session should have correct project ID');
    
    console.log(`   ✓ Found ${projectSessions.length} sessions in project context`);
    
    // Test 6: Error Handling in Context
    console.log('🔧 Test 6: Error handling in project context');
    
    projectContext.reset();
    assert(projectContext.currentProject === null, 'Context should be reset');
    
    try {
      await projectContext.createSessionInProject(client, { mode: 'shell' });
      assert(false, 'Should throw error when no project context');
    } catch (err) {
      assert(err.message.includes('No project context'), 'Should get appropriate error message');
    }
    
    // Test invalid project loading
    try {
      await projectContext.loadProject(client, 'invalid-project-id');
      assert(false, 'Should throw error for invalid project');
    } catch (err) {
      assert(err.message.includes('not found'), 'Should get project not found error');
      assert(projectContext.error, 'Context should store error state');
    }
    
    console.log('   ✓ Error handling works correctly');
    
    // Test 7: Context State Persistence
    console.log('🔧 Test 7: Context state persistence patterns');
    
    // Reload the project to test state refresh
    projectContext.reset();
    await projectContext.loadProject(client, testProjectId);
    
    assert(projectContext.currentProject.id === testProjectId, 'Project context should be reloaded');
    assert(projectContext.activeSessions.length >= 1, 'Active sessions should be reloaded');
    assert(projectContext.error === null, 'Error state should be cleared');
    
    console.log('   ✓ Context state persistence works correctly');
    
    // Test 8: Multi-Project Context Switching
    console.log('🔧 Test 8: Multi-project context switching');
    
    // Create second project
    const secondProjectResult = await new Promise((resolve, reject) => {
      client.emit('create-project', {
        name: `Frontend Test Project 2 ${Date.now()}`,
        description: 'Second project for context switching test'
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Create second project failed'));
        }
      });
    });
    
    const secondProjectId = secondProjectResult.project.id;
    
    // Switch to second project
    await projectContext.loadProject(client, secondProjectId);
    assert(projectContext.currentProject.id === secondProjectId, 'Should switch to second project');
    assert(projectContext.activeSessions.length === 0, 'Second project should have no sessions initially');
    
    // Switch back to first project
    await projectContext.loadProject(client, testProjectId);
    assert(projectContext.currentProject.id === testProjectId, 'Should switch back to first project');
    assert(projectContext.activeSessions.length >= 1, 'First project should still have sessions');
    
    console.log('   ✓ Multi-project context switching works correctly');
    
    console.log('\n🎉 All frontend project context tests passed!\n');
    
    // Summary
    console.log('📊 Frontend Project Context Test Summary:');
    console.log('   ✅ Project context state management');
    console.log('   ✅ Projects list loading into context');
    console.log('   ✅ Specific project context loading');
    console.log('   ✅ Session creation in project context');
    console.log('   ✅ Project session filtering');
    console.log('   ✅ Error handling in context');
    console.log('   ✅ Context state persistence patterns');
    console.log('   ✅ Multi-project context switching\n');
    
  } catch (error) {
    console.error('❌ Frontend project context test failed:', error.message);
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
  console.error('Frontend project context test suite failed:', error);
  process.exit(1);
});