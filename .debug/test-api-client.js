#!/usr/bin/env node
/**
 * Test Claude session creation via HTTP API (like the UI does)
 */

import { io } from 'socket.io-client';

async function testClaudeSessionCreation() {
    console.log('=== Testing Claude Session Creation via API ===');

    // Step 1: Create Claude session via HTTP API (like the UI)
    console.log('1. Creating Claude session via POST /api/sessions...');

    const sessionData = {
        type: 'claude',
        workspacePath: '/home/founder3/code/github/fwdslsh/dispatch',
        options: {
            projectName: 'test-commands-debug',
            sessionId: null
        }
    };

    try {
        const response = await fetch('http://localhost:5174/api/sessions', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(sessionData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ Claude session created:', result);

        const { id: sessionId, claudeId } = result;

        // Step 2: Connect via Socket.IO and listen for commands
        console.log('2. Connecting to Socket.IO to listen for commands...');

        const socket = io('http://localhost:5174', {
            transports: ['websocket', 'polling']
        });

        let toolsReceived = false;

        socket.on('connect', () => {
            console.log('✅ Socket.IO connected');

            // Step 3: Send a Claude message to trigger command discovery
            console.log('3. Sending Claude message to trigger command discovery...');

            setTimeout(() => {
                console.log(`Sending Claude message to session ${sessionId}...`);
                socket.emit('claude.send', {
                    key: 'testkey12345',
                    id: sessionId,
                    input: '/help'
                });
            }, 1000);

            // Also try command refresh
            setTimeout(() => {
                console.log('4. Requesting command refresh...');
                socket.emit('commands.refresh', {
                    key: 'testkey12345',
                    sessionId: sessionId
                }, (commandsResponse) => {
                    console.log('Commands refresh response:', commandsResponse);
                });
            }, 2000);
        });

        socket.on('tools.list', (data) => {
            console.log('🎉 RECEIVED tools.list EVENT!');
            console.log('Session ID:', data.sessionId);
            console.log('Commands count:', data.commands?.length || 0);
            console.log('Commands preview:', data.commands?.slice(0, 5).map(c => c.name || c.title || c));
            toolsReceived = true;

            console.log('✅ SUCCESS: Command discovery working!');
            setTimeout(() => {
                socket.disconnect();
                process.exit(0);
            }, 1000);
        });

        socket.on('session.status', (data) => {
            console.log('📊 RECEIVED session.status EVENT');
            console.log('Session ID:', data.sessionId);
            console.log('Available commands count:', data.availableCommands?.length || 0);
        });

        socket.on('message.delta', (events) => {
            console.log('💬 RECEIVED message.delta EVENT');
            console.log('Events count:', events?.length || 0);

            // Look for command-related events
            if (events && events.length > 0) {
                const commandEvents = events.filter(e =>
                    e?.type === 'command' ||
                    (e?.content && typeof e.content === 'string' && e.content.includes('/'))
                );
                if (commandEvents.length > 0) {
                    console.log('Command-related events:', commandEvents.length);
                }
            }
        });

        socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
        });

        socket.on('disconnect', () => {
            console.log('Socket.IO disconnected');
        });

        // Timeout after 15 seconds
        setTimeout(() => {
            if (!toolsReceived) {
                console.log('❌ TIMEOUT: No tools.list event received within 15 seconds');
                socket.disconnect();
                process.exit(1);
            }
        }, 15000);

    } catch (error) {
        console.error('❌ Failed to create Claude session:', error);
        process.exit(1);
    }
}

testClaudeSessionCreation();