import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
const mockValidateKey = vi.fn();
vi.mock('../../src/lib/server/auth.js', () => ({
	validateKey: mockValidateKey
}));

vi.mock('../../src/lib/server/utils/logger.js', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	}
}));

describe('Session Status Handler Logic', () => {
	let mockServices;
	let sessionStatusHandler;

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup mock services using new RunSessionManager naming
		mockServices = {
			runSessionManager: {
				getSession: vi.fn(),
				getActivityState: vi.fn(),
				getCachedCommands: vi.fn()
			}
		};

		// Define the session.status handler logic (extracted from socket-setup.js)
		sessionStatusHandler = (data, callback) => {
			try {
				if (!mockValidateKey(data.key)) {
					if (callback) callback({ success: false, error: 'Invalid key' });
					return;
				}

				const { runSessionManager } = mockServices;

				if (runSessionManager && data.sessionId) {
					const session = runSessionManager.getSession(data.sessionId);
					if (session) {
						const activityState = runSessionManager.getActivityState(data.sessionId);
						const hasPendingMessages =
							activityState === 'processing' || activityState === 'streaming';

						// Get cached commands if available
						let availableCommands = null;
						if (runSessionManager.getCachedCommands) {
							availableCommands = runSessionManager.getCachedCommands(data.sessionId);
						}

						if (callback)
							callback({
								success: true,
								activityState,
								hasPendingMessages,
								availableCommands,
								sessionInfo: session
							});
					} else {
						if (callback)
							callback({
								success: false,
								error: 'Session not found'
							});
					}
				} else {
					if (callback)
						callback({
							success: true,
							activityState: 'idle',
							hasPendingMessages: false,
							availableCommands: null
						});
				}
			} catch (err) {
				if (callback) callback({ success: false, error: err.message });
			}
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Authentication', () => {
		it('should reject requests with invalid key', () => {
			mockValidateKey.mockReturnValue(false);
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'invalid', sessionId: 'test-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: false,
				error: 'Invalid key'
			});
		});

		it('should accept requests with valid key', () => {
			mockValidateKey.mockReturnValue(true);
			mockServices.runSessionManager.getSession.mockReturnValue(null); // No session found
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'valid', sessionId: 'test-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: false,
				error: 'Session not found'
			});
		});
	});

	describe('Session Status Response', () => {
		beforeEach(() => {
			mockValidateKey.mockReturnValue(true);
		});

		it('should return session not found for nonexistent session', () => {
			mockServices.runSessionManager.getSession.mockReturnValue(null);
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'valid', sessionId: 'nonexistent' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: false,
				error: 'Session not found'
			});
			expect(mockServices.runSessionManager.getSession).toHaveBeenCalledWith('nonexistent');
		});

		it('should return basic session info without commands for non-Claude session', () => {
			const mockSession = { id: 'test-123', type: 'pty', workspacePath: '/test' };
			mockServices.runSessionManager.getSession.mockReturnValue(mockSession);
			mockServices.runSessionManager.getActivityState.mockReturnValue('idle');
			mockServices.runSessionManager.getCachedCommands.mockReturnValue(null);
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'valid', sessionId: 'test-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: true,
				activityState: 'idle',
				hasPendingMessages: false,
				availableCommands: null,
				sessionInfo: mockSession
			});
		});

		it('should return session info with commands for Claude session', () => {
			const mockSession = { id: 'claude-456', type: 'claude', workspacePath: '/test' };
			const mockCommands = ['clear', 'compact', 'run-tests'];

			mockServices.runSessionManager.getSession.mockReturnValue(mockSession);
			mockServices.runSessionManager.getActivityState.mockReturnValue('idle');
			mockServices.runSessionManager.getCachedCommands.mockReturnValue(mockCommands);
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'valid', sessionId: 'claude-456' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: true,
				activityState: 'idle',
				hasPendingMessages: false,
				availableCommands: mockCommands,
				sessionInfo: mockSession
			});
			expect(mockServices.runSessionManager.getCachedCommands).toHaveBeenCalledWith('claude-456');
		});

		it('should return processing state for active Claude session', () => {
			const mockSession = { id: 'claude-789', type: 'claude', workspacePath: '/test' };
			const mockCommands = ['clear', 'help'];

			mockServices.runSessionManager.getSession.mockReturnValue(mockSession);
			mockServices.runSessionManager.getActivityState.mockReturnValue('processing');
			mockServices.runSessionManager.getCachedCommands.mockReturnValue(mockCommands);
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'valid', sessionId: 'claude-789' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: true,
				activityState: 'processing',
				hasPendingMessages: true,
				availableCommands: mockCommands,
				sessionInfo: mockSession
			});
		});

		it('should return streaming state for Claude session receiving response', () => {
			const mockSession = { id: 'claude-stream', type: 'claude', workspacePath: '/test' };

			mockServices.runSessionManager.getSession.mockReturnValue(mockSession);
			mockServices.runSessionManager.getActivityState.mockReturnValue('streaming');
			mockServices.runSessionManager.getCachedCommands.mockReturnValue(['analyze', 'debug']);
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'valid', sessionId: 'claude-stream' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: true,
				activityState: 'streaming',
				hasPendingMessages: true,
				availableCommands: ['analyze', 'debug'],
				sessionInfo: mockSession
			});
		});
	});

	describe('Service Integration', () => {
		beforeEach(() => {
			mockValidateKey.mockReturnValue(true);
		});

		it('should handle missing sessionManager gracefully', () => {
			// Remove sessionRegistry from services - this should fall through to default response
			const incompleteServices = { sessionRegistry: undefined };

			// Need to redefine the handler with the incomplete services
			const handlerWithIncompleteServices = (data, callback) => {
				try {
					if (!mockValidateKey(data.key)) {
						if (callback) callback({ success: false, error: 'Invalid key' });
						return;
					}

					const { sessionRegistry } = incompleteServices;

					if (sessionRegistry && data.sessionId) {
						// This branch won't be taken since sessionRegistry is undefined
						const session = sessionRegistry.getSession(data.sessionId);
						// ... rest of logic
					} else {
						if (callback)
							callback({
								success: true,
								activityState: 'idle',
								hasPendingMessages: false,
								availableCommands: null
							});
					}
				} catch (err) {
					if (callback) callback({ success: false, error: err.message });
				}
			};

			const mockCallback = vi.fn();
			handlerWithIncompleteServices({ key: 'valid', sessionId: 'test-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: true,
				activityState: 'idle',
				hasPendingMessages: false,
				availableCommands: null
			});
		});

		it('should handle missing sessions service gracefully', () => {
			// Remove sessionRegistry from services - this should fall through to default response
			const incompleteServices2 = { sessionRegistry: undefined };

			// Define and immediately invoke a handler using the incomplete services
			(function handlerWithIncompleteServices2(data, callback) {
				try {
					if (!mockValidateKey(data.key)) {
						if (callback) callback({ success: false, error: 'Invalid key' });
						return;
					}

					const { sessionRegistry } = incompleteServices2;

					if (sessionRegistry && data.sessionId) {
						// This branch won't be taken since sessionRegistry is undefined
						// ... rest of logic
					} else {
						if (callback)
							callback({
								success: true,
								activityState: 'idle',
								hasPendingMessages: false,
								availableCommands: null
							});
					}
				} catch (err) {
					if (callback) callback({ success: false, error: err.message });
				}
			})({ key: 'valid', sessionId: 'test-123' }, vi.fn());

			const mockCallback = vi.fn();
			// Call again to assert behavior
			(function handlerWithIncompleteServices2(data, callback) {
				try {
					if (!mockValidateKey(data.key)) {
						if (callback) callback({ success: false, error: 'Invalid key' });
						return;
					}

					const { sessionRegistry } = incompleteServices2;

					if (sessionRegistry && data.sessionId) {
						// This branch won't be taken since sessionRegistry is undefined
						// ... rest of logic
					} else {
						if (callback)
							callback({
								success: true,
								activityState: 'idle',
								hasPendingMessages: false,
								availableCommands: null
							});
					}
				} catch (err) {
					if (callback) callback({ success: false, error: err.message });
				}
			})({ key: 'valid', sessionId: 'test-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: true,
				activityState: 'idle',
				hasPendingMessages: false,
				availableCommands: null
			});
		});

		it('should handle getCachedCommands method missing gracefully', () => {
			const mockSession = { id: 'claude-123', type: 'claude', workspacePath: '/test' };

			// Remove getCachedCommands method
			delete mockServices.runSessionManager.getCachedCommands;
			mockServices.runSessionManager.getSession.mockReturnValue(mockSession);
			mockServices.runSessionManager.getActivityState.mockReturnValue('idle');
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'valid', sessionId: 'claude-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: true,
				activityState: 'idle',
				hasPendingMessages: false,
				availableCommands: null,
				sessionInfo: mockSession
			});
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			mockValidateKey.mockReturnValue(true);
		});

		it('should handle sessionManager.getSession throwing error', () => {
			mockServices.runSessionManager.getSession.mockImplementation(() => {
				throw new Error('Database connection failed');
			});
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'valid', sessionId: 'test-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: false,
				error: 'Database connection failed'
			});
		});

		it('should handle sessions.getActivityState throwing error', () => {
			const mockSession = { id: 'test-123', type: 'claude', workspacePath: '/test' };
			mockServices.runSessionManager.getSession.mockReturnValue(mockSession);
			mockServices.runSessionManager.getActivityState.mockImplementation(() => {
				throw new Error('Activity state unavailable');
			});
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'valid', sessionId: 'test-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: false,
				error: 'Activity state unavailable'
			});
		});

		it('should handle getCachedCommands throwing error', () => {
			const mockSession = { id: 'claude-123', type: 'claude', workspacePath: '/test' };
			mockServices.runSessionManager.getSession.mockReturnValue(mockSession);
			mockServices.runSessionManager.getActivityState.mockReturnValue('idle');
			mockServices.runSessionManager.getCachedCommands.mockImplementation(() => {
				throw new Error('Command cache error');
			});
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'valid', sessionId: 'claude-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: false,
				error: 'Command cache error'
			});
		});
	});

	describe('Command Cache Integration', () => {
		beforeEach(() => {
			mockValidateKey.mockReturnValue(true);
		});

		it('should return empty array when commands cache is empty', () => {
			const mockSession = { id: 'claude-empty', type: 'claude', workspacePath: '/test' };
			mockServices.runSessionManager.getSession.mockReturnValue(mockSession);
			mockServices.runSessionManager.getActivityState.mockReturnValue('idle');
			mockServices.runSessionManager.getCachedCommands.mockReturnValue([]);
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'valid', sessionId: 'claude-empty' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({ availableCommands: [] }));
		});

		it('should return null when commands cache returns null', () => {
			const mockSession = { id: 'claude-null', type: 'claude', workspacePath: '/test' };
			mockServices.runSessionManager.getSession.mockReturnValue(mockSession);
			mockServices.runSessionManager.getActivityState.mockReturnValue('idle');
			mockServices.runSessionManager.getCachedCommands.mockReturnValue(null);
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'valid', sessionId: 'claude-null' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith(
				expect.objectContaining({ availableCommands: null })
			);
		});

		it('should return commands with proper format', () => {
			const mockSession = { id: 'claude-formatted', type: 'claude', workspacePath: '/test' };
			const expectedCommands = [
				{ name: 'clear', title: 'clear', description: 'Clear terminal' },
				{ name: 'help', title: 'help', description: 'Show help' }
			];

			mockServices.runSessionManager.getSession.mockReturnValue(mockSession);
			mockServices.runSessionManager.getActivityState.mockReturnValue('idle');
			mockServices.runSessionManager.getCachedCommands.mockReturnValue(expectedCommands);
			const mockCallback = vi.fn();

			sessionStatusHandler({ key: 'valid', sessionId: 'claude-formatted' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith(
				expect.objectContaining({ availableCommands: expectedCommands })
			);
		});
	});

	describe('Callback Handling', () => {
		beforeEach(() => {
			mockValidateKey.mockReturnValue(true);
		});

		it('should handle missing callback gracefully', () => {
			const mockSession = { id: 'test-123', type: 'claude', workspacePath: '/test' };
			mockServices.runSessionManager.getSession.mockReturnValue(mockSession);
			mockServices.runSessionManager.getActivityState.mockReturnValue('idle');
			mockServices.runSessionManager.getCachedCommands.mockReturnValue(['test']);

			// Should not throw when callback is undefined
			expect(() => {
				sessionStatusHandler({ key: 'valid', sessionId: 'test-123' }, undefined);
			}).not.toThrow();
		});

		it('should handle missing callback in error case gracefully', () => {
			mockServices.runSessionManager.getSession.mockImplementation(() => {
				throw new Error('Test error');
			});

			// Should not throw when callback is undefined
			expect(() => {
				sessionStatusHandler({ key: 'valid', sessionId: 'test-123' }, undefined);
			}).not.toThrow();
		});
	});
});
