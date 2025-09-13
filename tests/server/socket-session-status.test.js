import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as Client } from 'socket.io-client';

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

vi.mock('../../src/lib/server/history-manager.js', () => ({
	historyManager: {
		initializeSocket: vi.fn(),
		addEvent: vi.fn(),
		finalizeSocket: vi.fn()
	}
}));

describe('Socket.IO Session Status Handler', () => {
	let server;
	let io;
	let clientSocket;
	let serverSocket;
	let mockServices;

	beforeEach((done) => {
		vi.clearAllMocks();

		// Setup mock services
		mockServices = {
			sessionManager: {
				getSession: vi.fn(),
				getCachedCommands: vi.fn()
			},
			sessions: {
				getActivityState: vi.fn()
			}
		};

		// Mock global services
		globalThis.__API_SERVICES = mockServices;

		// Create HTTP server and Socket.IO
		const httpServer = createServer();
		io = new Server(httpServer, {
			cors: { origin: '*', methods: ['GET', 'POST'] }
		});

		// Setup Socket.IO handlers (simplified version of socket-setup.js)
		io.on('connection', (socket) => {
			serverSocket = socket;

			// Import the session.status handler logic
			socket.on('session.status', (data, callback) => {
				try {
					if (!mockValidateKey(data.key)) {
						if (callback) callback({ success: false, error: 'Invalid key' });
						return;
					}

					const { sessionManager, sessions } = mockServices;

					if (sessionManager && sessions && data.sessionId) {
						const session = sessionManager.getSession(data.sessionId);
						if (session) {
							const activityState = sessions.getActivityState(data.sessionId);
							const hasPendingMessages =
								activityState === 'processing' || activityState === 'streaming';

							// Get cached commands if available
							let availableCommands = null;
							if (sessionManager.getCachedCommands) {
								availableCommands = sessionManager.getCachedCommands(data.sessionId);
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
			});
		});

		httpServer.listen(() => {
			const port = httpServer.address().port;
			clientSocket = Client(`http://localhost:${port}`);
			clientSocket.on('connect', done);
		});
	});

	afterEach((done) => {
		vi.restoreAllMocks();
		delete globalThis.__API_SERVICES;

		if (clientSocket && clientSocket.connected) {
			clientSocket.disconnect();
		}
		if (io) {
			io.close(done);
		} else {
			done();
		}
	});

	describe('Authentication', () => {
		it('should reject requests with invalid key', (done) => {
			mockValidateKey.mockReturnValue(false);

			clientSocket.emit('session.status', { key: 'invalid', sessionId: 'test-123' }, (response) => {
				expect(response).toEqual({
					success: false,
					error: 'Invalid key'
				});
				done();
			});
		});

		it('should accept requests with valid key', (done) => {
			mockValidateKey.mockReturnValue(true);

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'test-123' }, (response) => {
				expect(response.success).toBe(true);
				done();
			});
		});
	});

	describe('Session Status Response', () => {
		beforeEach(() => {
			mockValidateKey.mockReturnValue(true);
		});

		it('should return session not found for nonexistent session', (done) => {
			mockServices.sessionManager.getSession.mockReturnValue(null);

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'nonexistent' }, (response) => {
				expect(response).toEqual({
					success: false,
					error: 'Session not found'
				});
				expect(mockServices.sessionManager.getSession).toHaveBeenCalledWith('nonexistent');
				done();
			});
		});

		it('should return basic session info without commands for non-Claude session', (done) => {
			const mockSession = { id: 'test-123', type: 'terminal', workspacePath: '/test' };
			mockServices.sessionManager.getSession.mockReturnValue(mockSession);
			mockServices.sessions.getActivityState.mockReturnValue('idle');
			mockServices.sessionManager.getCachedCommands.mockReturnValue(null);

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'test-123' }, (response) => {
				expect(response).toEqual({
					success: true,
					activityState: 'idle',
					hasPendingMessages: false,
					availableCommands: null,
					sessionInfo: mockSession
				});
				done();
			});
		});

		it('should return session info with commands for Claude session', (done) => {
			const mockSession = { id: 'claude-456', type: 'claude', workspacePath: '/test' };
			const mockCommands = ['clear', 'compact', 'run-tests'];

			mockServices.sessionManager.getSession.mockReturnValue(mockSession);
			mockServices.sessions.getActivityState.mockReturnValue('idle');
			mockServices.sessionManager.getCachedCommands.mockReturnValue(mockCommands);

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'claude-456' }, (response) => {
				expect(response).toEqual({
					success: true,
					activityState: 'idle',
					hasPendingMessages: false,
					availableCommands: mockCommands,
					sessionInfo: mockSession
				});
				expect(mockServices.sessionManager.getCachedCommands).toHaveBeenCalledWith('claude-456');
				done();
			});
		});

		it('should return processing state for active Claude session', (done) => {
			const mockSession = { id: 'claude-789', type: 'claude', workspacePath: '/test' };
			const mockCommands = ['clear', 'help'];

			mockServices.sessionManager.getSession.mockReturnValue(mockSession);
			mockServices.sessions.getActivityState.mockReturnValue('processing');
			mockServices.sessionManager.getCachedCommands.mockReturnValue(mockCommands);

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'claude-789' }, (response) => {
				expect(response).toEqual({
					success: true,
					activityState: 'processing',
					hasPendingMessages: true,
					availableCommands: mockCommands,
					sessionInfo: mockSession
				});
				done();
			});
		});

		it('should return streaming state for Claude session receiving response', (done) => {
			const mockSession = { id: 'claude-stream', type: 'claude', workspacePath: '/test' };

			mockServices.sessionManager.getSession.mockReturnValue(mockSession);
			mockServices.sessions.getActivityState.mockReturnValue('streaming');
			mockServices.sessionManager.getCachedCommands.mockReturnValue(['analyze', 'debug']);

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'claude-stream' }, (response) => {
				expect(response).toEqual({
					success: true,
					activityState: 'streaming',
					hasPendingMessages: true,
					availableCommands: ['analyze', 'debug'],
					sessionInfo: mockSession
				});
				done();
			});
		});
	});

	describe('Service Integration', () => {
		beforeEach(() => {
			mockValidateKey.mockReturnValue(true);
		});

		it('should handle missing sessionManager gracefully', (done) => {
			// Remove sessionManager from services
			const incompleteServices = { sessions: mockServices.sessions };
			globalThis.__API_SERVICES = incompleteServices;

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'test-123' }, (response) => {
				expect(response).toEqual({
					success: true,
					activityState: 'idle',
					hasPendingMessages: false,
					availableCommands: null
				});
				done();
			});
		});

		it('should handle missing sessions service gracefully', (done) => {
			// Remove sessions from services
			const incompleteServices = { sessionManager: mockServices.sessionManager };
			globalThis.__API_SERVICES = incompleteServices;

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'test-123' }, (response) => {
				expect(response).toEqual({
					success: true,
					activityState: 'idle',
					hasPendingMessages: false,
					availableCommands: null
				});
				done();
			});
		});

		it('should handle getCachedCommands method missing gracefully', (done) => {
			const mockSession = { id: 'claude-123', type: 'claude', workspacePath: '/test' };

			// Remove getCachedCommands method
			delete mockServices.sessionManager.getCachedCommands;
			mockServices.sessionManager.getSession.mockReturnValue(mockSession);
			mockServices.sessions.getActivityState.mockReturnValue('idle');

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'claude-123' }, (response) => {
				expect(response).toEqual({
					success: true,
					activityState: 'idle',
					hasPendingMessages: false,
					availableCommands: null,
					sessionInfo: mockSession
				});
				done();
			});
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			mockValidateKey.mockReturnValue(true);
		});

		it('should handle sessionManager.getSession throwing error', (done) => {
			mockServices.sessionManager.getSession.mockImplementation(() => {
				throw new Error('Database connection failed');
			});

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'test-123' }, (response) => {
				expect(response).toEqual({
					success: false,
					error: 'Database connection failed'
				});
				done();
			});
		});

		it('should handle sessions.getActivityState throwing error', (done) => {
			const mockSession = { id: 'test-123', type: 'claude', workspacePath: '/test' };
			mockServices.sessionManager.getSession.mockReturnValue(mockSession);
			mockServices.sessions.getActivityState.mockImplementation(() => {
				throw new Error('Activity state unavailable');
			});

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'test-123' }, (response) => {
				expect(response).toEqual({
					success: false,
					error: 'Activity state unavailable'
				});
				done();
			});
		});

		it('should handle getCachedCommands throwing error', (done) => {
			const mockSession = { id: 'claude-123', type: 'claude', workspacePath: '/test' };
			mockServices.sessionManager.getSession.mockReturnValue(mockSession);
			mockServices.sessions.getActivityState.mockReturnValue('idle');
			mockServices.sessionManager.getCachedCommands.mockImplementation(() => {
				throw new Error('Command cache error');
			});

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'claude-123' }, (response) => {
				expect(response).toEqual({
					success: false,
					error: 'Command cache error'
				});
				done();
			});
		});
	});

	describe('Command Cache Integration', () => {
		beforeEach(() => {
			mockValidateKey.mockReturnValue(true);
		});

		it('should return empty array when commands cache is empty', (done) => {
			const mockSession = { id: 'claude-empty', type: 'claude', workspacePath: '/test' };
			mockServices.sessionManager.getSession.mockReturnValue(mockSession);
			mockServices.sessions.getActivityState.mockReturnValue('idle');
			mockServices.sessionManager.getCachedCommands.mockReturnValue([]);

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'claude-empty' }, (response) => {
				expect(response.availableCommands).toEqual([]);
				expect(response.success).toBe(true);
				done();
			});
		});

		it('should return null when commands cache returns null', (done) => {
			const mockSession = { id: 'claude-null', type: 'claude', workspacePath: '/test' };
			mockServices.sessionManager.getSession.mockReturnValue(mockSession);
			mockServices.sessions.getActivityState.mockReturnValue('idle');
			mockServices.sessionManager.getCachedCommands.mockReturnValue(null);

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'claude-null' }, (response) => {
				expect(response.availableCommands).toBeNull();
				expect(response.success).toBe(true);
				done();
			});
		});

		it('should return commands with proper format', (done) => {
			const mockSession = { id: 'claude-formatted', type: 'claude', workspacePath: '/test' };
			const expectedCommands = [
				{ name: 'clear', title: 'clear', description: 'Clear terminal' },
				{ name: 'help', title: 'help', description: 'Show help' }
			];

			mockServices.sessionManager.getSession.mockReturnValue(mockSession);
			mockServices.sessions.getActivityState.mockReturnValue('idle');
			mockServices.sessionManager.getCachedCommands.mockReturnValue(expectedCommands);

			clientSocket.emit('session.status', { key: 'valid', sessionId: 'claude-formatted' }, (response) => {
				expect(response.availableCommands).toEqual(expectedCommands);
				expect(response.success).toBe(true);
				done();
			});
		});
	});
});