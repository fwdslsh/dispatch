// tests/list-projects.js
// List all available projects

import { io } from 'socket.io-client';

const serverUrl = 'http://localhost:5173';

console.log('📋 Listing all projects...\n');

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
    await new Promise((resolve, reject) => {
      client.emit('list-projects', (response) => {
        if (response.success) {
          console.log(`Found ${response.projects.length} projects:\n`);
          response.projects.forEach(project => {
            console.log(`📁 ${project.name}`);
            console.log(`   ID: ${project.id}`);
            console.log(`   Description: ${project.description || 'No description'}`);
            console.log(`   Created: ${project.createdAt || 'Unknown'}\n`);
          });
          resolve();
        } else {
          reject(new Error(`Failed to list projects: ${response.error}`));
        }
      });
    });
    
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
  
  client.disconnect();
});

client.on('connect_error', (err) => {
  console.error('❌ Connection failed:', err.message);
  console.log('Make sure the server is running with: npm run dev');
  process.exit(1);
});