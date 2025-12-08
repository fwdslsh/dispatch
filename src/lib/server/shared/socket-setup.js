/**
 * Socket.IO Setup
 *
 * v2.0 Hard Fork: Removed Claude-specific authentication handlers
 * @file src/lib/server/shared/socket-setup.js
 */

import { Server } from 'socket.io';
import { logger } from './utils/logger.js';
import { SocketEventMediator } from '../socket/SocketEventMediator.js';
import { createLoggingMiddleware } from '../socket/middleware/logging.js';
import { createErrorHandlingMiddleware } from '../socket/middleware/errorHandling.js';
import { requireAuth } from '../socket/middleware/authentication.js';
import { createSessionHandlers } from '../socket/handlers/sessionHandlers.js';
import { createTunnelHandlers } from '../socket/handlers/tunnelHandlers.js';
import { createVSCodeHandlers } from '../socket/handlers/vscodeHandlers.js';

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
	} catch (_error) {
		// Silently ignore errors
	}
}

export function getSocketEvents(limit = 100) {
	return socketEvents.slice(0, Math.min(limit, socketEvents.length));
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

	const { sessionOrchestrator, eventRecorder } = services;

	if (!sessionOrchestrator) {
		logger.error('SOCKET_SETUP', 'SessionOrchestrator not provided in services');
		throw new Error('SessionOrchestrator is required for socket setup');
	}

	if (!services.auth) {
		logger.error('SOCKET_SETUP', 'AuthService not provided in services');
		throw new Error('AuthService is required for socket setup');
	}

	// Remove all previous listeners before subscribing (prevents memory leak on hot reload)
	eventRecorder.removeAllListeners();

	// Subscribe to EventRecorder for real-time event emission
	eventRecorder.subscribe('event', (eventData) => {
		const { sessionId } = eventData;
		// Ensure runId exists for client compatibility (client expects event.runId)
		eventData.runId = eventData.runId || sessionId;
		io.to(`run:${sessionId}`).emit('run:event', eventData);
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

	// Create domain-specific handlers
	const sessionHandlers = createSessionHandlers(sessionOrchestrator);
	const tunnelHandlers = createTunnelHandlers(services.tunnelManager);
	const vscodeHandlers = createVSCodeHandlers(services.vscodeManager);

	// Register authentication event (client:hello)
	// This event handles all authentication strategies and is the only one that doesn't require prior auth
	mediator.on('client:hello', async (socket, data, callback) => {
		logger.info('SOCKET', `Received client:hello from ${socket.id}:`, data);

		// Use authentication middleware to validate all strategies
		const authenticated = await requireAuth(socket, data, callback, services);

		if (authenticated && callback) {
			const provider = socket.data.auth?.provider || 'unknown';
			callback({
				success: true,
				message: `Authenticated via ${provider}`
			});
		}
	});

	// Register session event handlers
	mediator.on('run:attach', async (socket, data, callback) => {
		if (!(await requireAuth(socket, data, callback, services))) return;
		const result = await sessionHandlers.attach(socket, data);
		if (callback) callback(result);
	});

	mediator.on('run:input', async (socket, data) => {
		if (!(await requireAuth(socket, data, null, services))) return;
		await sessionHandlers.input(socket, data);
	});

	mediator.on('run:resize', async (socket, data, callback) => {
		if (!(await requireAuth(socket, data, callback, services))) return;
		const result = await sessionHandlers.resize(socket, data);
		if (callback) callback(result);
	});

	mediator.on('run:close', async (socket, data, callback) => {
		if (!(await requireAuth(socket, data, callback, services))) return;
		const result = await sessionHandlers.close(socket, data);
		if (callback) callback(result);
	});

	// Register tunnel event handlers
	mediator.on('tunnel:start', async (socket, data, callback) => {
		if (!(await requireAuth(socket, data, callback, services))) return;
		await tunnelHandlers.start(socket, data, callback);
	});

	mediator.on('tunnel:stop', async (socket, data, callback) => {
		if (!(await requireAuth(socket, data, callback, services))) return;
		await tunnelHandlers.stop(socket, data, callback);
	});

	mediator.on('tunnel:status', async (socket, data, callback) => {
		// Status check doesn't require authentication
		await tunnelHandlers.status(socket, data, callback);
	});

	mediator.on('tunnel:updateConfig', async (socket, data, callback) => {
		if (!(await requireAuth(socket, data, callback, services))) return;
		await tunnelHandlers.updateConfig(socket, data, callback);
	});

	// Register VS Code tunnel event handlers
	mediator.on('vscode-tunnel:start', async (socket, data, callback) => {
		if (!(await requireAuth(socket, data, callback, services))) return;
		await vscodeHandlers.start(socket, data, callback);
	});

	mediator.on('vscode-tunnel:stop', async (socket, data, callback) => {
		if (!(await requireAuth(socket, data, callback, services))) return;
		await vscodeHandlers.stop(socket, data, callback);
	});

	mediator.on('vscode-tunnel:status', async (socket, data, callback) => {
		// Status check doesn't require authentication
		await vscodeHandlers.status(socket, data, callback);
	});

	// Handle connection and disconnection events
	io.on('connection', (socket) => {
		logger.info('SOCKET', `Client connected: ${socket.id}`);
		logSocketEvent(socket.id, 'connection', null);

		// Set up periodic session validation (every 60s) for cookie-based auth
		let sessionValidationTimer = null;
		if (socket.data.session) {
			sessionValidationTimer = setInterval(async () => {
				try {
					const sessionId = socket.data.session.id;
					const sessionData = await services.sessionManager.validateSession(sessionId);

					if (!sessionData) {
						logger.info('SOCKET', `Session ${sessionId} expired for socket ${socket.id}`);
						socket.emit('session:expired', {
							message: 'Your session has expired. Please log in again.'
						});
						socket.disconnect(true);
						clearInterval(sessionValidationTimer);
					}
				} catch (error) {
					logger.error('SOCKET', `Error validating session for socket ${socket.id}:`, error);
				}
			}, 60000);
		}

		socket.on('disconnect', (reason) => {
			logger.info('SOCKET', `Client disconnected: ${socket.id}, reason: ${reason}`);
			logSocketEvent(socket.id, 'disconnect', { reason });

			if (sessionValidationTimer) {
				clearInterval(sessionValidationTimer);
			}
		});
	});

	// Initialize mediator (this sets up event handlers)
	mediator.initialize();

	logger.info('SOCKET', 'Socket.IO setup complete with SocketEventMediator');

	return io;
}
