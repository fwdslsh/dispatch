// tests/test-claude-auth.js
// Test Claude authentication detection

import { io } from 'socket.io-client';

const serverUrl = 'http://localhost:5173';
const projectId = 'd016da94-ed39-45c2-860f-4dc33377b18e';

console.log('🤖 Testing Claude Authentication Detection\n');

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

    // Check Claude authentication (should now be true)
    console.log('🤖 Checking Claude authentication with credentials file:');
    await new Promise((resolve, reject) => {
      client.emit('check-claude-auth', { projectId }, (response) => {
        if (response.success) {
          console.log(`   ✅ Authentication check successful`);
          console.log(`   📁 Project ID: ${response.projectId}`);
          console.log(`   🔐 Authenticated: ${response.authenticated ? '✅ YES' : '❌ NO'}`);
          console.log(`   📄 Credentials Path: ${response.credentialsPath}\n`);
          
          if (response.authenticated) {
            console.log('🎉 Claude credentials detected successfully!');
          } else {
            console.log('❌ Claude credentials not detected');
          }
          
          resolve();
        } else {
          reject(new Error(`Claude auth check failed: ${response.error}`));
        }
      });
    });
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
  
  client.disconnect();
});

client.on('connect_error', (err) => {
  console.error('❌ Connection failed:', err.message);
  console.log('Make sure the server is running with: npm run dev');
  process.exit(1);
});