import { Server } from 'socket.io';
import { logger } from './utils/logger.js';
import { SocketMediator } from './socket/SocketMediator.js';
import { registerAuthHandlers } from './socket/handlers/authHandlers.js';
import { registerRunSessionHandlers } from './socket/handlers/runSessionHandlers.js';
import { registerTunnelHandlers } from './socket/handlers/tunnelHandlers.js';
import { registerVSCodeTunnelHandlers } from './socket/handlers/vscodeTunnelHandlers.js';

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
		logger.debug('SOCKET', 'Failed to emit admin event log entry', error);
	}
}

export function getSocketEvents(limit = 100) {
	return socketEvents.slice(0, Math.min(limit, socketEvents.length));
}

// Phase 5: Helper function for auth validation in event handlers (now async for OAuth support)
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
 * Setup Socket.IO with unified run session handlers
 */
export function setupSocketIO(httpServer, services) {
	const io = new Server(httpServer, {
		cors: { origin: '*', methods: ['GET', 'POST'] }
	});
	activeIO = io;

	// Set Socket.IO instance on TunnelManager for broadcasting
	if (services.tunnelManager) {
		services.tunnelManager.setSocketIO(io);
	}
	if (services.vscodeManager) {
		services.vscodeManager.setSocketIO(io);
	}

	const { runSessionManager, auth: authService } = services;

	if (!runSessionManager) {
		logger.error('SOCKET_SETUP', 'RunSessionManager not provided in services');
		throw new Error('RunSessionManager is required for socket setup');
	}

	if (!authService) {
		logger.error('SOCKET_SETUP', 'AuthService not provided in services');
		throw new Error('AuthService is required for socket setup');
	}

	const runEventListener = ({ runSessionId, runId, event }) => {
		const resolvedId = runSessionId || runId;
		if (!resolvedId) return;
		io.to(`run:${resolvedId}`).emit('run:event', event);
		io.to(`runSession:${resolvedId}`).emit('runSession:event', event);
	};
	const runErrorListener = ({ runSessionId, runId, error }) => {
		const resolvedId = runSessionId || runId;
		logger.error('SOCKET', `Run session error for ${resolvedId}:`, error);
	};

	runSessionManager.on('runSession:event', runEventListener);
	runSessionManager.on('runSession:error', runErrorListener);

	const mediator = new SocketMediator(io, services, { requireValidKey, logger });

	registerAuthHandlers(mediator);
	registerRunSessionHandlers(mediator);
	registerTunnelHandlers(mediator);
	registerVSCodeTunnelHandlers(mediator);

	// Packet logging middleware
	io.use((socket, next) => {
		socket.use((packet, next) => {
			const [event, data] = packet;
			const logData = event.includes('key') || event.includes('auth') ? '[REDACTED]' : data;
			logSocketEvent(socket.id, event, logData);
			next();
		});
		next();
	});

	// Simple connection tracking
	io.use((socket, next) => {
		socket.data = socket.data || {};
		socket.data.authenticated = false;
		next();
	});

	io.on('connection', (socket) => {
		logger.info('SOCKET', `Client connected: ${socket.id}`);
		socket.data.connectedAt = Date.now();
		logSocketEvent(socket.id, 'connection');
		mediator.bindSocket(socket);
		socket.on('disconnect', () => {
			logger.info('SOCKET', `Client disconnected: ${socket.id}`);
			logSocketEvent(socket.id, 'disconnect');
		});
	});

	logger.info('SOCKET', 'Socket.IO server initialized with mediator-managed handlers');
	return io;
}
