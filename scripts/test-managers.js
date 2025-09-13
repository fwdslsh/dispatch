#!/usr/bin/env node

import { historyManager } from '../src/lib/server/history-manager.js';
import { WorkspaceManager } from '../src/lib/server/core/WorkspaceManager.js';
import { TerminalManager } from '../src/lib/server/terminals/TerminalManager.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promises as fs } from 'node:fs';

async function testManagers() {
	console.log('Testing Manager Integration with SQLite');
	console.log('=====================================');

	const testDir = join(tmpdir(), 'dispatch-manager-test');
	await fs.mkdir(testDir, { recursive: true });

	try {
		// Test HistoryManager
		console.log('\n--- Testing HistoryManager ---');
		await historyManager.initializeSocket('test-socket-1', { ip: '127.0.0.1' });
		console.log('✅ Socket initialized');

		await historyManager.addEvent('test-socket-1', 'test.event', 'in', { message: 'test' });
		console.log('✅ Event added');

		const history = await historyManager.getSocketHistory('test-socket-1');
		if (history && history.events.length >= 1) {
			console.log('✅ History retrieved correctly');
		} else {
			throw new Error('History retrieval failed');
		}

		const histories = await historyManager.listSocketHistories();
		if (histories.length >= 1) {
			console.log('✅ Histories listed correctly');
		} else {
			throw new Error('History listing failed');
		}

		await historyManager.finalizeSocket('test-socket-1');
		console.log('✅ Socket finalized');

		// Test WorkspaceManager
		console.log('\n--- Testing WorkspaceManager ---');
		const workspaces = new WorkspaceManager({
			rootDir: testDir
		});

		await workspaces.init();
		console.log('✅ WorkspaceManager initialized');

		const testWorkspace = join(testDir, 'test-workspace');
		await fs.mkdir(testWorkspace, { recursive: true });

		const result = await workspaces.open(testWorkspace);
		if (result.path === testWorkspace) {
			console.log('✅ Workspace opened');
		} else {
			throw new Error('Workspace open failed');
		}

		await workspaces.rememberSession(testWorkspace, {
			id: 'claude_test-session',
			title: 'Test Claude Session',
			type: 'claude'
		});
		console.log('✅ Session remembered');

		const allSessions = await workspaces.getAllSessions();
		if (allSessions.length >= 1) {
			console.log('✅ Sessions retrieved correctly');
		} else {
			throw new Error('Session retrieval failed');
		}

		// Test TerminalManager
		console.log('\n--- Testing TerminalManager ---');
		const terminals = new TerminalManager({ io: null });
		console.log('✅ TerminalManager initialized');

		await terminals.saveTerminalHistory('test-terminal', 'echo "hello"\r\nhello\r\n');
		console.log('✅ Terminal history saved');

		const termHistory = await terminals.loadTerminalHistory('test-terminal');
		if (termHistory.includes('hello')) {
			console.log('✅ Terminal history loaded correctly');
		} else {
			throw new Error('Terminal history load failed');
		}

		await terminals.clearTerminalHistory('test-terminal');
		console.log('✅ Terminal history cleared');

		const clearedHistory = await terminals.loadTerminalHistory('test-terminal');
		if (clearedHistory === '') {
			console.log('✅ Terminal history clear verified');
		} else {
			throw new Error('Terminal history clear failed');
		}

		console.log('\n🎉 All manager integration tests passed!');
		console.log('All managers are working correctly with SQLite storage.');
	} catch (error) {
		console.error('\n❌ Manager integration test failed:', error.message);
		console.error(error.stack);
		process.exit(1);
	} finally {
		// Cleanup
		try {
			await fs.rm(testDir, { recursive: true, force: true });
		} catch (e) {
			// Ignore cleanup errors
		}
	}
}

if (process.argv[1].endsWith('test-managers.js')) {
	testManagers().catch((error) => {
		console.error('Unexpected error:', error);
		process.exit(1);
	});
}
