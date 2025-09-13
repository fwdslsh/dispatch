/**
 * SessionSocketManager Unit Tests
 * Tests socket connection management, reconnection logic, session isolation, and state handling
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock socket.io-client before importing SessionSocketManager
const mockSocketInstance = {
	connect: vi.fn(),
	disconnect: vi.fn(),
	connected: false,
	connecting: false,
	isActive: false,
	sessionId: '',
	emit: vi.fn(),
	on: vi.fn(),
	removeAllListeners: vi.fn(),
	id: 'mock-socket-id'
};

const mockIo = vi.fn(() => {
	const socket = { ...mockSocketInstance };
	// Reset mocks for each new instance
	Object.keys(socket).forEach((key) => {
		if (typeof socket[key] === 'function') {
			socket[key] = vi.fn(mockSocketInstance[key]);
		}
	});
	return socket;
});

vi.mock('socket.io-client', () => ({
	io: mockIo
}));

// Mock localStorage - now using globalThis instead of window for browser compatibility
const mockLocalStorage = {
	getItem: vi.fn(() => 'testkey12345'),
	setItem: vi.fn(),
	removeItem: vi.fn()
};

// Set up browser-like environment
if (typeof globalThis.localStorage === 'undefined') {
	globalThis.localStorage = mockLocalStorage;
}

// Import after mocking
const { default: sessionSocketManager } = await import(
	'../../src/lib/components/SessionSocketManager.js'
);

describe('SessionSocketManager', () => {
	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks();

		// Reset socket manager state
		sessionSocketManager.disconnectAll();
		sessionSocketManager.sockets.clear();
		sessionSocketManager.activeSession = null;

		// Reset mock socket state
		mockSocketInstance.connected = false;
		mockSocketInstance.connecting = false;
		mockSocketInstance.isActive = false;
	});

	afterEach(() => {
		sessionSocketManager.disconnectAll();
	});

	describe('Basic Socket Management', () => {
		it('should create new socket for session', () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			expect(mockIo).toHaveBeenCalledWith({
				query: { sessionId },
				autoConnect: true,
				reconnection: true,
				reconnectionAttempts: 5,
				reconnectionDelay: 1000,
				reconnectionDelayMax: 5000
			});
			expect(socket.sessionId).toBe(sessionId);
		});

		it('should reuse existing socket for same session', () => {
			const sessionId = 'test-session-1';
			const socket1 = sessionSocketManager.getSocket(sessionId);
			const socket2 = sessionSocketManager.getSocket(sessionId);

			expect(socket1).toBe(socket2);
			expect(mockIo).toHaveBeenCalledTimes(1);
		});

		it('should create separate sockets for different sessions', () => {
			const sessionId1 = 'test-session-1';
			const sessionId2 = 'test-session-2';

			const socket1 = sessionSocketManager.getSocket(sessionId1);
			const socket2 = sessionSocketManager.getSocket(sessionId2);

			expect(socket1).not.toBe(socket2);
			expect(socket1.sessionId).toBe(sessionId1);
			expect(socket2.sessionId).toBe(sessionId2);
			expect(mockIo).toHaveBeenCalledTimes(2);
		});
	});

	describe('Reconnection Logic', () => {
		it('should reconnect existing disconnected socket', () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			// Simulate socket disconnection
			socket.connected = false;
			socket.connecting = false;
			socket.isActive = false;

			// Get socket again - should trigger reconnection
			const reconnectedSocket = sessionSocketManager.getSocket(sessionId);

			expect(reconnectedSocket).toBe(socket);
			expect(socket.connect).toHaveBeenCalled();
		});

		it('should handle reconnection attempts with proper events', () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			// Find the event handlers
			const connectHandler = socket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];
			const reconnectHandler = socket.on.mock.calls.find((call) => call[0] === 'reconnect')?.[1];
			const reconnectAttemptHandler = socket.on.mock.calls.find(
				(call) => call[0] === 'reconnect_attempt'
			)?.[1];

			expect(connectHandler).toBeDefined();
			expect(reconnectHandler).toBeDefined();
			expect(reconnectAttemptHandler).toBeDefined();

			// Simulate reconnection events
			if (connectHandler) {
				connectHandler();
				expect(socket.isActive).toBe(true);
			}

			if (reconnectAttemptHandler) {
				reconnectAttemptHandler(3);
				// Should log reconnection attempt
			}

			if (reconnectHandler) {
				reconnectHandler(3);
				expect(socket.isActive).toBe(true);
			}
		});

		it('should maintain session association during reconnection', () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			expect(socket.sessionId).toBe(sessionId);

			// Simulate reconnection
			const reconnectHandler = socket.on.mock.calls.find((call) => call[0] === 'reconnect')?.[1];
			if (reconnectHandler) {
				reconnectHandler(2);
			}

			// Session ID should still be maintained
			expect(socket.sessionId).toBe(sessionId);
			expect(sessionSocketManager.sockets.get(sessionId)).toBe(socket);
		});
	});

	describe('Session Focus and Catch-up', () => {
		it('should handle session focus changes', () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			sessionSocketManager.handleSessionFocus(sessionId);

			expect(sessionSocketManager.getActiveSession()).toBe(sessionId);
		});

		it('should emit catch-up event when focusing connected session', () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			// Simulate connected socket
			socket.connected = true;
			socket.connecting = false;

			sessionSocketManager.handleSessionFocus(sessionId);

			expect(socket.emit).toHaveBeenCalledWith('session.catchup', {
				key: 'testkey12345',
				sessionId,
				timestamp: expect.any(Number)
			});
		});

		it('should reconnect when focusing disconnected session', () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			// Simulate disconnected socket
			socket.connected = false;
			socket.connecting = false;

			sessionSocketManager.handleSessionFocus(sessionId);

			expect(socket.connect).toHaveBeenCalled();
		});

		it('should check for pending messages', async () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			// Simulate connected socket
			socket.connected = true;

			// Mock the emit callback for session.status
			socket.emit.mockImplementation((event, data, callback) => {
				if (event === 'session.status' && callback) {
					callback({ hasPendingMessages: true });
				}
			});

			const hasPending = await sessionSocketManager.checkForPendingMessages(sessionId);

			expect(hasPending).toBe(true);
			expect(socket.emit).toHaveBeenCalledWith(
				'session.status',
				{
					key: 'testkey12345',
					sessionId
				},
				expect.any(Function)
			);
		});
	});

	describe('Connection Status Management', () => {
		it('should track connection status correctly', () => {
			const sessionId = 'test-session-1';

			expect(sessionSocketManager.isConnected(sessionId)).toBe(false);

			const socket = sessionSocketManager.getSocket(sessionId);
			socket.isActive = true;

			expect(sessionSocketManager.isConnected(sessionId)).toBe(true);
		});

		it('should provide connection status for all sessions', () => {
			const sessionId1 = 'test-session-1';
			const sessionId2 = 'test-session-2';

			const socket1 = sessionSocketManager.getSocket(sessionId1);
			const socket2 = sessionSocketManager.getSocket(sessionId2);

			socket1.isActive = true;
			socket1.id = 'socket-1';
			socket2.isActive = false;
			socket2.id = 'socket-2';

			const status = sessionSocketManager.getConnectionStatus();

			expect(status).toEqual({
				[sessionId1]: { connected: true, id: 'socket-1' },
				[sessionId2]: { connected: false, id: 'socket-2' }
			});
		});

		it('should handle disconnect events properly', () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			// Find and call disconnect handler
			const disconnectHandler = socket.on.mock.calls.find((call) => call[0] === 'disconnect')?.[1];
			expect(disconnectHandler).toBeDefined();

			if (disconnectHandler) {
				disconnectHandler('transport close');
				expect(socket.isActive).toBe(false);
			}
		});
	});

	describe('Error Handling', () => {
		it('should handle socket errors gracefully', () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			// Find and call error handler
			const errorHandler = socket.on.mock.calls.find((call) => call[0] === 'error')?.[1];
			expect(errorHandler).toBeDefined();

			if (errorHandler) {
				const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
				errorHandler(new Error('Connection failed'));
				expect(consoleErrorSpy).toHaveBeenCalled();
				consoleErrorSpy.mockRestore();
			}
		});

		it('should handle pending message check failures', async () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			// Simulate disconnected socket
			socket.connected = false;

			const hasPending = await sessionSocketManager.checkForPendingMessages(sessionId);

			expect(hasPending).toBe(false);
		});
	});

	describe('Cleanup and Resource Management', () => {
		it('should disconnect specific session', () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			sessionSocketManager.setActiveSession(sessionId);
			sessionSocketManager.disconnectSession(sessionId);

			expect(socket.removeAllListeners).toHaveBeenCalled();
			expect(socket.disconnect).toHaveBeenCalled();
			expect(sessionSocketManager.sockets.has(sessionId)).toBe(false);
			expect(sessionSocketManager.getActiveSession()).toBe(null);
		});

		it('should disconnect all sessions', () => {
			const sessionId1 = 'test-session-1';
			const sessionId2 = 'test-session-2';

			const socket1 = sessionSocketManager.getSocket(sessionId1);
			const socket2 = sessionSocketManager.getSocket(sessionId2);

			sessionSocketManager.disconnectAll();

			expect(socket1.removeAllListeners).toHaveBeenCalled();
			expect(socket1.disconnect).toHaveBeenCalled();
			expect(socket2.removeAllListeners).toHaveBeenCalled();
			expect(socket2.disconnect).toHaveBeenCalled();

			expect(sessionSocketManager.sockets.size).toBe(0);
			expect(sessionSocketManager.getActiveSession()).toBe(null);
		});

		it('should manually reconnect specific session', () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			sessionSocketManager.reconnectSession(sessionId);

			expect(socket.connect).toHaveBeenCalled();
		});

		it('should handle reconnection of non-existent session', () => {
			const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			sessionSocketManager.reconnectSession('non-existent-session');

			// Should not throw error
			expect(consoleLogSpy).not.toHaveBeenCalled();
			consoleLogSpy.mockRestore();
		});
	});

	describe('Edge Cases and Network Scenarios', () => {
		it('should handle rapid connect/disconnect cycles', () => {
			const sessionId = 'test-session-1';
			const socket = sessionSocketManager.getSocket(sessionId);

			// Find event handlers
			const connectHandler = socket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];
			const disconnectHandler = socket.on.mock.calls.find((call) => call[0] === 'disconnect')?.[1];

			// Simulate rapid connect/disconnect
			if (connectHandler && disconnectHandler) {
				connectHandler();
				expect(socket.isActive).toBe(true);

				disconnectHandler('transport error');
				expect(socket.isActive).toBe(false);

				connectHandler();
				expect(socket.isActive).toBe(true);
			}
		});

		it('should maintain state consistency during network instability', () => {
			const sessionId = 'test-session-1';
			sessionSocketManager.setActiveSession(sessionId);

			const socket = sessionSocketManager.getSocket(sessionId);
			const disconnectHandler = socket.on.mock.calls.find((call) => call[0] === 'disconnect')?.[1];

			// Simulate network disconnection
			if (disconnectHandler) {
				disconnectHandler('transport close');
			}

			// Active session should remain the same
			expect(sessionSocketManager.getActiveSession()).toBe(sessionId);

			// Socket should still be tracked
			expect(sessionSocketManager.sockets.has(sessionId)).toBe(true);
		});

		it('should handle multiple session focus changes during reconnection', () => {
			const sessionId1 = 'test-session-1';
			const sessionId2 = 'test-session-2';

			// Create both sockets
			const socket1 = sessionSocketManager.getSocket(sessionId1);
			const socket2 = sessionSocketManager.getSocket(sessionId2);

			// Simulate disconnected state
			socket1.connected = false;
			socket1.connecting = true; // Connecting state
			socket2.connected = false;
			socket2.connecting = false;

			// Focus first session (connecting)
			sessionSocketManager.handleSessionFocus(sessionId1);
			expect(sessionSocketManager.getActiveSession()).toBe(sessionId1);

			// Focus second session (disconnected)
			sessionSocketManager.handleSessionFocus(sessionId2);
			expect(sessionSocketManager.getActiveSession()).toBe(sessionId2);
			expect(socket2.connect).toHaveBeenCalled();
		});
	});
});
