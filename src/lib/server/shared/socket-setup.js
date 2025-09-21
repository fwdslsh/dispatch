import { Server } from 'socket.io';
import { validateKey } from './auth.js';
import { logger } from './utils/logger.js';

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
function requireValidKey(socket, key, callback) {
	if (!validateKey(key)) {
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

	const { runSessionManager } = services;

	if (!runSessionManager) {
		logger.error('SOCKET_SETUP', 'RunSessionManager not provided in services');
		throw new Error('RunSessionManager is required for socket setup');
	}

	// Ensure the RunSessionManager can emit real-time events through this Socket.IO instance
	runSessionManager.setSocketIO(io);

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

		// Track connection
		socket.data.connectedAt = Date.now();
		logSocketEvent(socket.id, 'connection');

		// ===== UNIFIED RUN SESSION HANDLERS =====

		// Authentication event - validates a key without starting a session
		socket.on('auth', (key, callback) => {
			try {
				logger.info('SOCKET', `Auth event received from ${socket.id}`);
				if (requireValidKey(socket, key, callback)) {
					// Key is valid, send success response
					if (callback) callback({ success: true });
				}
				// Error response already sent by requireValidKey if key was invalid
			} catch (error) {
				logger.error('SOCKET', 'Auth handler error:', error);
				if (callback) callback({ success: false, error: 'Authentication failed' });
			}
		});

		// Client identification with stable clientId
		socket.on('client:hello', ({ clientId }) => {
			if (!socket.data.authenticated) {
				logger.warn('SOCKET', `Unauthenticated client:hello from ${socket.id}`);
				return;
			}

			socket.data.clientId = clientId;
			logger.info('SOCKET', `Client identified: ${clientId} (socket: ${socket.id})`);
		});

		// Attach to run session with event backlog
		socket.on('run:attach', async ({ runId, afterSeq }, ack) => {
			if (!socket.data.authenticated) {
				ack?.({ error: 'Not authenticated' });
				return;
			}

			try {
				// Join the run session room
				socket.join(`run:${runId}`);

				// Get event backlog since afterSeq
				const backlog = await runSessionManager.getEventsSince(runId, afterSeq || 0);

				logger.info(
					'SOCKET',
					`Client attached to run:${runId}, sent ${backlog.length} events since seq ${afterSeq || 0}`
				);

				if (ack) {
					ack({ success: true, events: backlog });
				}
			} catch (error) {
				logger.error('SOCKET', `Failed to attach to run:${runId}`, error);
				if (ack) {
					ack({ success: false, error: 'Failed to attach to run session' });
				}
			}
		});

		// Send input to run session
		socket.on('run:input', async ({ runId, data }) => {
			if (!socket.data.authenticated) {
				logger.warn('SOCKET', `Unauthenticated run:input from ${socket.id}`);
				return;
			}

			try {
				await runSessionManager.sendInput(runId, data);
				logger.debug('SOCKET', `Input sent to run:${runId}`);
			} catch (error) {
				logger.error('SOCKET', `Failed to send input to run:${runId}:`, error);
				// Optionally emit error back to client
				socket.emit('run:error', {
					runId,
					error: error.message,
					type: 'input_failed'
				});
			}
		});

		// Resize terminal (PTY-specific operation)
		socket.on('run:resize', async ({ runId, cols, rows }) => {
			if (!socket.data.authenticated) {
				logger.warn('SOCKET', `Unauthenticated run:resize from ${socket.id}`);
				return;
			}

			try {
				await runSessionManager.performOperation(runId, 'resize', [cols, rows]);
				logger.debug('SOCKET', `Resized run:${runId} to ${cols}x${rows}`);
			} catch (error) {
				logger.error('SOCKET', `Failed to resize run:${runId}:`, error);
				// Silently ignore resize errors (might not be supported by adapter)
			}
		});

		// Close run session
		socket.on('run:close', async ({ runId }) => {
			if (!socket.data.authenticated) {
				logger.warn('SOCKET', `Unauthenticated run:close from ${socket.id}`);
				return;
			}

			try {
				await runSessionManager.closeRunSession(runId);
				socket.leave(`run:${runId}`);
				logger.info('SOCKET', `Run session closed: ${runId}`);
			} catch (error) {
				logger.error('SOCKET', `Failed to close run:${runId}:`, error);
			}
		});

		// ===== ADMIN AND UTILITY HANDLERS =====

		// Public URL retrieval (unchanged)
		socket.on('get-public-url', (callback) => {
			logger.debug('SOCKET', 'get-public-url handler called');
			try {
				const tunnelManager = services.tunnelManager;
				const url = tunnelManager.getPublicUrl();
				if (callback) {
					callback({ ok: !!url, url: url });
				}
			} catch (error) {
				logger.error('SOCKET', 'Error handling get-public-url:', error);
				if (callback) {
					callback({ ok: false, error: error.message });
				}
			}
		});

		// Tunnel control handlers
		socket.on('tunnel.enable', (data, callback) => {
			if (!socket.data.authenticated) {
				logger.warn('SOCKET', `Unauthenticated tunnel.enable from ${socket.id}`);
				if (callback) callback({ success: false, error: 'Unauthorized' });
				return;
			}

			logger.info('SOCKET', `Tunnel enable requested by socket ${socket.id}`);
			const tunnelManager = services.tunnelManager;

			tunnelManager
				.start()
				.then((success) => {
					const status = tunnelManager.getStatus();
					logger.info('SOCKET', `Tunnel enable result: ${success}`, status);
					if (callback) {
						callback({ success, status });
					}
					// Broadcast status to all connected clients
					io.emit('tunnel.status', status);
				})
				.catch((error) => {
					logger.error('SOCKET', 'Error enabling tunnel:', error);
					if (callback) {
						callback({ success: false, error: error.message });
					}
				});
		});

		socket.on('tunnel.disable', (data, callback) => {
			if (!socket.data.authenticated) {
				logger.warn('SOCKET', `Unauthenticated tunnel.disable from ${socket.id}`);
				if (callback) callback({ success: false, error: 'Unauthorized' });
				return;
			}

			logger.info('SOCKET', `Tunnel disable requested by socket ${socket.id}`);
			const tunnelManager = services.tunnelManager;
			const success = tunnelManager.stop();
			const status = tunnelManager.getStatus();

			logger.info('SOCKET', `Tunnel disable result: ${success}`, status);
			if (callback) {
				callback({ success, status });
			}
			// Broadcast status to all connected clients
			io.emit('tunnel.status', status);
		});

		socket.on('tunnel.status', (callback) => {
			logger.debug('SOCKET', 'tunnel.status handler called');
			try {
				const tunnelManager = services.tunnelManager;
				const status = tunnelManager.getStatus();
				if (callback) {
					callback({ success: true, status });
				}
			} catch (error) {
				logger.error('SOCKET', 'Error getting tunnel status:', error);
				if (callback) {
					callback({ success: false, error: error.message });
				}
			}
		});

		socket.on('disconnect', () => {
			logger.info('SOCKET', `Client disconnected: ${socket.id}`);
			logSocketEvent(socket.id, 'disconnect');
		});
	});

	logger.info('SOCKET', 'Unified Socket.IO server initialized with run session handlers');
	return io;
}
