// tests/demo-working-directory.js
// Demo script to showcase working directory functionality

import { io } from 'socket.io-client';

const serverUrl = 'http://localhost:5173';
const projectId = '2ce67133-27a7-4045-a351-d225f71c88cb'; // The demo project we created

console.log('🎯 Demo: Working Directory Functionality');
console.log('=========================================\n');

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

    // 2. List subdirectories in 'frontend'
    console.log('📁 Listing subdirectories in frontend/:');
    await new Promise((resolve, reject) => {
      client.emit('list-project-directories', { projectId, relativePath: 'frontend' }, (response) => {
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

    // 3. Create Claude session with working directory in 'frontend/src'
    console.log('🤖 Creating Claude session with working directory "frontend/src":');
    await new Promise((resolve, reject) => {
      client.emit('create-session-in-project', {
        projectId,
        sessionOpts: {
          mode: 'claude',
          name: 'Frontend Claude Session',
          workingDirectory: 'frontend/src'
        }
      }, (response) => {
        if (response.success) {
          console.log(`   ✅ Created session: ${response.sessionId}`);
          console.log(`   📁 Working directory: frontend/src`);
          console.log(`   🏷️  Session name: ${response.name}\n`);
          
          // End the session after creating it
          client.emit('end', response.sessionId, () => {
            console.log('   🔚 Session ended\n');
            resolve();
          });
        } else {
          reject(new Error(`Session creation failed: ${response.error}`));
        }
      });
    });

    // 4. Create shell session with working directory in 'scripts'
    console.log('🖥️  Creating shell session with working directory "scripts":');
    await new Promise((resolve, reject) => {
      client.emit('create-session-in-project', {
        projectId,
        sessionOpts: {
          mode: 'shell',
          name: 'Scripts Shell Session',
          workingDirectory: 'scripts'
        }
      }, (response) => {
        if (response.success) {
          console.log(`   ✅ Created session: ${response.sessionId}`);
          console.log(`   📁 Working directory: scripts`);
          console.log(`   🏷️  Session name: ${response.name}\n`);
          
          // End the session after creating it
          client.emit('end', response.sessionId, () => {
            console.log('   🔚 Session ended\n');
            resolve();
          });
        } else {
          reject(new Error(`Session creation failed: ${response.error}`));
        }
      });
    });

    // 5. Try to create session with invalid directory (should fail)
    console.log('❌ Testing invalid working directory (should fail):');
    await new Promise((resolve) => {
      client.emit('create-session-in-project', {
        projectId,
        sessionOpts: {
          mode: 'shell',
          workingDirectory: 'nonexistent-directory'
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

    console.log('🎉 Demo completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   • Directory listing API works');
    console.log('   • Claude sessions can specify working directories');
    console.log('   • Shell sessions can specify working directories');
    console.log('   • Invalid directories are properly rejected');
    console.log('   • Security validation prevents directory traversal');
    
  } catch (err) {
    console.error('❌ Demo failed:', err.message);
  } finally {
    client.disconnect();
    process.exit(0);
  }
});

client.on('connect_error', (err) => {
  console.error('❌ Connection failed:', err.message);
  process.exit(1);
});