/**
 * Integration test for workspace environment variables in session creation
 */
import { describe, it, expect } from 'vitest';
import { buildExecEnv, buildClaudeOptions, buildTerminalOptions } from '../../src/lib/server/shared/utils/env.js';

describe('Workspace Environment Variables Integration', () => {
	const testWorkspaceEnv = {
		NODE_ENV: 'development',
		API_KEY: 'test-key-123',
		DEBUG: 'app:*'
	};

	const testSessionEnv = {
		SESSION_ID: 'session-123',
		NODE_ENV: 'production' // Should override workspace NODE_ENV
	};

	it('should merge environment variables with correct precedence in buildExecEnv', () => {
		const env = buildExecEnv({
			cwd: '/test/dir',
			workspaceEnv: testWorkspaceEnv,
			extraEnv: testSessionEnv
		});

		// Session-specific env should override workspace env
		expect(env.NODE_ENV).toBe('production');
		
		// Workspace env should be included
		expect(env.API_KEY).toBe('test-key-123');
		expect(env.DEBUG).toBe('app:*');
		
		// Session-specific env should be included
		expect(env.SESSION_ID).toBe('session-123');

		// System environment should be preserved (PATH should exist)
		expect(env.PATH).toBeDefined();
	});

	it('should apply workspace environment variables in Claude options', () => {
		const claudeOptions = buildClaudeOptions({
			cwd: '/test/dir',
			workspaceEnv: testWorkspaceEnv,
			extraEnv: testSessionEnv
		});

		expect(claudeOptions.env.NODE_ENV).toBe('production'); // Session override
		expect(claudeOptions.env.API_KEY).toBe('test-key-123'); // Workspace
		expect(claudeOptions.env.DEBUG).toBe('app:*'); // Workspace
		expect(claudeOptions.env.SESSION_ID).toBe('session-123'); // Session
	});

	it('should apply workspace environment variables in terminal options', () => {
		const terminalOptions = buildTerminalOptions({
			cwd: '/test/dir',
			workspaceEnv: testWorkspaceEnv,
			extraEnv: testSessionEnv
		});

		expect(terminalOptions.env.NODE_ENV).toBe('production'); // Session override
		expect(terminalOptions.env.API_KEY).toBe('test-key-123'); // Workspace
		expect(terminalOptions.env.DEBUG).toBe('app:*'); // Workspace
		expect(terminalOptions.env.SESSION_ID).toBe('session-123'); // Session
	});

	it('should work without workspace environment variables', () => {
		const env = buildExecEnv({
			cwd: '/test/dir',
			extraEnv: testSessionEnv
		});

		expect(env.NODE_ENV).toBe('production');
		expect(env.SESSION_ID).toBe('session-123');
		expect(env.API_KEY).toBeUndefined();
	});

	it('should work without session-specific environment variables', () => {
		const env = buildExecEnv({
			cwd: '/test/dir',
			workspaceEnv: testWorkspaceEnv
		});

		expect(env.NODE_ENV).toBe('development');
		expect(env.API_KEY).toBe('test-key-123');
		expect(env.DEBUG).toBe('app:*');
		expect(env.SESSION_ID).toBeUndefined();
	});

	it('should preserve system environment variables', () => {
		const originalPath = process.env.PATH;
		
		const env = buildExecEnv({
			cwd: '/test/dir',
			workspaceEnv: testWorkspaceEnv,
			extraEnv: testSessionEnv
		});

		// System PATH should be preserved and enhanced
		expect(env.PATH).toBeDefined();
		expect(env.PATH).toContain('/test/dir/node_modules/.bin');
		if (originalPath) {
			expect(env.PATH).toContain(originalPath);
		}
	});
});