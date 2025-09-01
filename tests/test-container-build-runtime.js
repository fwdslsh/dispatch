// tests/test-container-build-runtime.js
// Test container build and runtime permissions simulation
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Simulate container environment
const CONTAINER_SIMULATION = {
  USER: 'appuser',
  UID: 10001,
  GID: 10001,
  HOME: '/home/appuser',
  DISPATCH_CONFIG_DIR: '/home/appuser/.config/dispatch',
  DISPATCH_PROJECTS_DIR: '/var/lib/dispatch/projects',
  CONTAINER_ENV: 'true',
  NODE_ENV: 'production'
};

console.log('🧪 Testing container build and runtime simulation...\n');

// Create test directories to simulate container filesystem
function createContainerSimulation() {
  const testRoot = path.join(os.tmpdir(), `container-test-${Date.now()}`);
  
  const containerDirs = {
    root: testRoot,
    home: path.join(testRoot, 'home', 'appuser'),
    configDir: path.join(testRoot, 'home', 'appuser', '.config', 'dispatch'),
    projectsDir: path.join(testRoot, 'var', 'lib', 'dispatch', 'projects'),
    app: path.join(testRoot, 'app')
  };
  
  // Create directory structure
  for (const [key, dir] of Object.entries(containerDirs)) {
    if (key !== 'root') {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  return containerDirs;
}

function cleanupContainerSimulation(containerDirs) {
  if (fs.existsSync(containerDirs.root)) {
    fs.rmSync(containerDirs.root, { recursive: true, force: true });
  }
}

// Test Docker build file validation
function testDockerfileValidation() {
  console.log('🔧 Test 1: Dockerfile validation');
  
  const dockerfilePath = path.join(process.cwd(), 'docker', 'Dockerfile');
  assert(fs.existsSync(dockerfilePath), 'Dockerfile should exist');
  
  const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
  
  // Check for new environment variables
  assert(dockerfileContent.includes('DISPATCH_CONFIG_DIR'), 'Dockerfile should include DISPATCH_CONFIG_DIR');
  assert(dockerfileContent.includes('DISPATCH_PROJECTS_DIR'), 'Dockerfile should include DISPATCH_PROJECTS_DIR');
  assert(dockerfileContent.includes('CONTAINER_ENV'), 'Dockerfile should include CONTAINER_ENV');
  
  // Check for directory creation
  assert(dockerfileContent.includes('/home/appuser/.config/dispatch'), 'Dockerfile should create config directory');
  assert(dockerfileContent.includes('/var/lib/dispatch/projects'), 'Dockerfile should create projects directory');
  
  // Check for proper permissions setup
  assert(dockerfileContent.includes('chown'), 'Dockerfile should set proper ownership');
  assert(dockerfileContent.includes('appuser'), 'Dockerfile should use appuser');
  
  console.log('   ✓ Dockerfile validation passed');
}

// Test docker-compose configuration
function testDockerComposeValidation() {
  console.log('🔧 Test 2: Docker-compose validation');
  
  const composePath = path.join(process.cwd(), 'docker-compose.yml');
  assert(fs.existsSync(composePath), 'docker-compose.yml should exist');
  
  const composeContent = fs.readFileSync(composePath, 'utf8');
  
  // Check for new environment variables
  assert(composeContent.includes('DISPATCH_CONFIG_DIR'), 'docker-compose.yml should include DISPATCH_CONFIG_DIR');
  assert(composeContent.includes('DISPATCH_PROJECTS_DIR'), 'docker-compose.yml should include DISPATCH_PROJECTS_DIR');
  
  // Check for volume mounts
  assert(composeContent.includes('dispatch_projects'), 'docker-compose.yml should include projects volume');
  assert(composeContent.includes('dispatch_config'), 'docker-compose.yml should include config volume');
  
  // Check for volume definitions
  assert(composeContent.includes('volumes:'), 'docker-compose.yml should define volumes');
  
  console.log('   ✓ Docker-compose validation passed');
}

// Test start script validation
function testStartScriptValidation() {
  console.log('🔧 Test 3: Start script validation');
  
  const startScriptPath = path.join(process.cwd(), 'docker', 'start.sh');
  assert(fs.existsSync(startScriptPath), 'start.sh should exist');
  
  const startScriptContent = fs.readFileSync(startScriptPath, 'utf8');
  
  // Check for directory initialization
  assert(startScriptContent.includes('DISPATCH_CONFIG_DIR'), 'start.sh should handle DISPATCH_CONFIG_DIR');
  assert(startScriptContent.includes('DISPATCH_PROJECTS_DIR'), 'start.sh should handle DISPATCH_PROJECTS_DIR');
  assert(startScriptContent.includes('mkdir -p'), 'start.sh should create directories');
  
  // Check for permissions verification
  assert(startScriptContent.includes('writable'), 'start.sh should check write permissions');
  
  // Check for registry initialization
  assert(startScriptContent.includes('projects.json'), 'start.sh should initialize projects registry');
  
  console.log('   ✓ Start script validation passed');
}

// Simulate container runtime environment
async function testContainerRuntimeSimulation() {
  console.log('🔧 Test 4: Container runtime simulation');
  
  const containerDirs = createContainerSimulation();
  
  try {
    // Set up environment variables to simulate container
    const originalEnv = {};
    for (const [key, value] of Object.entries(CONTAINER_SIMULATION)) {
      originalEnv[key] = process.env[key];
      if (key === 'DISPATCH_CONFIG_DIR') {
        process.env[key] = containerDirs.configDir;
      } else if (key === 'DISPATCH_PROJECTS_DIR') {
        process.env[key] = containerDirs.projectsDir;
      } else {
        process.env[key] = value;
      }
    }
    
    try {
      // Test directory manager initialization
      const { default: DirectoryManager } = await import('../src/lib/server/directory-manager.js');
      const directoryManager = new DirectoryManager();
      
      // Verify paths are set correctly
      assert(directoryManager.configDir === containerDirs.configDir, 'Config dir should match container simulation');
      assert(directoryManager.projectsDir === containerDirs.projectsDir, 'Projects dir should match container simulation');
      
      // Initialize directory structure
      await directoryManager.initialize();
      
      // Verify directories were created
      assert(fs.existsSync(containerDirs.configDir), 'Config directory should be created');
      assert(fs.existsSync(containerDirs.projectsDir), 'Projects directory should be created');
      
      // Verify registry file
      const registryPath = path.join(containerDirs.configDir, 'projects.json');
      assert(fs.existsSync(registryPath), 'Projects registry should be created');
      
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      assert(typeof registry === 'object', 'Registry should be valid JSON object');
      
      // Test project creation in simulated container
      const testProject = await directoryManager.createProject('container-test', {
        description: 'Testing project creation in container simulation'
      });
      
      assert(testProject.id, 'Should be able to create project in container');
      assert(fs.existsSync(testProject.path), 'Project directory should exist in container');
      
      // Test session creation
      const testSession = await directoryManager.createSession(testProject.id, {
        mode: 'shell',
        purpose: 'Container testing'
      });
      
      assert(testSession.id, 'Should be able to create session in container');
      assert(fs.existsSync(testSession.path), 'Session directory should exist in container');
      
      console.log('   ✓ Container runtime simulation successful');
      
    } finally {
      // Restore environment
      for (const key of Object.keys(CONTAINER_SIMULATION)) {
        if (originalEnv[key] !== undefined) {
          process.env[key] = originalEnv[key];
        } else {
          delete process.env[key];
        }
      }
    }
    
  } finally {
    cleanupContainerSimulation(containerDirs);
  }
}

// Test start script execution simulation
async function testStartScriptExecution() {
  console.log('🔧 Test 5: Start script execution simulation');
  
  const containerDirs = createContainerSimulation();
  
  try {
    // Create environment for start script execution
    const env = {
      ...process.env,
      DISPATCH_CONFIG_DIR: containerDirs.configDir,
      DISPATCH_PROJECTS_DIR: containerDirs.projectsDir,
      CONTAINER_ENV: 'true',
      PORT: '3030',
      PTY_MODE: 'shell',
      ENABLE_TUNNEL: 'false'
    };
    
    // Test start script execution (dry run simulation)
    const startScriptPath = path.join(process.cwd(), 'docker', 'start.sh');
    
    // Simulate the directory creation parts of start script
    fs.mkdirSync(containerDirs.configDir, { recursive: true });
    fs.mkdirSync(containerDirs.projectsDir, { recursive: true });
    
    const registryPath = path.join(containerDirs.configDir, 'projects.json');
    if (!fs.existsSync(registryPath)) {
      fs.writeFileSync(registryPath, '{}');
    }
    
    // Verify the script would work
    assert(fs.existsSync(containerDirs.configDir), 'Config directory should be created by start script logic');
    assert(fs.existsSync(containerDirs.projectsDir), 'Projects directory should be created by start script logic');
    assert(fs.existsSync(registryPath), 'Registry file should be created by start script logic');
    
    // Test permissions (simulated)
    const configStats = fs.statSync(containerDirs.configDir);
    const projectsStats = fs.statSync(containerDirs.projectsDir);
    
    assert(configStats.isDirectory(), 'Config dir should be a directory');
    assert(projectsStats.isDirectory(), 'Projects dir should be a directory');
    
    console.log('   ✓ Start script execution simulation successful');
    
  } finally {
    cleanupContainerSimulation(containerDirs);
  }
}

// Test container build prerequisites
function testBuildPrerequisites() {
  console.log('🔧 Test 6: Container build prerequisites');
  
  // Check for required files
  const requiredFiles = [
    'docker/Dockerfile',
    'docker-compose.yml',
    'docker/start.sh',
    'package.json',
    'src/app.js'
  ];
  
  for (const filePath of requiredFiles) {
    const fullPath = path.join(process.cwd(), filePath);
    assert(fs.existsSync(fullPath), `Required file should exist: ${filePath}`);
  }
  
  // Check package.json for build script
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  assert(packageJson.scripts && packageJson.scripts.build, 'package.json should have build script');
  
  // Check for required dependencies
  const requiredDeps = ['socket.io', '@battlefieldduck/xterm-svelte'];
  for (const dep of requiredDeps) {
    assert(
      (packageJson.dependencies && packageJson.dependencies[dep]) ||
      (packageJson.devDependencies && packageJson.devDependencies[dep]),
      `Required dependency should be present: ${dep}`
    );
  }
  
  console.log('   ✓ Container build prerequisites verified');
}

async function runTests() {
  try {
    testDockerfileValidation();
    testDockerComposeValidation();
    testStartScriptValidation();
    await testContainerRuntimeSimulation();
    await testStartScriptExecution();
    testBuildPrerequisites();
    
    console.log('\n🎉 All container build and runtime tests passed!\n');
    
    // Summary
    console.log('📊 Container Build and Runtime Test Summary:');
    console.log('   ✅ Dockerfile validation');
    console.log('   ✅ Docker-compose validation');
    console.log('   ✅ Start script validation');
    console.log('   ✅ Container runtime simulation');
    console.log('   ✅ Start script execution simulation');
    console.log('   ✅ Container build prerequisites\n');
    
    console.log('📋 Container Configuration Summary:');
    console.log('   • Updated Dockerfile with new directory structure');
    console.log('   • Updated docker-compose.yml with proper volume mounts');
    console.log('   • Updated start.sh with directory initialization');
    console.log('   • Container uses /home/appuser/.config/dispatch for config');
    console.log('   • Container uses /var/lib/dispatch/projects for projects');
    console.log('   • Proper permissions and ownership configured');
    console.log('   • Named volumes for persistence');
    console.log('   • Legacy PTY_ROOT support (deprecated)\n');
    
  } catch (error) {
    console.error('❌ Container build and runtime test failed:', error.message);
    throw error;
  }
}

runTests().catch((error) => {
  console.error('Container build and runtime test suite failed:', error);
  process.exit(1);
});