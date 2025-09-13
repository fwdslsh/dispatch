#!/usr/bin/env node

/**
 * Test script to verify both session architectures work correctly
 */

import { SessionManager } from '../src/lib/server/core/SessionManager.js';
import { SessionRouter } from '../src/lib/server/core/SessionRouter.js';
import { WorkspaceManager } from '../src/lib/server/core/WorkspaceManager.js';
import { TerminalManager } from '../src/lib/server/terminals/TerminalManager.js';
import { ClaudeSessionManager } from '../src/lib/server/claude/ClaudeSessionManager.js';
import { databaseManager } from '../src/lib/server/db/DatabaseManager.js';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const testDir = join(process.cwd(), '.test-workspaces');

console.log('Testing Session Architecture...\n');

async function testSessionManager() {
	console.log('=== Testing Simplified SessionManager ===\n');

	// Clean up and create test directory
	try {
		rmSync(testDir, { recursive: true, force: true });
	} catch {}
	mkdirSync(testDir, { recursive: true });

	// Initialize database
	console.log('Initializing database...');
	await databaseManager.init();
	console.log('✓ Database initialized');

	// Initialize components
	const sessionRouter = new SessionRouter();
	const workspaceManager = new WorkspaceManager({ rootDir: testDir });
	const terminalManager = new TerminalManager({ io: null });
	const claudeManager = new ClaudeSessionManager({ io: null });

	await workspaceManager.init();

	// Create SessionManager
	const sessionManager = new SessionManager({
		sessionRouter,
		workspaceManager,
		terminalManager,
		claudeManager
	});

	console.log('✓ SessionManager initialized');

	try {
		// Test 1: Create a PTY session
		console.log('\nTest 1: Creating PTY session...');
		const ptySession = await sessionManager.createSession({
			type: 'pty',
			workspacePath: testDir,
			options: {
				shell: '/bin/bash',
				env: { TEST: 'true' }
			}
		});
		console.log(`✓ PTY session created: ${ptySession.id}`);
		console.log(`  Type-specific ID: ${ptySession.typeSpecificId}`);

		// Test 2: Get session info
		console.log('\nTest 2: Getting session info...');
		const sessionInfo = sessionManager.getSession(ptySession.id);
		console.log(`✓ Session info retrieved:`, {
			id: sessionInfo.id,
			type: sessionInfo.type,
			workspacePath: sessionInfo.workspacePath
		});

		// Test 3: List sessions
		console.log('\nTest 3: Listing sessions...');
		const sessions = sessionManager.listSessions();
		console.log(`✓ Found ${sessions.length} session(s)`);

		// Test 4: Send data to session
		console.log('\nTest 4: Sending data to session...');
		await sessionManager.sendToSession(ptySession.id, 'echo "Hello from test"\n');
		console.log('✓ Data sent to session');

		// Test 5: Resize operation
		console.log('\nTest 5: Testing resize operation...');
		await sessionManager.sessionOperation(ptySession.id, 'resize', {
			cols: 100,
			rows: 30
		});
		console.log('✓ Resize operation completed');

		// Test 6: Stop session
		console.log('\nTest 6: Stopping session...');
		const stopped = await sessionManager.stopSession(ptySession.id);
		console.log(`✓ Session stopped: ${stopped}`);

		// Test 7: Verify session is removed
		console.log('\nTest 7: Verifying session removal...');
		const removedSession = sessionManager.getSession(ptySession.id);
		console.log(`✓ Session removed: ${removedSession === null}`);

		console.log('\n=== All tests passed! ===\n');
	} catch (error) {
		console.error('\n✗ Test failed:', error.message);
		process.exit(1);
	} finally {
		// Clean up
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {}
	}
}

// Run tests
testSessionManager().catch((error) => {
	console.error('Test execution failed:', error);
	process.exit(1);
});
