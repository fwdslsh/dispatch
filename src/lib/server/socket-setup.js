import { Server } from 'socket.io';
import { validateKey } from './auth.js';
import { logger } from './utils/logger.js';
import { createHistoryManager } from './history-manager.js';
import { readFileSync } from 'node:fs';
import { claudeAuthManager } from './claude/ClaudeAuthManager.js';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { SOCKET_EVENTS } from '../shared/socket-events.js';
import { createSocketErrorHandler } from './utils/error-handling.js';
import { safeClone } from './utils/data-utils.js';
import { hasMethod } from './utils/method-utils.js';

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
	// Safely clone data for logging
	const safeData = safeClone(data);

	const event = {
		socketId,
		type: eventType,
		data: safeData,
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

	// Add to persistent history (use safeData to avoid non-serializable inputs)
	try {
		let direction = 'system';
		if (eventType.includes('.write') || eventType.includes('.send')) {
			direction = 'in';
		} else if (eventType.includes('.data') || eventType.includes('.delta')) {
			direction = 'out';
		}
		// Use the historyManager from the setupSocketIO closure
		if (activeIO && activeIO.historyManager) {
			activeIO.historyManager.addEvent(socketId, eventType, direction, safeData);
		}
	} catch (error) {
		console.error('[HISTORY] Failed to log event to history:', error);
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


// Helper to get services with error handling
function getServicesOrThrow(getServices) {
	const services = getServices();
	if (!services.terminalManager || !services.claudeSessionManager) {
		throw new Error('Managers not available');
	}
	return services;
}

export function setupSocketIO(httpServer, services) {
	const io = new Server(httpServer, {
		cors: { origin: '*', methods: ['GET', 'POST'] }
	});
	activeIO = io;

	// Create history manager with database from services
	const historyManager = createHistoryManager(services?.database);
	// @ts-ignore - Adding custom property to Socket.IO instance
	io.historyManager = historyManager;

	// Create standardized socket error handler
	const handleSocketError = createSocketErrorHandler('SOCKET');

	// Set Socket.IO on services that need it
	if (services) {
		try {
			if (hasMethod(services.claudeSessionManager, 'setSocketIO')) {
				services.claudeSessionManager.setSocketIO(io);
			}
			if (hasMethod(services.terminalManager, 'setSocketIO')) {
				services.terminalManager.setSocketIO(io);
			}
		} catch (error) {
			logger.error('SOCKET_SETUP', 'Failed to register Socket.IO instance with services:', error);
		}
	}

	// Get services - now just return the passed services
	const getServices = () => {
		if (!services) {
			logger.error('SOCKET_SETUP', 'Services not provided');
			return {};
		}
		return services;
	};

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

io.on('connection', async (socket) => {
		const sessionId = socket.handshake.query?.sessionId;
		logger.info('SOCKET', `Client connected: ${socket.id}, sessionId: ${sessionId}`);

		// Track connection (auth state already initialized in middleware)
		socket.data.connectedAt = Date.now();
		socket.data.sessionId = sessionId; // Store session ID for session-based connections

		// Session-based connections handle session association dynamically through event routing
		// Sessions will manage their own working directories once created

		const connectionMetadata = {
			ip: socket.handshake.address || socket.conn.remoteAddress,
			userAgent: socket.handshake.headers['user-agent']
		};

		await historyManager.initializeSocket(socket.id, connectionMetadata);
		logSocketEvent(socket.id, 'connection', connectionMetadata);

		// Authentication event - validates a key without starting a terminal
		socket.on('auth', handleSocketError(
			(key, callback) => requireValidKey(socket, key, callback),
			'auth'
		));

		// Terminal start event (creates new terminal session)
		socket.on('terminal.start', handleSocketError(async (data, callback) => {
			if (!requireValidKey(socket, data.key, callback)) return;

			const { terminalManager } = getServicesOrThrow(getServices);

			// Generate app session ID if not provided
			const appSessionId = data.sessionId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

			const session = await terminalManager.start({
				workspacePath: data.workspacePath || '/tmp',
				shell: data.shell,
				env: data.env,
				appSessionId,
				socket
			});
			logger.info('SOCKET', `Terminal session created: ${session.id} (app session: ${appSessionId})`);
			if (callback) callback({ success: true, id: appSessionId, typeSpecificId: session.id });
		}, 'terminal.start'));

		// Terminal write event
		socket.on('terminal.write', async (data) => {
			if (!requireValidKey(socket, data.key)) return;
			try {
				const { terminalManager } = getServicesOrThrow(getServices);
				terminalManager.write(data.id, data.data);
			} catch (err) {
				logger.error('SOCKET', 'Terminal write error:', err);
			}
		});

		// Terminal resize event
		socket.on(SOCKET_EVENTS.TERMINAL_RESIZE, async (data) => {
			if (!requireValidKey(socket, data.key)) return;
			logger.debug('SOCKET', 'terminal.resize received:', data);
			try {
				const { terminalManager } = getServices();

				if (!terminalManager) {
					throw new Error('Terminal manager not available for terminal resize');
				}

				terminalManager.resize(data.id, data.cols, data.rows);
				logger.debug('SOCKET', `Terminal ${data.id} resized`);
			} catch (err) {
				console.error(`[SOCKET] Terminal resize error:`, err);
			}
		});

		// Claude send event
		socket.on(SOCKET_EVENTS.CLAUDE_SEND, async (data) => {
			if (!requireValidKey(socket, data.key)) return;
			try {
				const { claudeSessionManager } = getServicesOrThrow(getServices);

				// Get existing session or create new one
				let session = claudeSessionManager.getSession(data.id);
				if (!session) {
					session = await claudeSessionManager.create({
						workspacePath: data.workspacePath || '/tmp',
						options: { ...data.options, socket }
					});
				}

				await claudeSessionManager.send(data.id, data.input);
			} catch (err) {
				logger.error('SOCKET', 'Claude send error:', err);
			}
		});

		// Claude OAuth: submit authorization code
		socket.on(SOCKET_EVENTS.CLAUDE_AUTH_CODE, (data = {}) => {
			if (!requireValidKey(socket, data.key)) return;
			try {
				logger.info('SOCKET', 'CLAUDE_AUTH_CODE received');
				const code = String(data.code || '').trim();
				if (!code) {
					try {
						socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, {
							success: false,
							error: 'Missing authorization code'
						});
					} catch {}
					return;
				}
				claudeAuthManager.submitCode(socket, code);
			} catch (e) {
				logger.error('SOCKET', 'CLAUDE_AUTH_CODE error:', e);
				try {
					socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, {
						success: false,
						error: String(e?.message || e)
					});
				} catch {}
			}
		});

		// Session status check
		socket.on(SOCKET_EVENTS.SESSION_STATUS, (data, callback) => {
			if (!requireValidKey(socket, data.key, callback)) return;
			logger.debug('SOCKET', 'session.status received:', data);
			try {
				const { terminalManager, claudeSessionManager } = getServices();

				if (data.sessionId) {
					// Try to find session in either manager
					let session = terminalManager?.getTerminal(data.sessionId) || claudeSessionManager?.getSession(data.sessionId);

					if (session) {
						// Default activity state - managers would need to track this if needed
						const activityState = 'idle';
						const hasPendingMessages = false;

						if (callback)
							callback({
								success: true,
								activityState,
								hasPendingMessages,
								availableCommands: null,
								sessionInfo: { id: data.sessionId }
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
				logger.error('SOCKET', 'Session status error:', err);
				if (callback) callback({ success: false, error: err.message });
			}
		});

		// Session catchup event
		socket.on(SOCKET_EVENTS.SESSION_CATCHUP, (data) => {
			logger.debug('SOCKET', 'session.catchup received:', data);
			// Could be used to resend missed messages if needed
		});

		// Session history load event - loads historical terminal/claude data
		socket.on(SOCKET_EVENTS.SESSION_HISTORY_LOAD, async (data, callback) => {
			if (!requireValidKey(socket, data.key, callback)) return;
			logger.debug('SOCKET', 'session.history.load received:', data);
			try {
				const { terminalManager } = getServices();

				if (!data.sessionId) {
					if (callback)
						callback({
							success: false,
							error: 'sessionId missing'
						});
					return;
				}

				// Load terminal history if available
				let historyData = '';
				if (terminalManager?.loadTerminalHistory) {
					historyData = await terminalManager.loadTerminalHistory(data.sessionId);
				}

				logger.info(
					'SOCKET',
					`Loading history for session ${data.sessionId}: ${historyData.length} chars`
				);

				if (callback) {
					callback({
						success: true,
						sessionId: data.sessionId,
						history: historyData
					});
				}
			} catch (err) {
				logger.error('SOCKET', 'Session history load error:', err);
				if (callback) callback({ success: false, error: err.message });
			}
		});

		// Commands refresh event - canonical Claude name
		socket.on(SOCKET_EVENTS.CLAUDE_COMMANDS_REFRESH, async (data, callback) => {
			if (!requireValidKey(socket, data.key, callback)) return;
			logger.debug('SOCKET', 'claude.commands.refresh received:', data);
			try {
				const { claudeSessionManager } = getServices();

				if (claudeSessionManager?.refreshCommands && data.sessionId) {
					try {
						const commands = await claudeSessionManager.refreshCommands(data.sessionId);
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
							error: 'Claude session manager or refresh method not available',
							sessionId: data.sessionId
						});
					}
				}
			} catch (err) {
				logger.error('SOCKET', 'Commands refresh handler error:', err);
				if (callback) callback({ success: false, error: err.message });
			}
		});

		// Public URL retrieval
		socket.on(SOCKET_EVENTS.GET_PUBLIC_URL, (callback) => {
			logger.debug('SOCKET', 'get-public-url handler called');
			try {
				const configDir =
					process.env.DISPATCH_CONFIG_DIR ||
					(process.platform === 'win32'
						? join(process.env.HOME || homedir(), 'dispatch')
						: join(process.env.HOME || homedir(), '.config', 'dispatch'));

				const tunnelFile = join(configDir, 'tunnel-url.txt');

				try {
					const url = readFileSync(tunnelFile, 'utf-8').trim();
					if (url) {
						logger.info('SOCKET', 'Public URL retrieved:', url);
						if (callback) {
							callback({ ok: true, url });
						}
						return;
					}
				} catch (readError) {
					logger.debug('SOCKET', 'Tunnel URL file not found:', tunnelFile);
				}

				if (callback) {
					callback({ ok: false });
				}
			} catch (error) {
				logger.error('SOCKET', 'Error handling get-public-url:', error);
				if (callback) {
					callback({ ok: false, error: error.message });
				}
			}
		});

		socket.on(SOCKET_EVENTS.DISCONNECT, () => {
			logger.debug('SOCKET', `Client disconnected: ${socket.id}`);
			logSocketEvent(socket.id, 'disconnect');
			historyManager.finalizeSocket(socket.id);
		});
	});


	logger.info('SOCKET', 'Simplified Socket.IO server initialized');
	return io;
}
