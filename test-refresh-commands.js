#!/usr/bin/env node

import { io } from 'socket.io-client';

const TERMINAL_KEY = 'testkey12345';
const SERVER_URL = 'http://localhost:5174';

console.log('Testing command refresh functionality...');
console.log('=======================================');

async function testCommandRefresh() {
    // First, create a Claude session via API
    console.log('\n1. Creating Claude session via API...');

    const sessionResponse = await fetch(`${SERVER_URL}/api/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            type: 'claude',
            workspacePath: '/tmp/test-workspace',
            options: {}
        })
    });

    const sessionData = await sessionResponse.json();
    console.log('Session created:', sessionData);

    const sessionId = sessionData.id;
    const claudeId = sessionData.claudeId;

    // Connect to Socket.IO
    console.log('\n2. Connecting to Socket.IO...');
    const socket = io(SERVER_URL, {
        transports: ['websocket', 'polling']
    });

    return new Promise((resolve) => {
        socket.on('connect', () => {
            console.log('Connected to Socket.IO, id:', socket.id);

            // Listen for tools.list events
            socket.on('tools.list', (data) => {
                console.log('\n📥 Received tools.list event:', {
                    sessionId: data.sessionId,
                    commandCount: data.commands?.length || 0,
                    firstCommand: data.commands?.[0]
                });
            });

            // Test 1: Request commands for a non-existent session
            console.log('\n3. Testing commands.refresh for non-existent session...');
            socket.emit('commands.refresh', {
                key: TERMINAL_KEY,
                sessionId: 'non-existent-session'
            }, (response) => {
                console.log('Response for non-existent session:', response);

                // Test 2: Request commands for our created session
                console.log('\n4. Testing commands.refresh for our session...');
                socket.emit('commands.refresh', {
                    key: TERMINAL_KEY,
                    sessionId: sessionId
                }, (response) => {
                    console.log('Response for our session:', {
                        success: response.success,
                        sessionId: response.sessionId,
                        commandCount: response.commands?.length || 0,
                        error: response.error
                    });

                    if (response.commands && response.commands.length > 0) {
                        console.log('\n✅ Commands received:');
                        response.commands.slice(0, 5).forEach((cmd, i) => {
                            console.log(`  ${i + 1}. ${cmd.name || cmd.title || cmd}`);
                        });
                        if (response.commands.length > 5) {
                            console.log(`  ... and ${response.commands.length - 5} more`);
                        }
                    }

                    // Test 3: Try with Claude session ID instead
                    if (claudeId) {
                        console.log('\n5. Testing commands.refresh with Claude ID...');
                        socket.emit('commands.refresh', {
                            key: TERMINAL_KEY,
                            sessionId: claudeId
                        }, (response2) => {
                            console.log('Response for Claude ID:', {
                                success: response2.success,
                                sessionId: response2.sessionId,
                                commandCount: response2.commands?.length || 0,
                                error: response2.error
                            });

                            // Clean up
                            setTimeout(() => {
                                console.log('\n6. Test complete, disconnecting...');
                                socket.disconnect();
                                resolve();
                            }, 1000);
                        });
                    } else {
                        // Clean up
                        setTimeout(() => {
                            console.log('\n5. Test complete, disconnecting...');
                            socket.disconnect();
                            resolve();
                        }, 1000);
                    }
                });
            });
        });

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error.message);
            process.exit(1);
        });
    });
}

// Run the test
testCommandRefresh()
    .then(() => {
        console.log('\n✅ All tests completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });