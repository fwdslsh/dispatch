#!/usr/bin/env node
/**
 * Manual test script to validate session management fixes
 * This script tests the core functionality that was fixed
 */

import { io } from 'socket.io-client';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5173';
const TEST_KEY = 'testkey12345';

async function testWorkspaceCreation() {
	console.log('🔍 Testing workspace creation...');

	// Use the workspaces root directory structure
	const testPath = '.dispatch-home/workspaces/test-directory';

	const response = await fetch(`${BASE_URL}/api/workspaces`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'open',
			path: testPath
		})
	});

	if (response.ok) {
		const data = await response.json();
		console.log('✅ Workspace creation successful:', data);
		return data.path;
	} else {
		console.error('❌ Workspace creation failed:', response.status);
		return null;
	}
}

async function testClaudeSessionCreation(workspacePath) {
	console.log('🔍 Testing Claude session creation with working directory...');

	const response = await fetch(`${BASE_URL}/api/sessions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			type: 'claude',
			workspacePath,
			options: {
				projectName: 'Test Project',
				resumeSession: false
			}
		})
	});

	if (response.ok) {
		const data = await response.json();
		console.log('✅ Claude session creation successful:', data);
		return data.id;
	} else {
		console.error('❌ Claude session creation failed:', response.status);
		const error = await response.text();
		console.error('Error details:', error);
		return null;
	}
}

async function testTerminalSessionCreation(workspacePath) {
	console.log('🔍 Testing terminal session creation...');

	const response = await fetch(`${BASE_URL}/api/sessions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			type: 'pty',
			workspacePath,
			options: {
				resumeSession: false
			}
		})
	});

	if (response.ok) {
		const data = await response.json();
		console.log('✅ Terminal session creation successful:', data);
		return data.id;
	} else {
		console.error('❌ Terminal session creation failed:', response.status);
		return null;
	}
}

async function testSocketConnection(sessionId, type) {
	console.log(`🔍 Testing socket connection for ${type} session ${sessionId}...`);

	return new Promise((resolve) => {
		const socket = io(BASE_URL, {
			query: { sessionId }
		});

		socket.on('connect', () => {
			console.log(`✅ Socket connected for session ${sessionId}`);

			if (type === 'claude') {
				// Test Claude message
				socket.emit('claude.send', {
					key: TEST_KEY,
					id: sessionId,
					input: 'What is my current working directory? Please use pwd command to show me.'
				});

				socket.on('message.delta', (data) => {
					console.log('📤 Claude response received:', data);
				});

				setTimeout(() => {
					socket.disconnect();
					resolve(true);
				}, 5000);
			} else {
				// Test terminal
				socket.emit(
					'terminal.start',
					{
						key: TEST_KEY,
						workspacePath: '/workspace/test-directory'
					},
					(response) => {
						console.log('📤 Terminal response:', response);
						socket.disconnect();
						resolve(response.success);
					}
				);
			}
		});

		socket.on('connect_error', (error) => {
			console.error(`❌ Socket connection failed for session ${sessionId}:`, error.message);
			resolve(false);
		});

		setTimeout(() => {
			console.log(`⏰ Socket test timed out for session ${sessionId}`);
			socket.disconnect();
			resolve(false);
		}, 10000);
	});
}

async function testSessionListing() {
	console.log('🔍 Testing session listing...');

	const response = await fetch(`${BASE_URL}/api/sessions`);

	if (response.ok) {
		const data = await response.json();
		console.log('✅ Session listing successful:', data.sessions.length, 'sessions found');
		data.sessions.forEach((session) => {
			console.log(`  - ${session.type} session: ${session.id} @ ${session.workspacePath}`);
		});
		return data.sessions;
	} else {
		console.error('❌ Session listing failed:', response.status);
		return [];
	}
}

async function runTests() {
	console.log('🚀 Starting session management tests...\n');

	try {
		// Test 1: Workspace creation
		const workspacePath = await testWorkspaceCreation();
		if (!workspacePath) {
			console.log('❌ Cannot proceed without workspace');
			return;
		}
		console.log('');

		// Test 2: Session creation
		const claudeSessionId = await testClaudeSessionCreation(workspacePath);
		const terminalSessionId = await testTerminalSessionCreation(workspacePath);
		console.log('');

		// Test 3: Session listing
		await testSessionListing();
		console.log('');

		// Test 4: Socket connections (only if Claude is available)
		if (claudeSessionId) {
			await testSocketConnection(claudeSessionId, 'claude');
			console.log('');
		}

		if (terminalSessionId) {
			await testSocketConnection(terminalSessionId, 'terminal');
			console.log('');
		}

		console.log('🎉 All tests completed!');
	} catch (error) {
		console.error('💥 Test failed with error:', error);
	}
}

// Run tests
runTests()
	.then(() => {
		console.log('✨ Test run finished');
		process.exit(0);
	})
	.catch((error) => {
		console.error('Fatal error:', error);
		process.exit(1);
	});
