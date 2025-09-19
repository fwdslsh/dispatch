#!/usr/bin/env node

import { io } from 'socket.io-client';

const socket = io('http://localhost:5173');

socket.on('connect', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Connected to server`);

    console.log(`[${new Date().toLocaleTimeString()}] Testing auth event...`);
    socket.emit('auth', '', (response) => {
        console.log(`[${new Date().toLocaleTimeString()}] Auth response:`, response);
        socket.disconnect();
        process.exit(0);
    });
});

socket.on('disconnect', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Disconnected from server`);
});

socket.on('connect_error', (error) => {
    console.error(`[${new Date().toLocaleTimeString()}] Connection error:`, error);
});

// Exit after 5 seconds
setTimeout(() => {
    console.log(`[${new Date().toLocaleTimeString()}] Test timeout, exiting...`);
    socket.disconnect();
    process.exit(0);
}, 5000);