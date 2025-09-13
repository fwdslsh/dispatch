#!/usr/bin/env node

import { io } from 'socket.io-client';

const TERMINAL_KEY = 'testkey12345';
const SERVER_URL = 'http://localhost:5174';

console.log('Testing live session command events...');
console.log('===================================');

const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling']
});

socket.on('connect', () => {
    console.log('Connected to Socket.IO, id:', socket.id);

    // Listen for ALL tools.list events (no filtering)
    socket.on('tools.list', (data) => {
        console.log('\n📥 Received tools.list event:');
        console.log('  Session ID:', data.sessionId);
        console.log('  Command count:', data.commands?.length || 0);
        console.log('  First few commands:', data.commands?.slice(0, 3).map(c => c.name || c.title || c));
    });

    // Also listen for session.status events
    socket.on('session.status', (data) => {
        console.log('\n📊 Received session.status event:');
        console.log('  Session ID:', data.sessionId);
        console.log('  Available commands:', data.availableCommands?.length || 0);
    });

    console.log('\n🎧 Listening for events... (create a Claude session in the UI to see events)');
    console.log('Press Ctrl+C to exit');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error.message);
    process.exit(1);
});

// Keep the process alive
process.on('SIGINT', () => {
    console.log('\n👋 Disconnecting...');
    socket.disconnect();
    process.exit(0);
});