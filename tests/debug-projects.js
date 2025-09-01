// tests/debug-projects.js
// Debug project listing and directory functionality

import { io } from 'socket.io-client';

const serverUrl = 'http://localhost:5173';

console.log('🔍 Debugging project and directory functionality...\n');

const client = io(serverUrl);

client.on('connect', async () => {
  console.log('✅ Connected to server\n');
  
  try {
    // Authenticate
    await new Promise((resolve, reject) => {
      client.emit('auth', 'test', (response) => {
        if (response.success) {
          console.log('✅ Authenticated\n');
          resolve();
        } else {
          reject(new Error(`Authentication failed: ${response.error}`));
        }
      });
    });

    // List all projects
    console.log('📋 Listing projects...');
    await new Promise((resolve, reject) => {
      client.emit('list-projects', (response) => {
        if (response.success) {
          console.log(`Found ${response.projects.length} projects:`);
          response.projects.forEach(project => {
            console.log(`  📁 ${project.name} (ID: ${project.id})`);
          });
          console.log('');
          resolve();
        } else {
          reject(new Error(`Failed to list projects: ${response.error}`));
        }
      });
    });
    
    // Test directory listing for each project
    const testProjectId = '2ce67133-27a7-4045-a351-d225f71c88cb';
    console.log(`📁 Testing directory listing for project: ${testProjectId}`);
    
    await new Promise((resolve, reject) => {
      client.emit('list-project-directories', { projectId: testProjectId }, (response) => {
        if (response.success) {
          console.log(`✅ Directory listing successful:`);
          console.log(`   Project ID: ${response.projectId}`);
          console.log(`   Relative Path: "${response.relativePath}"`);
          console.log(`   Found ${response.directories.length} items:`);
          response.directories.forEach(item => {
            const type = item.isDirectory ? '📁' : '📄';
            console.log(`     ${type} ${item.name} (${item.path})`);
          });
          console.log('');
          resolve();
        } else {
          console.log(`❌ Directory listing failed: ${response.error}`);
          resolve();
        }
      });
    });

    // Test workspace listing
    console.log('📁 Testing workspace directory listing...');
    await new Promise((resolve, reject) => {
      client.emit('list-project-directories', { 
        projectId: testProjectId, 
        relativePath: 'workspace' 
      }, (response) => {
        if (response.success) {
          console.log(`✅ Workspace listing successful:`);
          console.log(`   Found ${response.directories.length} items:`);
          response.directories.forEach(item => {
            const type = item.isDirectory ? '📁' : '📄';
            console.log(`     ${type} ${item.name} (${item.path})`);
          });
          console.log('');
          resolve();
        } else {
          console.log(`❌ Workspace listing failed: ${response.error}`);
          resolve();
        }
      });
    });

    // Test Claude auth check
    console.log('🤖 Testing Claude authentication check...');
    await new Promise((resolve, reject) => {
      client.emit('check-claude-auth', { projectId: testProjectId }, (response) => {
        if (response.success) {
          console.log(`✅ Claude auth check successful:`);
          console.log(`   Project ID: ${response.projectId}`);
          console.log(`   Authenticated: ${response.authenticated}`);
          console.log(`   Credentials Path: ${response.credentialsPath}`);
          console.log('');
          resolve();
        } else {
          console.log(`❌ Claude auth check failed: ${response.error}`);
          resolve();
        }
      });
    });
    
  } catch (err) {
    console.error('❌ Debug failed:', err.message);
  }
  
  client.disconnect();
});

client.on('connect_error', (err) => {
  console.error('❌ Connection failed:', err.message);
  console.log('Make sure the server is running with: npm run dev');
  process.exit(1);
});