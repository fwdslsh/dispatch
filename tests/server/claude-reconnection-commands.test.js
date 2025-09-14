import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeSessionManager } from '../../src/lib/server/claude/ClaudeSessionManager.js';

// Mock dependencies
vi.mock('@anthropic-ai/claude-code', () => ({
	query: vi.fn()
}));

vi.mock('../../src/lib/server/core/ClaudeProjectsReader.js', () => ({
	ClaudeProjectsReader: vi.fn().mockImplementation(() => ({
		decodeProjectPath: vi.fn()
	}))
}));

vi.mock('../../src/lib/server/claude/cc-root.js', () => ({
	projectsRoot: vi.fn().mockReturnValue('/mock/projects/root')
}));

vi.mock('../../src/lib/server/utils/env.js', () => ({
	buildClaudeOptions: vi.fn()
}));

vi.mock('../../src/lib/server/utils/logger.js', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	}
}));

vi.mock('../../src/lib/server/db/DatabaseManager.js', () => ({
	databaseManager: {
		init: vi.fn(),
		addClaudeSession: vi.fn()
	}
}));

describe('ClaudeSessionManager - Reconnection Command Discovery', () => {
	let manager;
	let mockIO;

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock Socket.IO
		mockIO = {
			emit: vi.fn()
		};

		manager = new ClaudeSessionManager({ io: mockIO });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('refreshCommands method', () => {
		it('should refresh commands for existing session', async () => {
			const sessionId = 'claude-123';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: sessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Set up existing session
			manager.sessions.set(sessionId, sessionData);

			// Mock _fetchAndEmitSupportedCommands to return commands
			const mockCommands = ['clear', 'compact', 'run-tests'];
			vi.spyOn(manager, '_fetchAndEmitSupportedCommands').mockResolvedValue(mockCommands);

			const result = await manager.refreshCommands(sessionId);

			expect(manager._fetchAndEmitSupportedCommands).toHaveBeenCalledWith(sessionId, sessionData);
			expect(result).toEqual(mockCommands);
		});

		it('should return undefined for non-existent session', async () => {
			const result = await manager.refreshCommands('non-existent-session');

			expect(result).toBeUndefined();
		});

		it('should handle errors during command refresh gracefully', async () => {
			const sessionId = 'claude-error';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: sessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Set up existing session
			manager.sessions.set(sessionId, sessionData);

			// Mock _fetchAndEmitSupportedCommands to throw error
			const mockError = new Error('Command fetch failed');
			vi.spyOn(manager, '_fetchAndEmitSupportedCommands').mockRejectedValue(mockError);

			await expect(manager.refreshCommands(sessionId)).rejects.toThrow('Command fetch failed');
		});
	});

	describe('Reconnection scenarios', () => {
		it('should discover commands when client reconnects to cached session', async () => {
			const sessionId = 'claude-cached';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: sessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Set up existing session with cached commands
			manager.sessions.set(sessionId, sessionData);
			const cachedCommands = ['clear', 'help', 'status'];
			manager._toolsCache.set('/test/workspace:/mock/claude', {
				commands: cachedCommands,
				fetchedAt: Date.now()
			});

			// Mock Socket.IO emission
			const result = await manager.refreshCommands(sessionId);

			// Should use cached commands without fetching
			expect(mockIO.emit).toHaveBeenCalledWith('claude.tools.available', {
				sessionId: sessionId,
				commands: cachedCommands
			});
			expect(mockIO.emit).toHaveBeenCalledWith('session.status', {
				sessionId: sessionId,
				availableCommands: cachedCommands
			});
		});

		it('should fetch fresh commands when cache is expired', async () => {
			const sessionId = 'claude-expired';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: sessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Set up existing session with expired cache
			manager.sessions.set(sessionId, sessionData);
			const expiredTime = Date.now() - 6 * 60 * 1000; // 6 minutes ago (TTL is 5 minutes)
			manager._toolsCache.set('/test/workspace:/mock/claude', {
				commands: ['old-command'],
				fetchedAt: expiredTime
			});

			// Mock fresh command fetch
			const freshCommands = ['clear', 'new-feature', 'analyze'];
			const mockQuery = {
				supportedCommands: vi.fn().mockResolvedValue(freshCommands)
			};
			const { query } = await import('@anthropic-ai/claude-code');
			query.mockReturnValue(mockQuery);

			const result = await manager.refreshCommands(sessionId);

			// Should fetch fresh commands and emit them
			expect(mockQuery.supportedCommands).toHaveBeenCalled();
			expect(mockIO.emit).toHaveBeenCalledWith('claude.tools.available', {
				sessionId: sessionId,
				commands: freshCommands
			});
		});

		it('should handle reconnection with app session ID', async () => {
			const claudeSessionId = 'claude-789';
			const appSessionId = 'app-session-123';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: claudeSessionId,
				appSessionId: appSessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Set up existing session
			manager.sessions.set(claudeSessionId, sessionData);
			const commands = ['clear', 'debug'];
			manager._toolsCache.set('/test/workspace:/mock/claude', {
				commands: commands,
				fetchedAt: Date.now()
			});

			const result = await manager.refreshCommands(claudeSessionId);

			// Should emit to both Claude and app session IDs
			expect(mockIO.emit).toHaveBeenCalledWith('claude.tools.available', {
				sessionId: claudeSessionId,
				commands: commands
			});
			expect(mockIO.emit).toHaveBeenCalledWith('claude.tools.available', {
				sessionId: appSessionId,
				commands: commands
			});
			expect(mockIO.emit).toHaveBeenCalledWith('session.status', {
				sessionId: claudeSessionId,
				availableCommands: commands
			});
			expect(mockIO.emit).toHaveBeenCalledWith('session.status', {
				sessionId: appSessionId,
				availableCommands: commands
			});
		});
	});

	describe('Edge cases for reconnection', () => {
		it('should handle session with no cached commands', async () => {
			const sessionId = 'claude-no-cache';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: sessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Set up existing session with no cache
			manager.sessions.set(sessionId, sessionData);
			// No cache entry

			// Mock fresh command fetch
			const freshCommands = ['clear', 'help'];
			const mockQuery = {
				supportedCommands: vi.fn().mockResolvedValue(freshCommands)
			};
			const { query } = await import('@anthropic-ai/claude-code');
			query.mockReturnValue(mockQuery);

			const result = await manager.refreshCommands(sessionId);

			// Should fetch fresh commands since no cache exists
			expect(mockQuery.supportedCommands).toHaveBeenCalled();
			expect(result).toEqual(freshCommands);
		});

		it('should handle command fetch failure during reconnection', async () => {
			const sessionId = 'claude-fetch-fail';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: sessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Set up existing session with no cache
			manager.sessions.set(sessionId, sessionData);

			// Mock command fetch failure
			const mockQuery = {
				supportedCommands: vi.fn().mockRejectedValue(new Error('Claude Code not available'))
			};
			const { query } = await import('@anthropic-ai/claude-code');
			query.mockReturnValue(mockQuery);

			await expect(manager.refreshCommands(sessionId)).rejects.toThrow('Claude Code not available');
		});

		it('should handle session with invalid options', async () => {
			const sessionId = 'claude-invalid';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: sessionId,
				options: null // Invalid options
			};

			// Set up existing session with invalid options
			manager.sessions.set(sessionId, sessionData);

			// Should return without attempting to fetch commands
			const result = await manager.refreshCommands(sessionId);
			expect(result).toBeUndefined();
		});

		it('should handle concurrent refresh requests for same session', async () => {
			const sessionId = 'claude-concurrent';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: sessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Set up existing session
			manager.sessions.set(sessionId, sessionData);

			// Mock slow command fetch
			let resolvePromise;
			const slowPromise = new Promise((resolve) => {
				resolvePromise = resolve;
			});

			const mockQuery = {
				supportedCommands: vi.fn().mockReturnValue(slowPromise)
			};
			const { query } = await import('@anthropic-ai/claude-code');
			query.mockReturnValue(mockQuery);

			// Start two concurrent refresh requests
			const promise1 = manager.refreshCommands(sessionId);
			const promise2 = manager.refreshCommands(sessionId);

			// Resolve the slow promise
			const commands = ['clear', 'concurrent-test'];
			resolvePromise(commands);

			const [result1, result2] = await Promise.all([promise1, promise2]);

			// Both should succeed with same commands
			expect(result1).toEqual(commands);
			expect(result2).toEqual(commands);
		});
	});

	describe('Integration with existing session management', () => {
		it('should work with getCachedCommands after refresh', async () => {
			const sessionId = 'claude-integration';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: sessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Set up existing session
			manager.sessions.set(sessionId, sessionData);

			// Mock fresh command fetch
			const commands = ['clear', 'integration-test'];
			const mockQuery = {
				supportedCommands: vi.fn().mockResolvedValue(commands)
			};
			const { query } = await import('@anthropic-ai/claude-code');
			query.mockReturnValue(mockQuery);

			// Refresh commands
			await manager.refreshCommands(sessionId);

			// getCachedCommands should now return the refreshed commands
			const cachedCommands = manager.getCachedCommands(sessionId);
			expect(cachedCommands).toEqual(commands);
		});

		it('should preserve session data during refresh', async () => {
			const sessionId = 'claude-preserve';
			const originalSessionData = {
				workspacePath: '/test/workspace',
				sessionId: sessionId,
				customProperty: 'should-be-preserved',
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Set up existing session
			manager.sessions.set(sessionId, originalSessionData);

			// Mock command fetch
			const mockQuery = {
				supportedCommands: vi.fn().mockResolvedValue(['clear'])
			};
			const { query } = await import('@anthropic-ai/claude-code');
			query.mockReturnValue(mockQuery);

			await manager.refreshCommands(sessionId);

			// Session data should be preserved
			const preservedSession = manager.sessions.get(sessionId);
			expect(preservedSession).toEqual(originalSessionData);
			expect(preservedSession.customProperty).toBe('should-be-preserved');
		});
	});
});
