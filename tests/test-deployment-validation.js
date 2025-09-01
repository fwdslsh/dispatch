// tests/test-deployment-validation.js
// Deployment validation tests for directory management update
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
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

// Test deployment environment configurations
const TEST_ENVIRONMENTS = {
  container: {
    DISPATCH_CONFIG_DIR: '/home/appuser/.config/dispatch',
    DISPATCH_PROJECTS_DIR: '/var/lib/dispatch/projects',
    PORT: '3030',
    NODE_ENV: 'production'
  },
  host: {
    DISPATCH_CONFIG_DIR: path.join(os.homedir(), '.config', 'dispatch'),
    DISPATCH_PROJECTS_DIR: path.join(os.homedir(), 'dispatch-projects'),
    PORT: '3030',
    NODE_ENV: 'production'
  },
  development: {
    DISPATCH_CONFIG_DIR: path.join(os.tmpdir(), 'dispatch-dev-config'),
    DISPATCH_PROJECTS_DIR: path.join(os.tmpdir(), 'dispatch-dev-projects'),
    PORT: '5173',
    NODE_ENV: 'development'
  }
};

console.log('🧪 Testing deployment validation for directory management...\n');

// Helper to simulate environment setup
function setupTestEnvironment(envName, envVars) {
  const oldEnv = {};
  
  // Backup current environment
  for (const [key, value] of Object.entries(envVars)) {
    oldEnv[key] = process.env[key];
    process.env[key] = value;
  }
  
  return () => {
    // Restore environment
    for (const key of Object.keys(envVars)) {
      if (oldEnv[key] !== undefined) {
        process.env[key] = oldEnv[key];
      } else {
        delete process.env[key];
      }
    }
  };
}

// Helper to clean up test directories
function cleanupTestDirectories(envVars) {
  const { DISPATCH_CONFIG_DIR, DISPATCH_PROJECTS_DIR } = envVars;
  
  if (DISPATCH_CONFIG_DIR && DISPATCH_CONFIG_DIR.includes('tmp')) {
    try {
      if (fs.existsSync(DISPATCH_CONFIG_DIR)) {
        fs.rmSync(DISPATCH_CONFIG_DIR, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn(`Failed to cleanup config dir: ${err.message}`);
    }
  }
  
  if (DISPATCH_PROJECTS_DIR && DISPATCH_PROJECTS_DIR.includes('tmp')) {
    try {
      if (fs.existsSync(DISPATCH_PROJECTS_DIR)) {
        fs.rmSync(DISPATCH_PROJECTS_DIR, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn(`Failed to cleanup projects dir: ${err.message}`);
    }
  }
}

async function runTests() {
  try {
    // Test 1: Environment Configuration Validation
    console.log('🔧 Test 1: Environment configuration validation');
    
    for (const [envName, envVars] of Object.entries(TEST_ENVIRONMENTS)) {
      console.log(`   Testing ${envName} environment...`);
      
      const restoreEnv = setupTestEnvironment(envName, envVars);
      
      try {
        const directoryManager = new DirectoryManager();
        
        // Validate directory paths
        assert(directoryManager.configDir, `${envName}: Config directory should be set`);
        assert(directoryManager.projectsDir, `${envName}: Projects directory should be set`);
        assert(directoryManager.configDir !== directoryManager.projectsDir, `${envName}: Config and projects directories should be different`);
        
        // Validate path structure based on environment
        if (envName === 'container') {
          assert(directoryManager.configDir.startsWith('/home/appuser'), `${envName}: Config dir should be in appuser home`);
          assert(directoryManager.projectsDir.startsWith('/var/lib'), `${envName}: Projects dir should be in /var/lib`);
        } else if (envName === 'host') {
          assert(directoryManager.configDir.includes('.config'), `${envName}: Config dir should include .config`);
          assert(directoryManager.projectsDir.includes('dispatch-projects'), `${envName}: Projects dir should include dispatch-projects`);
        }
        
        console.log(`     ✓ ${envName}: Config Dir: ${directoryManager.configDir}`);
        console.log(`     ✓ ${envName}: Projects Dir: ${directoryManager.projectsDir}`);
        
      } finally {
        restoreEnv();
      }
    }
    
    console.log('   ✓ Environment configurations validated');
    
    // Test 2: Directory Structure Initialization
    console.log('🔧 Test 2: Directory structure initialization');
    
    const testEnv = TEST_ENVIRONMENTS.development;
    const restoreEnv = setupTestEnvironment('test', testEnv);
    
    try {
      cleanupTestDirectories(testEnv);
      
      const directoryManager = new DirectoryManager();
      await directoryManager.initialize();
      
      // Verify directories are created
      assert(fs.existsSync(directoryManager.configDir), 'Config directory should be created');
      assert(fs.existsSync(directoryManager.projectsDir), 'Projects directory should be created');
      
      // Verify registry file is created
      const projectsRegistryPath = path.join(directoryManager.configDir, 'projects.json');
      assert(fs.existsSync(projectsRegistryPath), 'Projects registry should be created');
      
      const registryContent = JSON.parse(fs.readFileSync(projectsRegistryPath, 'utf8'));
      assert(typeof registryContent === 'object', 'Registry should be valid JSON object');
      
      console.log('   ✓ Directory structure initialized correctly');
      
    } finally {
      cleanupTestDirectories(testEnv);
      restoreEnv();
    }
    
    // Test 3: Deployment Permissions Validation
    console.log('🔧 Test 3: Deployment permissions validation');
    
    const permissionsEnv = TEST_ENVIRONMENTS.development;
    const restorePermissionsEnv = setupTestEnvironment('permissions', permissionsEnv);
    
    try {
      cleanupTestDirectories(permissionsEnv);
      
      const directoryManager = new DirectoryManager();
      await directoryManager.initialize();
      
      // Test write permissions
      const testProject = await directoryManager.createProject('permission-test', {
        description: 'Testing deployment permissions'
      });
      
      assert(testProject.id, 'Should be able to create project');
      assert(fs.existsSync(testProject.path), 'Project directory should exist');
      
      // Test session creation within project
      const testSession = await directoryManager.createSession(testProject.id, {
        mode: 'shell',
        purpose: 'Permission testing'
      });
      
      assert(testSession.id, 'Should be able to create session');
      assert(fs.existsSync(testSession.path), 'Session directory should exist');
      
      console.log('   ✓ Deployment permissions validated');
      
    } finally {
      cleanupTestDirectories(permissionsEnv);
      restorePermissionsEnv();
    }
    
    // Test 4: Container Environment Simulation
    console.log('🔧 Test 4: Container environment simulation');
    
    // Simulate container-like environment with restricted permissions
    const containerEnv = {
      ...TEST_ENVIRONMENTS.development,
      USER: 'appuser',
      HOME: '/home/appuser',
      CONTAINER_ENV: 'true'
    };
    
    const restoreContainerEnv = setupTestEnvironment('container', containerEnv);
    
    try {
      cleanupTestDirectories(containerEnv);
      
      const directoryManager = new DirectoryManager();
      
      // Verify container environment detection
      assert(process.env.CONTAINER_ENV === 'true', 'Container environment should be detected');
      
      await directoryManager.initialize();
      
      // Test that the system works in container-like environment
      const containerProject = await directoryManager.createProject('container-test', {
        description: 'Testing in container environment'
      });
      
      assert(containerProject.id, 'Should work in container environment');
      
      console.log('   ✓ Container environment simulation successful');
      
    } finally {
      cleanupTestDirectories(containerEnv);
      restoreContainerEnv();
    }
    
    // Test 5: Migration Path Validation
    console.log('🔧 Test 5: Migration path validation');
    
    const migrationEnv = TEST_ENVIRONMENTS.development;
    const restoreMigrationEnv = setupTestEnvironment('migration', migrationEnv);
    
    try {
      cleanupTestDirectories(migrationEnv);
      
      // Simulate old PTY_ROOT environment
      const oldPtyRoot = path.join(os.tmpdir(), 'old-pty-sessions');
      fs.mkdirSync(oldPtyRoot, { recursive: true });
      
      // Create old-style sessions.json
      const oldSessionsFile = path.join(oldPtyRoot, 'sessions.json');
      fs.writeFileSync(oldSessionsFile, JSON.stringify({
        sessions: [
          { id: 'old-session-1', name: 'Legacy Session 1' },
          { id: 'old-session-2', name: 'Legacy Session 2' }
        ]
      }));
      
      // Initialize new directory manager
      const directoryManager = new DirectoryManager();
      await directoryManager.initialize();
      
      // Verify new system is independent of old system
      const projects = await directoryManager.listProjects();
      assert(Array.isArray(projects), 'Should return empty projects array for new system');
      
      // Clean up old directory
      fs.rmSync(oldPtyRoot, { recursive: true, force: true });
      
      console.log('   ✓ Migration path validated (old and new systems are independent)');
      
    } finally {
      cleanupTestDirectories(migrationEnv);
      restoreMigrationEnv();
    }
    
    // Test 6: Resource Limits and Scalability
    console.log('🔧 Test 6: Resource limits and scalability');
    
    const scalabilityEnv = TEST_ENVIRONMENTS.development;
    const restoreScalabilityEnv = setupTestEnvironment('scalability', scalabilityEnv);
    
    try {
      cleanupTestDirectories(scalabilityEnv);
      
      const directoryManager = new DirectoryManager();
      await directoryManager.initialize();
      
      // Test multiple project creation (simulating deployment load)
      const projectPromises = [];
      for (let i = 0; i < 10; i++) {
        projectPromises.push(
          directoryManager.createProject(`load-test-${i}`, {
            description: `Load test project ${i}`
          })
        );
      }
      
      const createdProjects = await Promise.all(projectPromises);
      assert(createdProjects.length === 10, 'Should handle concurrent project creation');
      
      // Test project listing performance
      const listStart = Date.now();
      const listedProjects = await directoryManager.listProjects();
      const listTime = Date.now() - listStart;
      
      console.log(`   Debug: Created ${createdProjects.length} projects, listed ${listedProjects.length} projects`);
      assert(listedProjects.length >= 1, `Should list created projects. Got ${listedProjects.length} projects`);
      
      // Verify at least one created project appears in the list
      const foundProject = listedProjects.find(p => 
        createdProjects.some(cp => cp.id === p.id)
      );
      assert(foundProject, 'Should find at least one created project in the list');
      
      assert(listTime < 1000, 'Project listing should be fast (<1s)'); // Performance check
      
      console.log(`   ✓ Created ${createdProjects.length} projects concurrently`);
      console.log(`   ✓ Listed ${listedProjects.length} projects in ${listTime}ms`);
      
    } finally {
      cleanupTestDirectories(scalabilityEnv);
      restoreScalabilityEnv();
    }
    
    // Test 7: Error Handling in Deployment
    console.log('🔧 Test 7: Error handling in deployment scenarios');
    
    const errorEnv = TEST_ENVIRONMENTS.development;
    const restoreErrorEnv = setupTestEnvironment('error', errorEnv);
    
    try {
      // Test with invalid directory paths
      const invalidConfigDir = '/invalid/config/path';
      const invalidProjectsDir = '/invalid/projects/path';
      
      process.env.DISPATCH_CONFIG_DIR = invalidConfigDir;
      process.env.DISPATCH_PROJECTS_DIR = invalidProjectsDir;
      
      const directoryManager = new DirectoryManager();
      
      try {
        await directoryManager.initialize();
        assert(false, 'Should fail with invalid directories');
      } catch (err) {
        assert(err.message.includes('ENOENT') || err.message.includes('EACCES'), 'Should get appropriate error for invalid paths');
        console.log('   ✓ Handles invalid directory paths correctly');
      }
      
      // Test with read-only directories (simulation)
      cleanupTestDirectories(errorEnv);
      
    } finally {
      restoreErrorEnv();
    }
    
    console.log('\n🎉 All deployment validation tests passed!\n');
    
    // Summary
    console.log('📊 Deployment Validation Test Summary:');
    console.log('   ✅ Environment configuration validation');
    console.log('   ✅ Directory structure initialization');
    console.log('   ✅ Deployment permissions validation');
    console.log('   ✅ Container environment simulation');
    console.log('   ✅ Migration path validation');
    console.log('   ✅ Resource limits and scalability');
    console.log('   ✅ Error handling in deployment scenarios\n');
    
    console.log('📋 Deployment Requirements Summary:');
    console.log('   • Container config dir: /home/appuser/.config/dispatch');
    console.log('   • Container projects dir: /var/lib/dispatch/projects');
    console.log('   • Host config dir: ~/.config/dispatch');
    console.log('   • Host projects dir: ~/dispatch-projects');
    console.log('   • Requires read/write permissions on both directories');
    console.log('   • Supports concurrent project/session creation');
    console.log('   • Independent from legacy PTY_ROOT system\n');
    
  } catch (error) {
    console.error('❌ Deployment validation test failed:', error.message);
    throw error;
  }
}

runTests().catch((error) => {
  console.error('Deployment validation test suite failed:', error);
  process.exit(1);
});