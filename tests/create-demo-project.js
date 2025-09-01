// tests/create-demo-project.js
// Create the demo project for working directory testing

import { io } from 'socket.io-client';

const serverUrl = 'http://localhost:5173';
const projectId = '8f11a917-6a2b-494f-957b-e2bf022fc1da';

console.log('🛠️  Creating demo project for working directory tests...\n');

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

    // Create project with the specific ID
    await new Promise((resolve, reject) => {
      client.emit('create-project', {
        id: projectId,
        name: 'demo-working-directory',
        description: 'Demo project for working directory functionality'
      }, (response) => {
        if (response.success) {
          console.log(`✅ Created project: ${response.project.name}`);
          console.log(`   ID: ${response.project.id}`);
          console.log(`   Path: ${response.project.path}\n`);
          resolve();
        } else {
          console.log(`⚠️  Project creation: ${response.error}\n`);
          resolve(); // Continue even if project already exists
        }
      });
    });

    console.log('🎉 Demo project setup completed!');
    console.log('You can now run: node tests/demo-working-directory.js\n');
    
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
  }
  
  client.disconnect();
});

client.on('connect_error', (err) => {
  console.error('❌ Connection failed:', err.message);
  console.log('Make sure the server is running with: npm run dev');
  process.exit(1);
});