#!/usr/bin/env node
/**
 * Dynamic test client that captures actual session IDs
 */

import { io } from 'socket.io-client';

const socket = io('http://localhost:5174', {
    transports: ['websocket', 'polling']
});

console.log('Connecting to Socket.IO...');

let sessionId = null;

socket.on('connect', () => {
    console.log('Connected to Socket.IO server');

    console.log('Testing authentication...');
    socket.emit('auth', 'testkey12345', (response) => {
        console.log('Auth response:', response);

        if (response?.success) {
            console.log('Creating terminal session...');

            const sessionData = {
                key: 'testkey12345',
                workspacePath: '/home/founder3/code',
                shell: '/bin/bash',
                env: {}
            };

            socket.emit('terminal.start', sessionData, (createResponse) => {
                console.log('Terminal session response:', createResponse);

                if (createResponse?.success) {
                    sessionId = createResponse.id;
                    console.log(`✅ Session created with ID: ${sessionId}`);

                    // Now test Claude send with the actual session ID
                    setTimeout(() => {
                        console.log(`Testing Claude send with session ID: ${sessionId}`);
                        socket.emit('claude.send', {
                            key: 'testkey12345',
                            id: sessionId,
                            input: '/help'
                        });
                    }, 1000);

                    // Test command refresh
                    setTimeout(() => {
                        console.log(`Testing commands refresh with session ID: ${sessionId}`);
                        socket.emit('commands.refresh', {
                            key: 'testkey12345',
                            sessionId: sessionId
                        }, (commandsResponse) => {
                            console.log('Commands refresh response:', commandsResponse);
                        });
                    }, 2000);
                } else {
                    console.error('Failed to create session:', createResponse);
                }
            });
        } else {
            console.error('Authentication failed:', response);
        }
    });
});

socket.on('tools.list', (data) => {
    console.log('=== RECEIVED tools.list EVENT ===');
    console.log('Session ID:', data.sessionId);
    console.log('Commands count:', data.commands?.length || 0);
    console.log('First few commands:', data.commands?.slice(0, 3));
    console.log('=====================================');

    if (data.commands?.length > 0) {
        console.log('✅ SUCCESS: Commands received! Test completed.');
        setTimeout(() => {
            socket.disconnect();
            process.exit(0);
        }, 1000);
    }
});

socket.on('session.status', (data) => {
    console.log('=== RECEIVED session.status EVENT ===');
    console.log('Session ID:', data.sessionId);
    console.log('Available commands count:', data.availableCommands?.length || 0);
    console.log('======================================');
});

socket.on('message.delta', (events) => {
    console.log('=== RECEIVED message.delta EVENT ===');
    console.log('Events count:', events?.length || 0);
    if (events && events.length > 0) {
        console.log('First event:', events[0]);
    }
    console.log('====================================');
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
});

socket.on('disconnect', () => {
    console.log('Disconnected from Socket.IO server');
});

// Timeout after 30 seconds
setTimeout(() => {
    console.log('❌ Test timeout - no commands received');
    socket.disconnect();
    process.exit(1);
}, 30000);