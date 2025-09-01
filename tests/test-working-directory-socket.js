// tests/test-working-directory-socket.js
// Test socket events for working directory functionality

import { io } from 'socket.io-client';
import fs from 'fs';
import path from 'path';

// Test environment setup
const TEST_PTY_ROOT = '/tmp/dispatch-test-workdir-socket';
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

async function runSocketTests() {
  console.log('Testing working directory socket functionality...\n');
  
  // Clean up before tests
  cleanup();

  console.log('Note: These tests require a running server.');
  console.log('Run "npm run dev" in another terminal first.\n');

  const serverUrl = 'http://localhost:5173';
  let client;

  try {
    // Connect and authenticate
    console.log('🔧 Connecting and authenticating...');
    client = io(serverUrl);
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      client.on('connect', () => {
        console.log('✓ Connected to server');
        resolve();
      });
      client.on('connect_error', (err) => {
        reject(new Error(`Connection failed: ${err.message}`));
      });
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // Authenticate
    await new Promise((resolve, reject) => {
      client.emit('auth', 'test', (response) => {
        if (response.success) {
          console.log('✓ Authenticated successfully');
          resolve();
        } else {
          reject(new Error(`Authentication failed: ${response.error}`));
        }
      });
      setTimeout(() => reject(new Error('Auth timeout')), 5000);
    });

    // Create a test project
    console.log('\n🔧 Creating test project...');
    let projectId;
    await new Promise((resolve, reject) => {
      client.emit('create-project', { 
        name: 'Test Working Dir Project', 
        description: 'Project for testing working directories' 
      }, (response) => {
        if (response.success) {
          projectId = response.project.id;
          console.log(`✓ Created project: ${projectId}`);
          resolve();
        } else {
          reject(new Error(`Project creation failed: ${response.error}`));
        }
      });
      setTimeout(() => reject(new Error('Project creation timeout')), 5000);
    });

    // Create test directory structure in the project
    const projectDir = path.join(TEST_PTY_ROOT, projectId);
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'src', 'components'), { recursive: true });
    console.log('✓ Created test directory structure');

    // Test directory listing
    console.log('\n🔧 Testing directory listing...');
    await new Promise((resolve, reject) => {
      client.emit('list-project-directories', { projectId }, (response) => {
        if (response.success) {
          assert(Array.isArray(response.directories), 'Should return directories array');
          const srcDir = response.directories.find(d => d.name === 'src');
          const docsDir = response.directories.find(d => d.name === 'docs');
          assert(srcDir && srcDir.isDirectory, 'Should find src directory');
          assert(docsDir && docsDir.isDirectory, 'Should find docs directory');
          console.log(`✓ Found ${response.directories.length} directories`);
          resolve();
        } else {
          reject(new Error(`Directory listing failed: ${response.error}`));
        }
      });
      setTimeout(() => reject(new Error('Directory listing timeout')), 5000);
    });

    // Test subdirectory listing
    console.log('\n🔧 Testing subdirectory listing...');
    await new Promise((resolve, reject) => {
      client.emit('list-project-directories', { projectId, relativePath: 'src' }, (response) => {
        if (response.success) {
          assert(Array.isArray(response.directories), 'Should return subdirectories array');
          const componentsDir = response.directories.find(d => d.name === 'components');
          assert(componentsDir && componentsDir.isDirectory, 'Should find components subdirectory');
          console.log(`✓ Found ${response.directories.length} subdirectories in src/`);
          resolve();
        } else {
          reject(new Error(`Subdirectory listing failed: ${response.error}`));
        }
      });
      setTimeout(() => reject(new Error('Subdirectory listing timeout')), 5000);
    });

    // Test session creation with working directory
    console.log('\n🔧 Testing session creation with working directory...');
    let sessionId;
    await new Promise((resolve, reject) => {
      client.emit('create-session-in-project', {
        projectId,
        sessionOpts: {
          mode: 'shell',
          name: 'Src Working Dir Session',
          workingDirectory: 'src'
        }
      }, (response) => {
        if (response.success) {
          sessionId = response.sessionId;
          assert(response.projectId === projectId, 'Should return correct project ID');
          console.log(`✓ Created session with working directory: ${sessionId}`);
          resolve();
        } else {
          reject(new Error(`Session creation failed: ${response.error}`));
        }
      });
      setTimeout(() => reject(new Error('Session creation timeout')), 5000);
    });

    // Test invalid working directory
    console.log('\n🔧 Testing invalid working directory handling...');
    await new Promise((resolve, reject) => {
      client.emit('create-session-in-project', {
        projectId,
        sessionOpts: {
          mode: 'shell',
          workingDirectory: 'nonexistent'
        }
      }, (response) => {
        if (!response.success) {
          assert(response.error.includes('does not exist'), 'Should reject nonexistent directory');
          console.log('✓ Invalid working directory properly rejected');
          resolve();
        } else {
          reject(new Error('Should have failed for nonexistent directory'));
        }
      });
      setTimeout(() => reject(new Error('Invalid directory test timeout')), 5000);
    });

    // Clean up created session
    if (sessionId) {
      console.log('\n🔧 Cleaning up session...');
      await new Promise((resolve) => {
        client.emit('end', sessionId, () => {
          console.log('✓ Session ended');
          resolve();
        });
        setTimeout(resolve, 2000); // Don't fail if cleanup times out
      });
    }

    console.log('\n🎉 All socket tests passed!');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  } finally {
    if (client) {
      client.disconnect();
    }
    cleanup();
  }
}

// Only run if server is available
runSocketTests().catch(err => {
  console.error('Test suite failed:', err.message);
  process.exit(1);
});