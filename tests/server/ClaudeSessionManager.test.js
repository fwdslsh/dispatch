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

describe('ClaudeSessionManager - Session ID Routing', () => {
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

	describe('_fetchAndEmitSupportedCommands session ID routing', () => {
		it('should emit claude.tools.available with Claude session ID when no app session ID provided', async () => {
			const claudeSessionId = '123';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: claudeSessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Mock the commands cache
			manager._toolsCache.set('/test/workspace:/mock/claude', {
				commands: ['clear', 'compact'],
				fetchedAt: Date.now()
			});

			await manager._fetchAndEmitSupportedCommands(claudeSessionId, sessionData);

			expect(mockIO.emit).toHaveBeenCalledWith('claude.tools.available', {
				sessionId: claudeSessionId,
				commands: ['clear', 'compact']
			});
		});

		it('should emit claude.tools.available with app session ID when provided', async () => {
			const claudeSessionId = '123';
			const appSessionId = 'app-session-456';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: claudeSessionId,
				appSessionId: appSessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Mock the commands cache
			manager._toolsCache.set('/test/workspace:/mock/claude', {
				commands: ['clear', 'compact'],
				fetchedAt: Date.now()
			});

			await manager._fetchAndEmitSupportedCommands(claudeSessionId, sessionData);

			expect(mockIO.emit).toHaveBeenCalledWith('claude.tools.available', {
				sessionId: appSessionId, // Should use appSessionId, not claudeSessionId
				commands: ['clear', 'compact']
			});
		});

		it('should emit session.status with Claude session ID when no app session ID provided', async () => {
			const claudeSessionId = '123';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: claudeSessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Mock the commands cache
			manager._toolsCache.set('/test/workspace:/mock/claude', {
				commands: ['clear', 'compact'],
				fetchedAt: Date.now()
			});

			await manager._fetchAndEmitSupportedCommands(claudeSessionId, sessionData);

			expect(mockIO.emit).toHaveBeenCalledWith('session.status', {
				sessionId: claudeSessionId,
				availableCommands: ['clear', 'compact']
			});
		});

		it('should emit session.status with app session ID when provided', async () => {
			const claudeSessionId = '123';
			const appSessionId = 'app-session-456';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: claudeSessionId,
				appSessionId: appSessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Mock the commands cache
			manager._toolsCache.set('/test/workspace:/mock/claude', {
				commands: ['clear', 'compact'],
				fetchedAt: Date.now()
			});

			await manager._fetchAndEmitSupportedCommands(claudeSessionId, sessionData);

			expect(mockIO.emit).toHaveBeenCalledWith('session.status', {
				sessionId: appSessionId, // Should use appSessionId, not claudeSessionId
				availableCommands: ['clear', 'compact']
			});
		});

		it('should emit to both Claude and app session IDs when both provided', async () => {
			const claudeSessionId = '123';
			const appSessionId = 'app-session-456';
			const sessionData = {
				workspacePath: '/test/workspace',
				sessionId: claudeSessionId,
				appSessionId: appSessionId,
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			// Mock the commands cache
			manager._toolsCache.set('/test/workspace:/mock/claude', {
				commands: ['clear', 'compact'],
				fetchedAt: Date.now()
			});

			await manager._fetchAndEmitSupportedCommands(claudeSessionId, sessionData);

			// Should emit tools.available for both sessions
			expect(mockIO.emit).toHaveBeenCalledWith('claude.tools.available', {
				sessionId: claudeSessionId,
				commands: ['clear', 'compact']
			});
			expect(mockIO.emit).toHaveBeenCalledWith('claude.tools.available', {
				sessionId: appSessionId,
				commands: ['clear', 'compact']
			});

			// Should emit session.status for both sessions
			expect(mockIO.emit).toHaveBeenCalledWith('session.status', {
				sessionId: claudeSessionId,
				availableCommands: ['clear', 'compact']
			});
			expect(mockIO.emit).toHaveBeenCalledWith('session.status', {
				sessionId: appSessionId,
				availableCommands: ['clear', 'compact']
			});

			expect(mockIO.emit).toHaveBeenCalledTimes(4); // 2 tools.available + 2 session.status
		});
	});

	describe('getCachedCommands', () => {
		it('should return cached commands for valid session', () => {
			const sessionId = '123';
			const sessionData = {
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			manager.sessions.set(sessionId, sessionData);
			manager._toolsCache.set('/test/workspace:/mock/claude', {
				commands: ['clear', 'compact'],
				fetchedAt: Date.now()
			});

			const result = manager.getCachedCommands(sessionId);
			expect(result).toEqual(['clear', 'compact']);
		});

		it('should return null for invalid session', () => {
			const result = manager.getCachedCommands('nonexistent');
			expect(result).toBeNull();
		});

		it('should return null for session without cached commands', () => {
			const sessionId = '123';
			const sessionData = {
				options: {
					cwd: '/test/workspace',
					pathToClaudeCodeExecutable: '/mock/claude'
				}
			};

			manager.sessions.set(sessionId, sessionData);
			// No cache entry set

			const result = manager.getCachedCommands(sessionId);
			expect(result).toBeNull();
		});
	});
});
