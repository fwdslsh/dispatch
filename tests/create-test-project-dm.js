// tests/create-test-project-dm.js
// Create a test project using DirectoryManager for end-to-end testing

import { TerminalManager } from '../src/lib/server/terminal.js';
import fs from 'fs';

console.log('🛠️  Creating test project using DirectoryManager...\n');

async function createTestProject() {
  try {
    const terminalManager = new TerminalManager();
    
    // Create a test project
    const projectInfo = await terminalManager.directoryManager.createProject('e2e-test-project', {
      displayName: 'End-to-End Test Project',
      description: 'Test project for working directory e2e testing'
    });
    
    console.log('✅ Created project via DirectoryManager:');
    console.log(`   Name: ${projectInfo.name}`);
    console.log(`   ID: ${projectInfo.id}`);
    console.log(`   Path: ${projectInfo.path}`);
    console.log('');
    
    // Create test directory structure
    const workspaceDir = projectInfo.path + '/workspace';
    const frontendDir = workspaceDir + '/frontend';
    const backendDir = workspaceDir + '/backend';
    const srcDir = frontendDir + '/src';
    const apiDir = backendDir + '/api';
    
    fs.mkdirSync(frontendDir, { recursive: true });
    fs.mkdirSync(backendDir, { recursive: true });
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(apiDir, { recursive: true });
    
    // Create test files
    fs.writeFileSync(workspaceDir + '/README.md', '# E2E Test Project\n\nTest project for working directory functionality.');
    fs.writeFileSync(frontendDir + '/package.json', '{"name": "frontend", "version": "1.0.0"}');
    fs.writeFileSync(srcDir + '/main.js', 'console.log("Frontend main");');
    fs.writeFileSync(backendDir + '/package.json', '{"name": "backend", "version": "1.0.0"}');
    fs.writeFileSync(apiDir + '/server.js', 'console.log("Backend server");');
    
    console.log('✅ Created test directory structure:');
    console.log('   📁 workspace/');
    console.log('      📁 frontend/');
    console.log('         📁 src/');
    console.log('         📄 package.json');
    console.log('      📁 backend/');
    console.log('         📁 api/');
    console.log('         📄 package.json');
    console.log('      📄 README.md');
    console.log('');
    
    // Test directory listing
    console.log('🔍 Testing directory listing...');
    const rootDirs = await terminalManager.listProjectDirectories(projectInfo.id);
    console.log(`   Root directories (${rootDirs.length}):`);
    rootDirs.forEach(dir => {
      console.log(`      ${dir.isDirectory ? '📁' : '📄'} ${dir.name} (${dir.path})`);
    });
    console.log('');
    
    const workspaceDirs = await terminalManager.listProjectDirectories(projectInfo.id, 'workspace');
    console.log(`   Workspace directories (${workspaceDirs.length}):`);
    workspaceDirs.forEach(dir => {
      console.log(`      ${dir.isDirectory ? '📁' : '📄'} ${dir.name} (${dir.path})`);
    });
    console.log('');
    
    // Test Claude authentication
    console.log('🤖 Testing Claude authentication check...');
    const hasClaudeAuth = await import('../src/lib/services/claude-code-service.js')
      .then(mod => mod.claudeCodeService.isAuthenticated());
    
    console.log(`   Claude credentials exist: ${hasClaudeAuth}`);
    console.log(`   Credentials path: ${projectInfo.path}/.claude/credentials.json`);
    console.log('');
    
    console.log('🎉 Test project created successfully!');
    console.log(`   Project ID: ${projectInfo.id}`);
    console.log('   Use this ID for socket-based testing');
    
    return projectInfo;
    
  } catch (err) {
    console.error('❌ Failed to create test project:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

createTestProject();