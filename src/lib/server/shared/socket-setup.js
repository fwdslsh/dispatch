import { Server } from 'socket.io';
import { logger } from './utils/logger.js';
import { SocketEventMediator } from '../socket/SocketEventMediator.js';
import { createLoggingMiddleware } from '../socket/middleware/logging.js';
import { createErrorHandlingMiddleware } from '../socket/middleware/errorHandling.js';
import { createSessionHandlers } from '../socket/handlers/sessionHandlers.js';
import { CookieService } from '../auth/CookieService.server.js';

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

/**
 * Parse cookies from Socket.IO handshake headers
 * Socket.IO doesn't provide parsed cookies like SvelteKit, so we parse manually
 */
function parseCookies(cookieHeader) {
	if (!cookieHeader) return {};

	const cookies = {};
	cookieHeader.split(';').forEach((cookie) => {
		const [name, ...rest] = cookie.trim().split('=');
		if (name && rest.length > 0) {
			cookies[name] = decodeURIComponent(rest.join('='));
		}
	});
	return cookies;
}

/**
 * Validate authentication for Socket.IO connections
 * Supports both session cookies and API keys
 *
 * @param {object} socket - Socket.IO socket instance
 * @param {string} token - API key or session ID from client
 * @param {function} callback - Callback function for response
 * @param {object} services - Services object (auth, sessionManager)
 * @returns {Promise<boolean>} True if authenticated, false otherwise
 */
async function requireValidAuth(socket, token, callback, services) {
	const { auth: authService, sessionManager } = services;

	// Validate using AuthService (supports both API keys and OAuth sessions)
	const authResult = await authService.validateAuth(token);

	if (!authResult.valid) {
		logger.warn('SOCKET', `Invalid authentication token from socket ${socket.id}`);
		if (callback) callback({ success: false, error: 'Invalid authentication token' });
		return false;
	}

	// Store auth context in socket data
	socket.data.authenticated = true;
	socket.data.auth = {
		provider: authResult.provider,
		userId: authResult.userId,
		apiKeyId: authResult.apiKeyId,
		label: authResult.label
	};

	logger.debug('SOCKET', `Socket ${socket.id} authenticated via ${authResult.provider}`);
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

	// Create session handlers
	const sessionHandlers = createSessionHandlers(sessionOrchestrator);

	// Register event handlers
	// Auth events
	mediator.on('client:hello', async (socket, data, callback) => {
		logger.info('SOCKET', `Received client:hello from ${socket.id}:`, data);
		const { clientId, sessionId, apiKey, terminalKey } = data || {};

		// Strategy 1: Check for sessionId (browser authentication via cookie)
		if (sessionId) {
			const sessionData = await services.sessionManager.validateSession(sessionId);
			if (sessionData) {
				socket.data.authenticated = true;
				socket.data.auth = {
					provider: sessionData.session.provider,
					userId: sessionData.session.userId
				};
				socket.data.session = sessionData.session;
				socket.data.user = sessionData.user;

				logger.debug('SOCKET', `Socket ${socket.id} authenticated via session cookie`);
				if (callback) callback({ success: true, message: 'Authenticated via session' });
				return;
			}
		}

		// Strategy 2: Check for apiKey or legacy terminalKey
		const token = apiKey || terminalKey;
		if (token) {
			const isValid = await requireValidAuth(socket, token, callback, services);
			if (isValid && callback) {
				callback({ success: true, message: 'Authenticated via API key' });
			}
			return;
		}

		// Strategy 3: Check for session cookie in handshake headers
		const cookieHeader = socket.handshake.headers.cookie;
		if (cookieHeader) {
			const cookies = parseCookies(cookieHeader);
			const cookieSessionId = cookies[CookieService.COOKIE_NAME];

			if (cookieSessionId) {
				const sessionData = await services.sessionManager.validateSession(cookieSessionId);
				if (sessionData) {
					socket.data.authenticated = true;
					socket.data.auth = {
						provider: sessionData.session.provider,
						userId: sessionData.session.userId
					};
					socket.data.session = sessionData.session;
					socket.data.user = sessionData.user;

					logger.debug('SOCKET', `Socket ${socket.id} authenticated via cookie header`);
					if (callback) callback({ success: true, message: 'Authenticated via cookie' });
					return;
				}
			}
		}

		// No valid authentication found
		logger.warn('SOCKET', `Socket ${socket.id} failed authentication - no valid credentials`);
		if (callback) {
			callback({
				success: false,
				error: 'Authentication required (sessionId, apiKey, or valid cookie)'
			});
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
			const { apiKey, terminalKey } = data || {};
			const token = apiKey || terminalKey;

			if (token) {
				const isValid = await requireValidAuth(socket, token, callback, services);
				if (!isValid) return;
			} else if (!socket.data.authenticated) {
				logger.warn('SOCKET', `Unauthenticated tunnel:start from socket ${socket.id}`);
				if (callback) callback({ success: false, error: 'Authentication required' });
				return;
			}

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
			const { apiKey, terminalKey } = data || {};
			const token = apiKey || terminalKey;

			if (token) {
				const isValid = await requireValidAuth(socket, token, callback, services);
				if (!isValid) return;
			} else if (!socket.data.authenticated) {
				logger.warn('SOCKET', `Unauthenticated tunnel:stop from socket ${socket.id}`);
				if (callback) callback({ success: false, error: 'Authentication required' });
				return;
			}

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
			const { apiKey, terminalKey } = data || {};
			const token = apiKey || terminalKey;

			if (token) {
				const isValid = await requireValidAuth(socket, token, callback, services);
				if (!isValid) return;
			} else if (!socket.data.authenticated) {
				logger.warn('SOCKET', `Unauthenticated vscode-tunnel:start from socket ${socket.id}`);
				if (callback) callback({ success: false, error: 'Authentication required' });
				return;
			}

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
			const { apiKey, terminalKey } = data || {};
			const token = apiKey || terminalKey;

			if (token) {
				const isValid = await requireValidAuth(socket, token, callback, services);
				if (!isValid) return;
			} else if (!socket.data.authenticated) {
				logger.warn('SOCKET', `Unauthenticated vscode-tunnel:stop from socket ${socket.id}`);
				if (callback) callback({ success: false, error: 'Authentication required' });
				return;
			}

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

		// Set up periodic session validation (every 60s) for cookie-based auth
		// This ensures sessions expire in real-time even during active connections
		let sessionValidationTimer = null;
		if (socket.data.session) {
			sessionValidationTimer = setInterval(async () => {
				try {
					const sessionId = socket.data.session.id;
					const sessionData = await services.sessionManager.validateSession(sessionId);

					if (!sessionData) {
						// Session has expired - notify client and disconnect
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
			}, 60000); // 60 seconds
		}

		socket.on('disconnect', (reason) => {
			logger.info('SOCKET', `Client disconnected: ${socket.id}, reason: ${reason}`);
			logSocketEvent(socket.id, 'disconnect', { reason });

			// Clean up session validation timer
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
