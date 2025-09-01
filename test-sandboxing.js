#!/usr/bin/env node

/**
 * Test script for project sandboxing functionality
 * Verifies that project creation properly initializes sandbox environment
 */

// Set up test environment BEFORE importing modules
const TEST_PTY_ROOT = '/tmp/test-dispatch-sessions';
const TEST_HOST_HOME = '/tmp/test-host-home';

process.env.PTY_ROOT = TEST_PTY_ROOT;
process.env.HOST_HOME_DIR = TEST_HOST_HOME;
process.env.PROJECT_SANDBOX_ENABLED = 'true';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProject } from './src/lib/server/project-store.js';
import { TerminalManager } from './src/lib/server/terminal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Clean up test environment
function cleanup() {
  if (fs.existsSync(TEST_PTY_ROOT)) {
    fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });
  }
  if (fs.existsSync(TEST_HOST_HOME)) {
    fs.rmSync(TEST_HOST_HOME, { recursive: true, force: true });
  }
}

// Set up test host home with mock config files
function setupTestHostHome() {
  fs.mkdirSync(TEST_HOST_HOME, { recursive: true });
  
  // Create mock config files
  fs.writeFileSync(path.join(TEST_HOST_HOME, '.gitconfig'), '[user]\n  name = Test User\n  email = test@example.com\n');
  fs.writeFileSync(path.join(TEST_HOST_HOME, '.bashrc'), '# Test bashrc\nexport PATH=$PATH:/test/bin\n');
  fs.writeFileSync(path.join(TEST_HOST_HOME, '.vimrc'), '" Test vimrc\nset number\n');
  
  // Create mock config directories
  fs.mkdirSync(path.join(TEST_HOST_HOME, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(TEST_HOST_HOME, '.claude', 'config.json'), '{"test": true}\n');
  
  fs.mkdirSync(path.join(TEST_HOST_HOME, '.config', 'gh'), { recursive: true });
  fs.writeFileSync(path.join(TEST_HOST_HOME, '.config', 'gh', 'hosts.yml'), 'github.com:\n  oauth_token: test\n');
}

async function runTests() {
  console.log('🧪 Testing Project Sandboxing');
  console.log('==============================');
  
  let passed = 0;
  let failed = 0;
  
  function assert(condition, message) {
    if (condition) {
      console.log(`✅ ${message}`);
      passed++;
    } else {
      console.log(`❌ ${message}`);
      failed++;
    }
  }
  
  try {
    // Setup
    cleanup();
    setupTestHostHome();
    
    console.log('\n📁 Test 1: Project Creation with Sandbox Initialization');
    console.log('--------------------------------------------------------');
    
    // Test project creation
    const project = createProject({
      name: 'test-project',
      description: 'Test project for sandboxing'
    });
    
    assert(project.id, 'Project should have an ID');
    assert(project.name === 'test-project', 'Project should have correct name');
    
    const projectDir = path.join(TEST_PTY_ROOT, project.id);
    assert(fs.existsSync(projectDir), 'Project directory should be created');
    
    // Test config file copying
    assert(fs.existsSync(path.join(projectDir, '.gitconfig')), '.gitconfig should be copied');
    assert(fs.existsSync(path.join(projectDir, '.bashrc')), '.bashrc should be copied');
    assert(fs.existsSync(path.join(projectDir, '.vimrc')), '.vimrc should be copied');
    assert(fs.existsSync(path.join(projectDir, '.bash_history')), '.bash_history should be created');
    
    // Test config directory copying
    assert(fs.existsSync(path.join(projectDir, '.claude', 'config.json')), '.claude config should be copied');
    assert(fs.existsSync(path.join(projectDir, '.config', 'gh', 'hosts.yml')), 'gh config should be copied');
    
    // Verify file contents
    const gitconfig = fs.readFileSync(path.join(projectDir, '.gitconfig'), 'utf8');
    assert(gitconfig.includes('Test User'), 'Gitconfig content should be copied correctly');
    
    console.log('\n🔧 Test 2: Terminal Session Creation in Project');
    console.log('------------------------------------------------');
    
    // Test terminal session creation - skip for now due to pty dependency
    console.log('Skipping terminal session test (requires pty)');
    
    console.log('\n🚫 Test 3: Sandboxing Disabled');
    console.log('-------------------------------');
    
    // Test with sandboxing disabled
    process.env.PROJECT_SANDBOX_ENABLED = 'false';
    cleanup();
    setupTestHostHome();
    
    const disabledProject = createProject({
      name: 'disabled-project',
      description: 'Test project with sandboxing disabled'
    });
    
    const disabledProjectDir = path.join(TEST_PTY_ROOT, disabledProject.id);
    assert(fs.existsSync(disabledProjectDir), 'Project directory should still be created');
    assert(!fs.existsSync(path.join(disabledProjectDir, '.gitconfig')), 'Config files should not be copied when disabled');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    failed++;
  } finally {
    cleanup();
  }
  
  console.log('\n📊 Test Results');
  console.log('===============');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📋 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Project sandboxing is working correctly.');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed. Please check the implementation.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (process.argv[1] === __filename) {
  runTests().catch(console.error);
}

export { runTests };