#!/usr/bin/env node

import { databaseManager } from '../src/lib/server/db/DatabaseManager.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function testDatabase() {
	console.log('Testing SQLite Database Functionality');
	console.log('====================================');
	
	// Use a unique temporary database for testing
	const testDbPath = join(tmpdir(), `dispatch-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
	const testDb = new (await import('../src/lib/server/db/DatabaseManager.js')).DatabaseManager(testDbPath);
	
	try {
		// Initialize database
		await testDb.init();
		console.log('✅ Database initialized');
		
		// Test session creation
		await testDb.createSession('test-session-1', 'socket-123', { 
			ip: '127.0.0.1', 
			userAgent: 'test-agent' 
		});
		console.log('✅ Session created');
		
		// Test session retrieval
		const session = await testDb.getSession('test-session-1');
		if (session && session.metadata.ip === '127.0.0.1') {
			console.log('✅ Session retrieved correctly');
		} else {
			throw new Error('Session retrieval failed');
		}
		
		// Test event logging
		await testDb.addSessionEvent('test-session-1', 'socket-123', 'test.event', 'in', { message: 'Hello' });
		console.log('✅ Event logged');
		
		// Test event retrieval
		const events = await testDb.getSessionHistory('test-session-1');
		if (events.length === 1 && events[0].event_type === 'test.event') {
			console.log('✅ Event retrieved correctly');
		} else {
			throw new Error(`Event retrieval failed - expected 1 event with type 'test.event', got ${events.length} events`);
		}
		
		// Test workspace creation
		await testDb.createWorkspace('/test/workspace');
		console.log('✅ Workspace created');
		
		// Test workspace session
		await testDb.addWorkspaceSession('session-123', '/test/workspace', 'claude', 'claude-456', 'Test Session');
		console.log('✅ Workspace session added');
		
		// Test workspace session retrieval
		const workspaceSessions = await testDb.getWorkspaceSessions('/test/workspace');
		if (workspaceSessions.length === 1 && workspaceSessions[0].title === 'Test Session') {
			console.log('✅ Workspace session retrieved correctly');
		} else {
			throw new Error('Workspace session retrieval failed');
		}
		
		// Test terminal history
		await testDb.addTerminalHistory('term-1', 'echo "hello world"');
		await testDb.addTerminalHistory('term-1', '\r\nhello world\r\n');
		console.log('✅ Terminal history added');
		
		// Test terminal history retrieval
		const termHistory = await testDb.getTerminalHistory('term-1');
		if (termHistory.includes('hello world')) {
			console.log('✅ Terminal history retrieved correctly');
		} else {
			throw new Error('Terminal history retrieval failed');
		}
		
		// Test Claude session
		await testDb.addClaudeSession('claude-1', '/test/workspace', 'claude-session-id', 'app-session-1', true);
		console.log('✅ Claude session added');
		
		// Test Claude session retrieval
		const claudeSession = await testDb.getClaudeSession('claude-1');
		if (claudeSession && claudeSession.resume_capable) {
			console.log('✅ Claude session retrieved correctly');
		} else {
			throw new Error('Claude session retrieval failed');
		}
		
		// Test logging
		await testDb.addLog('info', 'test', 'Test log message', { key: 'value' });
		console.log('✅ Log added');
		
		// Test log retrieval
		const logs = await testDb.getLogs(10, 'test');
		if (logs.length === 1 && logs[0].message === 'Test log message') {
			console.log('✅ Log retrieved correctly');
		} else {
			throw new Error('Log retrieval failed');
		}
		
		// Test session history listing
		const sessionHistories = await testDb.listSessionHistories();
		if (sessionHistories.length >= 1) {
			console.log('✅ Session histories listed correctly');
		} else {
			throw new Error('Session history listing failed');
		}
		
		await testDb.close();
		console.log('✅ Database closed');
		
		// Clean up test database file
		try {
			await import('node:fs').then(fs => fs.promises.unlink(testDbPath));
		} catch (e) {
			// Ignore cleanup errors
		}
		
		console.log('\n🎉 All database tests passed!');
		console.log('SQLite storage is working correctly.');
		
	} catch (error) {
		console.error('\n❌ Database test failed:', error.message);
		console.error(error.stack);
		await testDb.close();
		// Clean up test database file on error too
		try {
			await import('node:fs').then(fs => fs.promises.unlink(testDbPath));
		} catch (e) {
			// Ignore cleanup errors
		}
		process.exit(1);
	}
}

if (process.argv[1].endsWith('test-database.js')) {
	testDatabase().catch(error => {
		console.error('Unexpected error:', error);
		process.exit(1);
	});
}