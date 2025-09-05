/**
 * SocketService Unit Tests
 * Tests Socket.IO wrapper with error handling, reconnection, and event management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SocketService } from '../../src/lib/services/SocketService.js';

// Mock the socket.io-client import
vi.mock('socket.io-client', () => {
	const mockSocket = {
		connect: vi.fn(),
		disconnect: vi.fn(),
		emit: vi.fn(),
		on: vi.fn(),
		off: vi.fn(),
		once: vi.fn(),
		removeAllListeners: vi.fn(),
		connected: false,
		id: 'mock-socket-id'
	};

	const mockIo = vi.fn(() => mockSocket);

	return {
		default: mockIo,
		io: mockIo
	};
});

describe('SocketService', () => {
	let socketService;
	let mockSocket;
	let mockIo;

	beforeEach(async () => {
		vi.clearAllMocks();
		
		// Get mock references
		const socketModule = await import('socket.io-client');
		mockIo = socketModule.io;
		
		// Reset mock socket
		mockSocket = {
			connect: vi.fn(),
			disconnect: vi.fn(),
			emit: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
			once: vi.fn(),
			removeAllListeners: vi.fn(),
			connected: false,
			id: 'mock-socket-id'
		};
		
		mockIo.mockReturnValue(mockSocket);
		
		// Create service with autoConnect disabled to prevent issues
		socketService = new SocketService('/', { autoConnect: false });
	});

	afterEach(() => {
		if (socketService) {
			socketService.dispose();
		}
	});

	describe('Constructor and Initialization', () => {
		it('should initialize with default options', () => {
			expect(socketService).toBeDefined();
			const status = socketService.getStatus();
			expect(status.connected).toBe(false);
		});

		it('should initialize with custom options', () => {
			const customOptions = {
				autoConnect: false,
				timeout: 10000,
				maxReconnectAttempts: 3
			};
			
			const customService = new SocketService('http://custom-url', customOptions);
			expect(customService).toBeDefined();
			const status = customService.getStatus();
			expect(status.connected).toBe(false);
		});

		it('should not auto-connect when autoConnect is false', () => {
			const service = new SocketService('http://test', { autoConnect: false });
			expect(mockSocket.connect).not.toHaveBeenCalled();
		});
	});

	describe('Connection Management', () => {
		it('should connect to socket server', async () => {
			mockSocket.once.mockImplementation((event, callback) => {
				if (event === 'connect') {
					setTimeout(() => callback(), 10);
				}
			});

			const connectPromise = socketService.connect();
			expect(mockSocket.connect).toHaveBeenCalled();
			
			await connectPromise;
			const status = socketService.getStatus();
			expect(status.connected).toBe(true);
		});

		it('should handle connection failure', async () => {
			mockSocket.once.mockImplementation((event, callback) => {
				if (event === 'connect_error') {
					setTimeout(() => callback(new Error('Connection failed')), 10);
				}
			});

			try {
				await socketService.connect();
			} catch (error) {
				expect(error.message).toContain('Connection failed');
			}
		});

		it('should disconnect from socket server', async () => {
			// First connect
			mockSocket.once.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
				if (event === 'disconnect') callback();
			});
			
			await socketService.connect();
			await socketService.disconnect();
			
			expect(mockSocket.disconnect).toHaveBeenCalled();
		});

		it('should handle multiple connection attempts gracefully', async () => {
			mockSocket.once.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
			});

			await socketService.connect();
			await socketService.connect(); // Second attempt should be handled
			
			// Should only call connect once since already connected
			expect(mockSocket.connect).toHaveBeenCalledTimes(1);
		});
	});

	describe('Event Emission', () => {
		beforeEach(async () => {
			// Connect first
			mockSocket.once.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
			});
			await socketService.connect();
		});

		it('should emit events with response', async () => {
			const testData = { message: 'test' };
			const expectedResponse = { status: 'ok' };
			
			mockSocket.emit.mockImplementation((event, data, callback) => {
				setTimeout(() => callback(expectedResponse), 10);
			});

			const result = await socketService.emit('testEvent', testData);
			
			expect(mockSocket.emit).toHaveBeenCalledWith('testEvent', testData, expect.any(Function));
			expect(result).toEqual(expectedResponse);
		});

		it('should emit events without response', () => {
			const testData = { message: 'test' };
			
			socketService.emitNoResponse('testEvent', testData);
			
			expect(mockSocket.emit).toHaveBeenCalledWith('testEvent', testData);
		});

		it('should reject emit when not connected', async () => {
			// Disconnect first
			socketService._connected = false;

			try {
				await socketService.emit('testEvent', {});
			} catch (error) {
				expect(error.message).toContain('Socket not connected');
			}
		});
	});

	describe('Event Listening - Connected Socket', () => {
		beforeEach(async () => {
			// Connect first to initialize socket
			mockSocket.once.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
			});
			await socketService.connect();
			vi.clearAllMocks(); // Clear mocks after connection setup
		});

		it('should add event listeners when connected', () => {
			const handler = vi.fn();
			
			socketService.on('testEvent', handler);
			
			// Should have registered internal handler mapping
			expect(mockSocket.on).toHaveBeenCalled();
		});

		it('should add one-time event listeners when connected', () => {
			const handler = vi.fn();
			
			socketService.once('testEvent', handler);
			
			expect(mockSocket.once).toHaveBeenCalled();
		});

		it('should remove event listeners when connected', () => {
			const handler = vi.fn();
			
			// Add first, then remove
			socketService.on('testEvent', handler);
			socketService.off('testEvent', handler);
			
			expect(mockSocket.off).toHaveBeenCalled();
		});
	});

	describe('Authentication', () => {
		beforeEach(async () => {
			// Connect first
			mockSocket.once.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
			});
			await socketService.connect();
		});

		it('should authenticate with key', async () => {
			const authKey = 'test-key';
			
			mockSocket.emit.mockImplementation((event, key, callback) => {
				if (event === 'auth') {
					setTimeout(() => callback({ success: true }), 10);
				}
			});

			const result = await socketService.auth(authKey);
			
			expect(mockSocket.emit).toHaveBeenCalledWith('auth', authKey, expect.any(Function));
			expect(result.success).toBe(true);
		});

		it('should handle authentication failure', async () => {
			const authKey = 'invalid-key';
			
			mockSocket.emit.mockImplementation((event, key, callback) => {
				if (event === 'auth') {
					setTimeout(() => callback({ success: false, error: 'Invalid key' }), 10);
				}
			});

			const result = await socketService.auth(authKey);
			expect(result.success).toBe(false);
		});
	});

	describe('Health Check', () => {
		it('should return false when disconnected', async () => {
			const result = await socketService.healthCheck();
			expect(result).toBe(false);
		});

		it('should return true for successful health check when connected', async () => {
			// Connect first
			mockSocket.once.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
			});
			await socketService.connect();

			// Mock emit to respond with 'pong' for ping
			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'ping') {
					// Call callback synchronously with 'pong' response
					callback('pong');
				}
			});

			const result = await socketService.healthCheck();
			
			// healthCheck calls emit('ping') which becomes emit('ping', undefined)
			expect(mockSocket.emit).toHaveBeenCalledWith('ping', undefined, expect.any(Function));
			expect(result).toBe(true);
		});

		it('should return false for failed health check when connected', async () => {
			// Connect first
			mockSocket.once.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
			});
			await socketService.connect();

			// Mock emit to respond with something other than 'pong'
			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'ping') {
					callback('something else');
				}
			});

			const result = await socketService.healthCheck();
			expect(result).toBe(false);
		});
	});

	describe('Status and Information', () => {
		it('should report status correctly', () => {
			const status = socketService.getStatus();
			
			expect(status).toHaveProperty('connected');
			expect(status).toHaveProperty('connecting');
			expect(status).toHaveProperty('authenticated');
			expect(status).toHaveProperty('connectionAttempts');
			expect(status.connected).toBe(false);
		});
	});

	describe('Cleanup and Disposal', () => {
		it('should clean up all resources on dispose', () => {
			socketService.dispose();
			
			// Should have cleaned up socket if it existed
			expect(socketService._socket).toBeNull();
		});

		it('should be safe to dispose multiple times', () => {
			socketService.dispose();
			socketService.dispose(); // Should not throw
			
			expect(socketService._socket).toBeNull();
		});
	});
});