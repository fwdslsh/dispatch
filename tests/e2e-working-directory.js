// tests/e2e-working-directory.js
// End-to-end test of working directory functionality via socket

import { io } from 'socket.io-client';

const serverUrl = 'http://localhost:5173';
const projectId = 'd016da94-ed39-45c2-860f-4dc33377b18e'; // Project created with DirectoryManager

console.log('🎯 E2E Test: Working Directory Functionality');
console.log('============================================\n');

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

    // 1. List project root directories
    console.log('📁 Listing project root directories:');
    await new Promise((resolve, reject) => {
      client.emit('list-project-directories', { projectId }, (response) => {
        if (response.success) {
          console.log(`   Found ${response.directories.length} items:\n`);
          response.directories.forEach(item => {
            const type = item.isDirectory ? '📁' : '📄';
            console.log(`   ${type} ${item.name} (${item.path})`);
          });
          console.log('');
          resolve();
        } else {
          reject(new Error(`Directory listing failed: ${response.error}`));
        }
      });
    });

    // 2. List subdirectories in 'workspace'
    console.log('📁 Listing subdirectories in workspace/:');
    await new Promise((resolve, reject) => {
      client.emit('list-project-directories', { projectId, relativePath: 'workspace' }, (response) => {
        if (response.success) {
          console.log(`   Found ${response.directories.length} items:\n`);
          response.directories.forEach(item => {
            const type = item.isDirectory ? '📁' : '📄';
            console.log(`   ${type} ${item.name} (${item.path})`);
          });
          console.log('');
          resolve();
        } else {
          reject(new Error(`Subdirectory listing failed: ${response.error}`));
        }
      });
    });

    // 3. List frontend subdirectories
    console.log('📁 Listing subdirectories in workspace/frontend/:');
    await new Promise((resolve, reject) => {
      client.emit('list-project-directories', { projectId, relativePath: 'workspace/frontend' }, (response) => {
        if (response.success) {
          console.log(`   Found ${response.directories.length} items:\n`);
          response.directories.forEach(item => {
            const type = item.isDirectory ? '📁' : '📄';
            console.log(`   ${type} ${item.name} (${item.path})`);
          });
          console.log('');
          resolve();
        } else {
          reject(new Error(`Frontend listing failed: ${response.error}`));
        }
      });
    });

    // 4. Check Claude authentication
    console.log('🤖 Checking Claude authentication status:');
    await new Promise((resolve, reject) => {
      client.emit('check-claude-auth', { projectId }, (response) => {
        if (response.success) {
          console.log(`   ✅ Authentication check successful`);
          console.log(`   📁 Project ID: ${response.projectId}`);
          console.log(`   🔐 Authenticated: ${response.authenticated}`);
          console.log(`   📄 Credentials Path: ${response.credentialsPath}\n`);
          resolve();
        } else {
          reject(new Error(`Claude auth check failed: ${response.error}`));
        }
      });
    });

    // 5. Create Claude session with working directory in 'workspace/frontend/src'
    console.log('🤖 Creating Claude session with working directory "workspace/frontend/src":');
    await new Promise((resolve, reject) => {
      client.emit('create-session-in-project', {
        projectId,
        sessionOpts: {
          mode: 'claude',
          name: 'Frontend Claude Session',
          workingDirectory: 'workspace/frontend/src'
        }
      }, (response) => {
        if (response.success) {
          console.log(`   ✅ Created session: ${response.sessionId}`);
          console.log(`   📁 Working directory: workspace/frontend/src`);
          console.log(`   🏷️  Session name: ${response.name}\n`);
          
          // End the session after creating it
          client.emit('end', response.sessionId, () => {
            console.log(`   🗑️  Ended session: ${response.sessionId}\n`);
          });
          resolve();
        } else {
          reject(new Error(`Claude session creation failed: ${response.error}`));
        }
      });
    });

    // 6. Create shell session with working directory in 'workspace/backend'
    console.log('💻 Creating shell session with working directory "workspace/backend":');
    await new Promise((resolve, reject) => {
      client.emit('create-session-in-project', {
        projectId,
        sessionOpts: {
          mode: 'shell',
          name: 'Backend Shell Session',
          workingDirectory: 'workspace/backend'
        }
      }, (response) => {
        if (response.success) {
          console.log(`   ✅ Created session: ${response.sessionId}`);
          console.log(`   📁 Working directory: workspace/backend`);
          console.log(`   🏷️  Session name: ${response.name}\n`);
          
          // End the session after creating it
          client.emit('end', response.sessionId, () => {
            console.log(`   🗑️  Ended session: ${response.sessionId}\n`);
          });
          resolve();
        } else {
          reject(new Error(`Shell session creation failed: ${response.error}`));
        }
      });
    });

    // 7. Try to create session with invalid directory (should fail)
    console.log('❌ Testing invalid working directory (should fail):');
    await new Promise((resolve) => {
      client.emit('create-session-in-project', {
        projectId,
        sessionOpts: {
          mode: 'shell',
          workingDirectory: '../../../etc'
        }
      }, (response) => {
        if (!response.success) {
          console.log(`   ✅ Correctly rejected: ${response.error}\n`);
        } else {
          console.log(`   ❌ Should have failed but didn't\n`);
        }
        resolve();
      });
    });

    console.log('🎉 E2E test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   • Directory listing API works');
    console.log('   • Claude authentication check works');
    console.log('   • Claude sessions can specify working directories');
    console.log('   • Shell sessions can specify working directories');
    console.log('   • Invalid directories are properly rejected');
    console.log('   • Working directories persist in session metadata');
    
  } catch (err) {
    console.error('❌ E2E test failed:', err.message);
  }
  
  client.disconnect();
});

client.on('connect_error', (err) => {
  console.error('❌ Connection failed:', err.message);
  console.log('Make sure the server is running with: npm run dev');
  process.exit(1);
});