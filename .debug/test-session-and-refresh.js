#!/usr/bin/env node

import { io } from 'socket.io-client';

const TERMINAL_KEY = 'testkey12345';
const SERVER_URL = 'http://localhost:5174';

console.log('Testing session creation and command refresh...');
console.log('=============================================');

async function test() {
	// Create a Claude session via API
	console.log('\n1. Creating Claude session via API...');

	const sessionResponse = await fetch(`${SERVER_URL}/api/sessions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			type: 'claude',
			workspacePath: '/home/founder3/code/github/fwdslsh/dispatch',
			options: {}
		})
	});

	const sessionData = await sessionResponse.json();
	console.log('Session created:', sessionData);

	const sessionId = sessionData.id;
	const claudeId = sessionData.typeSpecificId;

	// Connect to Socket.IO
	console.log('\n2. Connecting to Socket.IO...');
	const socket = io(SERVER_URL);

	return new Promise((resolve) => {
		socket.on('connect', () => {
			console.log('Connected to Socket.IO, id:', socket.id);

			// Listen for tools.available events
			socket.on('claude.tools.available', (data) => {
				console.log('\n📥 Received claude.tools.available event:');
				console.log('  Session ID:', data.sessionId);
				console.log('  Command count:', data.commands?.length || 0);
				console.log(
					'  Sample commands:',
					data.commands?.slice(0, 3).map((c) => c.name || c.title || c)
				);
			});

			// Wait a bit for any automatic events, then trigger a refresh
			setTimeout(() => {
				console.log('\n3. Manually triggering command refresh...');
				socket.emit(
					'claude.commands.refresh',
					{
						key: TERMINAL_KEY,
						sessionId: sessionId
					},
					(response) => {
						console.log('\n4. Refresh response:');
						console.log('  Success:', response.success);
						console.log('  Command count:', response.commands?.length || 0);
						console.log(
							'  Sample commands:',
							response.commands?.slice(0, 3).map((c) => c.name || c.title || c)
						);

						// Clean up after a delay
						setTimeout(() => {
							console.log('\n5. Test complete, disconnecting...');
							socket.disconnect();
							resolve();
						}, 2000);
					}
				);
			}, 3000);
		});

		socket.on('connect_error', (error) => {
			console.error('Connection error:', error.message);
			process.exit(1);
		});
	});
}

test()
	.then(() => {
		console.log('\n✅ Test completed');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\n❌ Test failed:', error);
		process.exit(1);
	});
