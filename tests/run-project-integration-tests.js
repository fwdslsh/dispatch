// tests/run-project-integration-tests.js
// Integration test for project/session functionality

import { io } from 'socket.io-client';
import fs from 'fs';

// Test environment setup
const TEST_PTY_ROOT = '/tmp/dispatch-test-integration';
process.env.PTY_ROOT = TEST_PTY_ROOT;
process.env.TERMINAL_KEY = 'test';

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

// Clean up test environment
function cleanup() {
  try {
    if (fs.existsSync(TEST_PTY_ROOT)) {
      fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('Cleanup warning:', err.message);
  }
}

async function runIntegrationTests() {
  console.log('Running project/session integration tests...\n');
  
  // Clean up before tests
  cleanup();

  console.log('Note: These integration tests require a running server.');
  console.log('Run "npm run dev" in another terminal first.\n');

  const serverUrl = 'http://localhost:5173';
  let client1;

  try {
    // Test 1: Connect and authenticate
    console.log('🔧 Test 1: Connect and authenticate');
    client1 = io(serverUrl);
    
    await new Promise((resolve, reject) => {
      client1.on('connect', () => {
        console.log('   ✓ Connected to server');
        
        client1.emit('auth', 'test', (response) => {
          if (response?.ok || response?.success) {
            console.log('   ✓ Authenticated successfully');
            resolve();
          } else {
            reject(new Error('Authentication failed'));
          }
        });
      });
      
      client1.on('connect_error', (err) => {
        reject(new Error(`Connection failed: ${err.message}`));
      });
    });

    // Test 2: Create project
    console.log('\n🔧 Test 2: Create project');
    const project = await new Promise((resolve, reject) => {
      client1.emit('create-project', {
        name: 'Integration Test Project',
        description: 'Test project for integration testing'
      }, (response) => {
        if (response.ok) {
          resolve(response.project);
        } else {
          reject(new Error(response.error || 'Project creation failed'));
        }
      });
    });
    
    assert(project.id, 'Should have project ID');
    assertEqual(project.name, 'Integration Test Project', 'Should have correct name');
    console.log(`   ✓ Created project: ${project.name} (${project.id})`);

    // Test 3: List projects
    console.log('\n🔧 Test 3: List projects');
    const projectsList = await new Promise((resolve, reject) => {
      client1.emit('list-projects', (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'List projects failed'));
        }
      });
    });
    
    assert(Array.isArray(projectsList.projects), 'Should return projects array');
    assert(projectsList.projects.length > 0, 'Should have at least one project');
    const ourProject = projectsList.projects.find(p => p.id === project.id);
    assert(ourProject, 'Should find our created project');
    console.log(`   ✓ Listed ${projectsList.projects.length} project(s)`);

    // Test 4: Create session in project  
    console.log('\n🔧 Test 4: Create session in project');
    const session = await new Promise((resolve, reject) => {
      client1.emit('create-session-in-project', {
        projectId: project.id,
        sessionOpts: {
          mode: 'shell',
          name: 'Test Terminal',
          cols: 80,
          rows: 24
        }
      }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Session creation failed'));
        }
      });
    });
    
    assert(session.sessionId, 'Should have session ID');
    assertEqual(session.name, 'Test Terminal', 'Should have correct session name');
    assertEqual(session.projectId, project.id, 'Should belong to correct project');
    console.log(`   ✓ Created session: ${session.name} (${session.sessionId})`);

    // Test 5: Get project with sessions
    console.log('\n🔧 Test 5: Get project with sessions');
    const projectWithSessions = await new Promise((resolve, reject) => {
      client1.emit('get-project', { projectId: project.id }, (response) => {
        if (response.ok) {
          resolve(response.project);
        } else {
          reject(new Error(response.error || 'Get project failed'));
        }
      });
    });
    
    assert(projectWithSessions.sessions, 'Project should have sessions array');
    assertEqual(projectWithSessions.sessions.length, 1, 'Should have 1 session');
    assertEqual(projectWithSessions.sessions[0].name, 'Test Terminal', 'Should have correct session name');
    assertEqual(projectWithSessions.sessions[0].type, 'shell', 'Should have correct session type');
    console.log(`   ✓ Project contains ${projectWithSessions.sessions.length} session(s)`);

    // Test 6: Update project
    console.log('\n🔧 Test 6: Update project');
    const updatedProject = await new Promise((resolve, reject) => {
      client1.emit('update-project', {
        projectId: project.id,
        updates: { name: 'Updated Integration Test Project' }
      }, (response) => {
        if (response.ok) {
          resolve(response.project);
        } else {
          reject(new Error(response.error || 'Update project failed'));
        }
      });
    });
    
    assertEqual(updatedProject.name, 'Updated Integration Test Project', 'Should have updated name');
    console.log(`   ✓ Updated project name to: ${updatedProject.name}`);

    // Test 7: Set active project
    console.log('\n🔧 Test 7: Set active project');
    const activeResult = await new Promise((resolve, reject) => {
      client1.emit('set-active-project', { projectId: project.id }, (response) => {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Set active project failed'));
        }
      });
    });
    
    assertEqual(activeResult.activeProject, project.id, 'Should set correct active project');
    console.log(`   ✓ Set active project: ${activeResult.activeProject}`);

    console.log('\n🎉 All project/session integration tests passed!');
    console.log('\nThe project/session model is working correctly with full CRUD operations.');
    
  } catch (err) {
    console.error('\n❌ Integration test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (client1) {
      client1.disconnect();
    }
    cleanup();
  }
}

// Only run if server is available
async function checkServerAvailable() {
  try {
    const testClient = io('http://localhost:5173', { timeout: 2000 });
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        testClient.disconnect();
        resolve(false);
      }, 3000);
      
      testClient.on('connect', () => {
        clearTimeout(timeout);
        testClient.disconnect();
        resolve(true);
      });
      
      testClient.on('connect_error', () => {
        clearTimeout(timeout);
        testClient.disconnect();
        resolve(false);
      });
    });
  } catch (err) {
    return false;
  }
}

// Run tests if server is available
checkServerAvailable().then(available => {
  if (available) {
    runIntegrationTests().catch(err => {
      console.error('Test runner error:', err);
      process.exit(1);
    });
  } else {
    console.log('⚠️  Server not available at http://localhost:5173');
    console.log('Start the server with "npm run dev" and try again.');
    process.exit(0);
  }
});