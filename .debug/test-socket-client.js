#!/usr/bin/env node
/**
 * Test Socket.IO client to simulate Claude session creation and debug command loading
 */

import { io } from 'socket.io-client';

const socket = io('http://localhost:5174', {
	transports: ['websocket', 'polling']
});

console.log('Connecting to Socket.IO...');

socket.on('connect', () => {
	console.log('Connected to Socket.IO server');

	console.log('Testing authentication...');
	socket.emit('auth', 'testkey12345');

	setTimeout(() => {
		console.log('Testing terminal session creation...');
		const sessionData = {
			key: 'testkey12345',
			workspacePath: '/home/founder3/code',
			shell: '/bin/bash',
			env: {}
		};
		socket.emit('terminal.start', sessionData);
	}, 1000);

	setTimeout(() => {
		console.log('Testing Claude send with unified session ID...');
		socket.emit('claude.send', {
			key: 'testkey12345',
			id: 'b6455005-6cc1-405f-a003-936acfae018e',
			input: 'hello'
		});
	}, 2000);

	setTimeout(() => {
		console.log('Testing commands refresh...');
		socket.emit('commands.refresh', {
			key: 'testkey12345',
			sessionId: 'b6455005-6cc1-405f-a003-936acfae018e'
		});
	}, 3000);
});

socket.on('tools.list', (data) => {
	console.log('=== RECEIVED tools.list EVENT ===');
	console.log('Session ID:', data.sessionId);
	console.log('Commands count:', data.commands?.length || 0);
	console.log('First few commands:', data.commands?.slice(0, 3));
	console.log('=====================================');
	cancelTimeout();
});

socket.on('session.status', (data) => {
	console.log('=== RECEIVED session.status EVENT ===');
	console.log('Session ID:', data.sessionId);
	console.log('Available commands count:', data.availableCommands?.length || 0);
	console.log('======================================');
});

socket.on('error', (error) => {
	console.error('Socket error:', error);
});

socket.on('disconnect', () => {
	console.log('Disconnected from Socket.IO server');
});

// Keep alive for 60 seconds
let timeoutId = setTimeout(() => {
	console.log('Test timeout after 60 seconds, disconnecting...');
	socket.disconnect();
	process.exit(0);
}, 60000);

// Cancel timeout if we get successful responses
function cancelTimeout() {
	if (timeoutId) {
		clearTimeout(timeoutId);
		timeoutId = null;
		console.log('Test successful, will exit in 10 seconds...');
		setTimeout(() => {
			socket.disconnect();
			process.exit(0);
		}, 10000);
	}
}
