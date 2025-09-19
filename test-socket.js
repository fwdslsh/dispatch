#!/usr/bin/env node

import { io } from 'socket.io-client';

const socket = io('http://localhost:5173');

socket.on('connect', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Connected to server`);

    // Test the session we just created
    const sessionId = '1758305679462-quz9ma9u7';

    console.log(`[${new Date().toLocaleTimeString()}] Attempting to attach to run:${sessionId}`);

    // Attach to run session and request backlog
    socket.emit('run:attach', { runId: sessionId, afterSeq: 0 }, (response) => {
        console.log(`[${new Date().toLocaleTimeString()}] run:attach response:`, response);

        if (response.success) {
            console.log(`[${new Date().toLocaleTimeString()}] Attached to run:${sessionId}, sending test input...`);

            // Send a test command via unified API
            socket.emit('run:input', { runId: sessionId, data: 'echo "Hello from Socket.IO!"\n' });
        } else {
            console.error(`[${new Date().toLocaleTimeString()}] Failed to attach to run:`, response.error);
            process.exit(1);
        }
    });

    // Listen for run events
    socket.on('run:event', (data) => {
        console.log(`[${new Date().toLocaleTimeString()}] run:event from ${data.runId}:`, data);
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