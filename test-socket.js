#!/usr/bin/env node

import { io } from 'socket.io-client';

const socket = io('http://localhost:5173');

socket.on('connect', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Connected to server`);

    // Test the session we just created
    const sessionId = '1758305679462-quz9ma9u7';

    console.log(`[${new Date().toLocaleTimeString()}] Attempting to start terminal session: ${sessionId}`);

    socket.emit('terminal.start', {
        key: '', // No key required in dev:no-key mode
        sessionId: sessionId
    }, (response) => {
        console.log(`[${new Date().toLocaleTimeString()}] Terminal start response:`, response);

        if (response.success) {
            console.log(`[${new Date().toLocaleTimeString()}] Terminal session ready, sending test command...`);

            // Send a test command
            socket.emit('terminal.write', {
                key: '',
                id: sessionId,
                data: 'echo "Hello from Socket.IO!"\n'
            });
        } else {
            console.error(`[${new Date().toLocaleTimeString()}] Failed to start terminal:`, response.error);
            process.exit(1);
        }
    });

    // Listen for terminal output
    socket.on('terminal.output', (data) => {
        console.log(`[${new Date().toLocaleTimeString()}] Terminal output from ${data.sessionId}:`, JSON.stringify(data.data));
    });
});

socket.on('disconnect', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Disconnected from server`);
});

socket.on('connect_error', (error) => {
    console.error(`[${new Date().toLocaleTimeString()}] Connection error:`, error);
});

// Exit after 10 seconds
setTimeout(() => {
    console.log(`[${new Date().toLocaleTimeString()}] Test complete, exiting...`);
    socket.disconnect();
    process.exit(0);
}, 10000);