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

describe('Socket.IO Claude Commands Refresh Handler', () => {
	let mockServices;
	let commandsRefreshHandler;

	beforeEach(() => {
		vi.clearAllMocks();

		// Setup mock services using the new RunSessionManager API name
		mockServices = {
			runSessionManager: {
				refreshCommands: vi.fn()
			}
		};

		// Mock global services
		globalThis.__API_SERVICES = mockServices;

		// Define the claude.commands.refresh handler logic (extracted from socket-setup.js)
		commandsRefreshHandler = async (data, callback) => {
			const { logger } = await import('../../src/lib/server/utils/logger.js');
			logger.debug('SOCKET', 'claude.commands.refresh received:', data);
			try {
				if (!mockValidateKey(data.key)) {
					if (callback) callback({ success: false, error: 'Invalid key' });
					return;
				}

				const { runSessionManager } = globalThis.__API_SERVICES || {};

				if (runSessionManager && runSessionManager.refreshCommands && data.sessionId) {
					try {
						const commands = await runSessionManager.refreshCommands(data.sessionId);
						logger.debug(
							'SOCKET',
							`Commands refreshed for session ${data.sessionId}:`,
							Array.isArray(commands) ? `${commands.length} commands` : 'null'
						);

						if (callback) {
							callback({
								success: true,
								commands: commands || [],
								sessionId: data.sessionId
							});
						}
					} catch (error) {
						logger.error('SOCKET', 'Commands refresh error:', error);
						if (callback) {
							callback({
								success: false,
								error: error.message,
								sessionId: data.sessionId
							});
						}
					}
				} else {
					if (callback) {
						callback({
							success: false,
							error: 'Session manager or refresh method not available',
							sessionId: data.sessionId
						});
					}
				}
			} catch (err) {
				const { logger } = await import('../../src/lib/server/utils/logger.js');
				logger.error('SOCKET', 'Commands refresh handler error:', err);
				if (callback) callback({ success: false, error: err.message });
			}
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete globalThis.__API_SERVICES;
	});

	describe('Authentication', () => {
		it('should reject requests with invalid key', async () => {
			mockValidateKey.mockReturnValue(false);
			const mockCallback = vi.fn();

			await commandsRefreshHandler({ key: 'invalid', sessionId: 'test-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: false,
				error: 'Invalid key'
			});
		});

		it('should accept requests with valid key', async () => {
			mockValidateKey.mockReturnValue(true);
			mockServices.runSessionManager.refreshCommands.mockResolvedValue(['clear', 'help']);
			const mockCallback = vi.fn();

			await commandsRefreshHandler({ key: 'valid', sessionId: 'test-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: true,
				commands: ['clear', 'help'],
				sessionId: 'test-123'
			});
		});
	});

	describe('Command Refresh Logic', () => {
		beforeEach(() => {
			mockValidateKey.mockReturnValue(true);
		});

		it('should refresh commands for existing session', async () => {
			const sessionId = 'claude-456';
			const mockCommands = ['clear', 'compact', 'run-tests'];
			mockServices.runSessionManager.refreshCommands.mockResolvedValue(mockCommands);
			const mockCallback = vi.fn();

			await commandsRefreshHandler({ key: 'valid', sessionId }, mockCallback);

			expect(mockServices.runSessionManager.refreshCommands).toHaveBeenCalledWith(sessionId);
			expect(mockCallback).toHaveBeenCalledWith({
				success: true,
				commands: mockCommands,
				sessionId: sessionId
			});
		});

		it('should handle null commands response', async () => {
			const sessionId = 'claude-null';
			mockServices.runSessionManager.refreshCommands.mockResolvedValue(null);
			const mockCallback = vi.fn();

			await commandsRefreshHandler({ key: 'valid', sessionId }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: true,
				commands: [],
				sessionId: sessionId
			});
		});

		it('should handle undefined commands response', async () => {
			const sessionId = 'claude-undefined';
			mockServices.runSessionManager.refreshCommands.mockResolvedValue(undefined);
			const mockCallback = vi.fn();

			await commandsRefreshHandler({ key: 'valid', sessionId }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: true,
				commands: [],
				sessionId: sessionId
			});
		});

		it('should handle empty commands array', async () => {
			const sessionId = 'claude-empty';
			mockServices.runSessionManager.refreshCommands.mockResolvedValue([]);
			const mockCallback = vi.fn();

			await commandsRefreshHandler({ key: 'valid', sessionId }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: true,
				commands: [],
				sessionId: sessionId
			});
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			mockValidateKey.mockReturnValue(true);
		});

		it('should handle refreshCommands throwing error', async () => {
			const sessionId = 'claude-error';
			const error = new Error('Command fetch failed');
			mockServices.runSessionManager.refreshCommands.mockRejectedValue(error);
			const mockCallback = vi.fn();

			await commandsRefreshHandler({ key: 'valid', sessionId }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: false,
				error: 'Command fetch failed',
				sessionId: sessionId
			});
		});

		it('should handle missing sessionManager', async () => {
			const incompleteServices = {};
			globalThis.__API_SERVICES = incompleteServices;
			const mockCallback = vi.fn();

			await commandsRefreshHandler({ key: 'valid', sessionId: 'test-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: false,
				error: 'Session manager or refresh method not available',
				sessionId: 'test-123'
			});
		});

		it('should handle sessionManager without refreshCommands method', async () => {
			const incompleteServices = {
				runSessionManager: {} // Missing refreshCommands method
			};
			globalThis.__API_SERVICES = incompleteServices;
			const mockCallback = vi.fn();

			await commandsRefreshHandler({ key: 'valid', sessionId: 'test-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: false,
				error: 'Session manager or refresh method not available',
				sessionId: 'test-123'
			});
		});

		it('should handle missing sessionId', async () => {
			const mockCallback = vi.fn();

			await commandsRefreshHandler({ key: 'valid' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: false,
				error: 'Session manager or refresh method not available',
				sessionId: undefined
			});
		});

		it('should handle handler throwing unexpected error', async () => {
			// Simulate unexpected error in handler
			mockValidateKey.mockImplementation(() => {
				throw new Error('Unexpected validation error');
			});
			const mockCallback = vi.fn();

			await commandsRefreshHandler({ key: 'valid', sessionId: 'test-123' }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith({
				success: false,
				error: 'Unexpected validation error'
			});
		});
	});

	describe('Callback Handling', () => {
		beforeEach(() => {
			mockValidateKey.mockReturnValue(true);
		});

		it('should handle missing callback gracefully', async () => {
			mockServices.runSessionManager.refreshCommands.mockResolvedValue(['clear']);

			// Should not throw when callback is undefined
			await expect(async () => {
				await commandsRefreshHandler({ key: 'valid', sessionId: 'test-123' }, undefined);
			}).not.toThrow();
		});

		it('should handle missing callback in error case gracefully', async () => {
			mockServices.runSessionManager.refreshCommands.mockRejectedValue(new Error('Test error'));

			// Should not throw when callback is undefined
			await expect(async () => {
				await commandsRefreshHandler({ key: 'valid', sessionId: 'test-123' }, undefined);
			}).not.toThrow();
		});

		it('should handle missing callback in auth error case gracefully', async () => {
			mockValidateKey.mockReturnValue(false);

			// Should not throw when callback is undefined
			await expect(async () => {
				await commandsRefreshHandler({ key: 'invalid', sessionId: 'test-123' }, undefined);
			}).not.toThrow();
		});
	});

	describe('Reconnection Scenarios', () => {
		beforeEach(() => {
			mockValidateKey.mockReturnValue(true);
		});

		it('should support client reconnection triggering command refresh', async () => {
			const sessionId = 'claude-reconnect';
			const cachedCommands = ['clear', 'help', 'status'];
			mockServices.runSessionManager.refreshCommands.mockResolvedValue(cachedCommands);
			const mockCallback = vi.fn();

			// Simulate client reconnecting and requesting command refresh
			await commandsRefreshHandler({ key: 'valid', sessionId }, mockCallback);

			expect(mockServices.runSessionManager.refreshCommands).toHaveBeenCalledWith(sessionId);
			expect(mockCallback).toHaveBeenCalledWith({
				success: true,
				commands: cachedCommands,
				sessionId: sessionId
			});
		});

		it('should handle multiple concurrent refresh requests', async () => {
			const sessionId = 'claude-concurrent';
			const commands = ['clear', 'debug'];
			mockServices.runSessionManager.refreshCommands.mockResolvedValue(commands);
			const mockCallback1 = vi.fn();
			const mockCallback2 = vi.fn();

			// Simulate concurrent refresh requests
			await Promise.all([
				commandsRefreshHandler({ key: 'valid', sessionId }, mockCallback1),
				commandsRefreshHandler({ key: 'valid', sessionId }, mockCallback2)
			]);

			expect(mockServices.runSessionManager.refreshCommands).toHaveBeenCalledTimes(2);
			expect(mockCallback1).toHaveBeenCalledWith({
				success: true,
				commands: commands,
				sessionId: sessionId
			});
			expect(mockCallback2).toHaveBeenCalledWith({
				success: true,
				commands: commands,
				sessionId: sessionId
			});
		});

		it('should preserve session ID in response for client routing', async () => {
			const sessionId = 'claude-routing-test';
			const commands = ['analyze'];
			mockServices.runSessionManager.refreshCommands.mockResolvedValue(commands);
			const mockCallback = vi.fn();

			await commandsRefreshHandler({ key: 'valid', sessionId }, mockCallback);

			expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({ sessionId: sessionId }));
		});
	});
});
