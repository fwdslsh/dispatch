import { Server } from 'socket.io';
import { logger } from './utils/logger.js';
import { SocketEventMediator } from '../socket/SocketEventMediator.js';
import { createLoggingMiddleware } from '../socket/middleware/logging.js';
import { createErrorHandlingMiddleware } from '../socket/middleware/errorHandling.js';
import { createSessionHandlers } from '../socket/handlers/sessionHandlers.js';

// Admin event tracking
let socketEvents = [];
let activeIO = null;

/**
 * Get the active Socket.IO instance
 * @returns {object|null} Socket.IO server instance
 */
export function getActiveSocketIO() {
	return activeIO;
}

function logSocketEvent(socketId, eventType, data = null) {
	const event = {
		socketId,
		type: eventType,
		data: data,
		timestamp: Date.now()
	};

	socketEvents.unshift(event);

	// Keep only the most recent 500 events
	if (socketEvents.length > 500) {
		socketEvents = socketEvents.slice(0, 500);
	}

	// Emit to admin console if needed
	try {
		const io = activeIO;
		if (io) {
			io.emit('admin.event.logged', event);
		}
	} catch (error) {
		// Silently ignore errors
	}
}

export function getSocketEvents(limit = 100) {
	return socketEvents.slice(0, Math.min(limit, socketEvents.length));
}

// Helper function for auth validation in event handlers
async function requireValidKey(socket, key, callback, authService) {
	const isValid = await authService.validateKey(key);
	if (!isValid) {
		logger.warn('SOCKET', `Invalid key from socket ${socket.id}`);
		if (callback) callback({ success: false, error: 'Invalid key' });
		return false;
	}
	socket.data.authenticated = true;
	return true;
}

/**
 * Setup Socket.IO with SocketEventMediator architecture
 */
export function setupSocketIO(httpServer, services) {
	logger.info('SOCKET', 'Initializing Socket.IO server with SocketEventMediator');

	const io = new Server(httpServer, {
		cors: { origin: '*', methods: ['GET', 'POST'] }
	});
	activeIO = io;

	// Set Socket.IO instance on Tunnel Managers for broadcasting
	if (services.tunnelManager) {
		services.tunnelManager.setSocketIO(io);
	}
	if (services.vscodeManager) {
		services.vscodeManager.setSocketIO(io);
	}

	const { sessionOrchestrator, eventRecorder, auth: authService } = services;

	if (!sessionOrchestrator) {
		logger.error('SOCKET_SETUP', 'SessionOrchestrator not provided in services');
		throw new Error('SessionOrchestrator is required for socket setup');
	}

	if (!authService) {
		logger.error('SOCKET_SETUP', 'AuthService not provided in services');
		throw new Error('AuthService is required for socket setup');
	}

	// Subscribe to EventRecorder for real-time event emission
	eventRecorder.subscribe('event', (eventData) => {
		const { sessionId, ...event } = eventData;
		io.to(`run:${sessionId}`).emit('run:event', event);
	});

	logger.info('SOCKET', 'EventRecorder subscribed for real-time emission');

	// Create SocketEventMediator
	const mediator = new SocketEventMediator(io);

	// Register middleware
	mediator.use(createLoggingMiddleware({ verbose: false }));
	mediator.use(createErrorHandlingMiddleware());

	// Add packet logging middleware directly to io
	io.use((socket, next) => {
		socket.use((packet, next) => {
			const [event, data] = packet;
			const logData = event.includes('key') || event.includes('auth') ? '[REDACTED]' : data;
			logSocketEvent(socket.id, event, logData);
			next();
		});
		next();
	});

	// Create session handlers
	const sessionHandlers = createSessionHandlers(sessionOrchestrator);

	// Register event handlers
	// Auth events
	mediator.on('client:hello', async (socket, data, callback) => {
		logger.info('SOCKET', `Received client:hello from ${socket.id}:`, data);
		const { clientId, terminalKey } = data || {};

		if (terminalKey) {
			const isValid = await requireValidKey(socket, terminalKey, callback, authService);
			if (isValid && callback) {
				callback({ success: true, message: 'Authenticated' });
			}
		} else if (callback) {
			callback({ success: false, error: 'Missing terminalKey' });
		}
	});

	// Session events
	mediator.on('run:attach', async (socket, data, callback) => {
		try {
			const result = await sessionHandlers.attach(socket, data);
			if (callback) callback(result);
		} catch (error) {
			logger.error('SOCKET', 'Error in run:attach:', error);
			if (callback) callback({ success: false, error: error.message });
		}
	});

	mediator.on('run:input', async (socket, data) => {
		try {
			await sessionHandlers.input(socket, data);
		} catch (error) {
			logger.error('SOCKET', 'Error in run:input:', error);
			socket.emit('error', { message: error.message });
		}
	});

	mediator.on('run:resize', async (socket, data, callback) => {
		try {
			const result = await sessionHandlers.resize(socket, data);
			if (callback) callback(result);
		} catch (error) {
			logger.error('SOCKET', 'Error in run:resize:', error);
			if (callback) callback({ success: false, error: error.message });
		}
	});

	mediator.on('run:close', async (socket, data, callback) => {
		try {
			const result = await sessionHandlers.close(socket, data);
			if (callback) callback(result);
		} catch (error) {
			logger.error('SOCKET', 'Error in run:close:', error);
			if (callback) callback({ success: false, error: error.message });
		}
	});

	// Tunnel events
	mediator.on('tunnel:start', async (socket, data, callback) => {
		try {
			const { terminalKey } = data || {};
			const isValid = await requireValidKey(socket, terminalKey, callback, authService);
			if (!isValid) return;

			const result = await services.tunnelManager.startTunnel();
			if (callback) {
				callback({
					success: true,
					url: result.url,
					status: result.status
				});
			}
		} catch (error) {
			logger.error('SOCKET', 'Error starting tunnel:', error);
			if (callback) callback({ success: false, error: error.message });
		}
	});

	mediator.on('tunnel:stop', async (socket, data, callback) => {
		try {
			const { terminalKey } = data || {};
			const isValid = await requireValidKey(socket, terminalKey, callback, authService);
			if (!isValid) return;

			await services.tunnelManager.stopTunnel();
			if (callback) callback({ success: true });
		} catch (error) {
			logger.error('SOCKET', 'Error stopping tunnel:', error);
			if (callback) callback({ success: false, error: error.message });
		}
	});

	mediator.on('tunnel:status', async (socket, data, callback) => {
		try {
			const status = services.tunnelManager.getStatus();
			if (callback) callback({ success: true, status });
		} catch (error) {
			logger.error('SOCKET', 'Error getting tunnel status:', error);
			if (callback) callback({ success: false, error: error.message });
		}
	});

	// VS Code tunnel events
	mediator.on('vscode-tunnel:start', async (socket, data, callback) => {
		try {
			const { terminalKey } = data || {};
			const isValid = await requireValidKey(socket, terminalKey, callback, authService);
			if (!isValid) return;

			const result = await services.vscodeManager.startTunnel();
			if (callback) {
				callback({
					success: true,
					url: result.url,
					status: result.status
				});
			}
		} catch (error) {
			logger.error('SOCKET', 'Error starting VS Code tunnel:', error);
			if (callback) callback({ success: false, error: error.message });
		}
	});

	mediator.on('vscode-tunnel:stop', async (socket, data, callback) => {
		try {
			const { terminalKey } = data || {};
			const isValid = await requireValidKey(socket, terminalKey, callback, authService);
			if (!isValid) return;

			await services.vscodeManager.stopTunnel();
			if (callback) callback({ success: true });
		} catch (error) {
			logger.error('SOCKET', 'Error stopping VS Code tunnel:', error);
			if (callback) callback({ success: false, error: error.message });
		}
	});

	mediator.on('vscode-tunnel:status', async (socket, data, callback) => {
		try {
			const status = services.vscodeManager.getStatus();
			if (callback) callback({ success: true, status });
		} catch (error) {
			logger.error('SOCKET', 'Error getting VS Code tunnel status:', error);
			if (callback) callback({ success: false, error: error.message });
		}
	});

	// Handle connection and disconnection events
	io.on('connection', (socket) => {
		logger.info('SOCKET', `Client connected: ${socket.id}`);
		logSocketEvent(socket.id, 'connection', null);

		socket.on('disconnect', (reason) => {
			logger.info('SOCKET', `Client disconnected: ${socket.id}, reason: ${reason}`);
			logSocketEvent(socket.id, 'disconnect', { reason });
		});
	});

	// Initialize mediator (this sets up event handlers)
	mediator.initialize();

	logger.info('SOCKET', 'Socket.IO setup complete with SocketEventMediator');

	return io;
}
