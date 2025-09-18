import { Server } from 'socket.io';
import { validateKey } from './auth.js';
import { logger } from './utils/logger.js';
import { historyManager } from './history-manager.js';
import { readFileSync } from 'node:fs';
import { claudeAuthManager } from './claude/ClaudeAuthManager.js';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { SOCKET_EVENTS } from '../shared/socket-events.js';

// Admin event tracking
let socketEvents = [];
let activeIO = null;

function logSocketEvent(socketId, eventType, data = null) {
	// Safely clone data for logging
	let safeData = null;
	try {
		if (data === null || data === undefined) {
			safeData = null;
		} else if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
			safeData = data;
		} else if (typeof data === 'object') {
			if (typeof globalThis.structuredClone === 'function') {
				safeData = structuredClone(data);
			} else {
				const s = JSON.stringify(data);
				safeData = typeof s === 'string' ? JSON.parse(s) : null;
			}
		}
	} catch {
		safeData = null;
	}

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
		historyManager.addEvent(socketId, eventType, direction, safeData);
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

export function setupSocketIO(httpServer, serverContainer) {
	const io = new Server(httpServer, {
		cors: { origin: '*', methods: ['GET', 'POST'] }
	});
	activeIO = io;

	if (serverContainer && typeof serverContainer.setSocketIO === 'function') {
		try {
			serverContainer.setSocketIO(io);
		} catch (error) {
			logger.error(
				'SOCKET_SETUP',
				'Failed to register Socket.IO instance with service container:',
				error
			);
		}
	}

	// Get services from dependency injection container
	const getServices = () => {
		if (!serverContainer) {
			logger.error('SOCKET_SETUP', 'ServerServiceContainer not provided');
			return {};
		}

		try {
			return {
				database: serverContainer.get('database'),
				workspaceManager: serverContainer.get('workspaceManager'),
				sessionRegistry: serverContainer.get('sessionRegistry'),
				terminalManager: serverContainer.get('terminalManager'),
				claudeSessionManager: serverContainer.get('claudeSessionManager'),
				claudeAuthManager: serverContainer.get('claudeAuthManager'),
				messageBuffer: serverContainer.get('messageBuffer')
			};
		} catch (error) {
			logger.error('SOCKET_SETUP', 'Failed to get services from container:', error);
			return {};
		}
	};

	// Pass Socket.IO to session manager for real-time communication
	try {
		const { sessionRegistry } = getServices();
		if (sessionRegistry) {
			sessionRegistry.setSocketIO(io);
		}
	} catch (e) {
		console.error('[SOCKET] Failed to attach io to session manager:', e);
	}

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
		socket.data.sessionId = sessionId; // Store session ID in socket data

		// If sessionId is provided, try to associate with existing session
		if (sessionId) {
			try {
				const { sessionRegistry, terminalManager } = getServices();
				const session = sessionRegistry.getSession(sessionId);

				if (session && session.type === 'pty') {
					const terminalData = terminalManager?.getTerminal?.(session.typeSpecificId);
					if (terminalData) {
						logger.info(
							'SOCKET',
							`Associating socket ${socket.id} with existing terminal ${session.typeSpecificId}`
						);
						terminalData.socket = socket;
					}
				}
			} catch (e) {
				logger.warn('SOCKET', `Failed to associate socket with session ${sessionId}:`, e.message);
			}
		}

		const connectionMetadata = {
			ip: socket.handshake.address || socket.conn.remoteAddress,
			userAgent: socket.handshake.headers['user-agent']
		};

		await historyManager.initializeSocket(socket.id, connectionMetadata);
		logSocketEvent(socket.id, 'connection', connectionMetadata);

		// Authentication event - validates a key without starting a terminal
		socket.on('auth', (key, callback) => {
			try {
				requireValidKey(socket, key, callback);
			} catch (err) {
				if (callback) callback({ success: false, error: err?.message || 'Auth error' });
			}
		});

		// Terminal start event (creates new terminal session)
		socket.on('terminal.start', async (data, callback) => {
			if (!requireValidKey(socket, data.key, callback)) return;

			logger.info('SOCKET', `[terminal.start received]`, JSON.stringify(data));
			logger.info('SOCKET', `[DEBUG] Socket session from query:`, socket.data.sessionId);
			try {

				const { sessionRegistry } = getServices();

				if (!sessionRegistry) {
					throw new Error('Session registry not available');
				}

				const session = await sessionRegistry.createSession({
					type: 'pty',
					workspacePath: data.workspacePath,
					options: {
						shell: data.shell,
						env: data.env,
						socket
					}
				});
				logger.info('SOCKET', `Terminal session created: ${session.id}`);
				logger.info('SOCKET', `[DEBUG] Session created with socket:`, {
					hasSocket: !!socket,
					socketId: socket.id,
					sessionId: session.id
				});
				if (callback) callback({ success: true, id: session.id });
			} catch (err) {
				console.error(`[SOCKET] Terminal start error:`, err);
				if (callback) callback({ success: false, error: err.message });
			}
		});

		// Terminal write event
		socket.on('terminal.write', async (data) => {
			if (!requireValidKey(socket, data.key)) return;
			logger.debug('SOCKET', 'terminal.write received:', data);
			logger.debug('SOCKET', `[DEBUG] Writing to session ${data.id} from socket ${socket.id}`);
			try {

				const { sessionRegistry } = getServices();

				if (sessionRegistry) {
					await sessionRegistry.sendToSession(data.id, data.data);
					logger.debug('SOCKET', `Data written to session ${data.id}`);
				} else {
					logger.warn('SOCKET', 'No session manager available for terminal.write');
				}
			} catch (err) {
				logger.error('SOCKET', 'Terminal write error:', err);
			}
		});

		// Terminal resize event
		socket.on(SOCKET_EVENTS.TERMINAL_RESIZE, async (data) => {
			if (!requireValidKey(socket, data.key)) return;
			logger.debug('SOCKET', 'terminal.resize received:', data);
			try {

				const { sessionRegistry } = getServices();

				if (!sessionRegistry) {
					throw new Error('Session registry not available for terminal resize');
				}

				await sessionRegistry.performOperation(data.id, 'resize', {
					cols: data.cols,
					rows: data.rows
				});
				logger.debug('SOCKET', `Terminal ${data.id} resized`);
			} catch (err) {
				console.error(`[SOCKET] Terminal resize error:`, err);
			}
		});

		// Claude send event
		socket.on(SOCKET_EVENTS.CLAUDE_SEND, async (data) => {
			if (!requireValidKey(socket, data.key)) return;
			logger.debug('SOCKET', 'claude.send received:', data);
			try {

				const { sessionRegistry, claudeSessionManager } = getServices();

				if (!sessionRegistry || !claudeSessionManager) {
					throw new Error('Claude services not available');
				}

				try {
					let session = sessionRegistry.getSession(data.id);
					if (!session) {
						session = await sessionRegistry.createSession({
							type: 'claude',
							workspacePath: data.workspacePath || '',
							options: { ...data.options, socket }
						});
					} else {
						claudeSessionManager.attachSocket({
							appSessionId: session.id,
							typeSpecificId: session.typeSpecificId,
							socket
						});
					}

					await sessionRegistry.sendToSession(session.id, data.input);
					logger.info('SOCKET', `Claude message sent via session registry`);
				} catch (err) {
					console.error(`[SOCKET] Claude send error:`, err);
					const session = sessionRegistry.getSession(data.id);
					if (session) {
						sessionRegistry.setIdle(session.id);
					}
					throw err;
				}
			} catch (err) {
				console.error(`[SOCKET] Claude send error:`, err);
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

				const { sessionRegistry } = getServices();

				if (sessionRegistry && data.sessionId) {
					const session = sessionRegistry.getSession(data.sessionId);
					if (session) {
						const activityState = sessionRegistry.getActivityState(data.sessionId);
						const hasPendingMessages =
							activityState === 'processing' || activityState === 'streaming';

						// Get cached commands if available
						let availableCommands = null;
						if (sessionRegistry.getCachedCommands) {
							availableCommands = sessionRegistry.getCachedCommands(data.sessionId);
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
				logger.error('SOCKET', 'Session status error:', err);
				if (callback) callback({ success: false, error: err.message });
			}
		});

		// Session catchup event
		socket.on(SOCKET_EVENTS.SESSION_CATCHUP, (data) => {
			logger.debug('SOCKET', 'session.catchup received:', data);
			// Could be used to resend missed messages if needed
		});

		// Session history load event - loads buffered messages for a session
		socket.on(SOCKET_EVENTS.SESSION_HISTORY_LOAD, (data, callback) => {
			if (!requireValidKey(socket, data.key, callback)) return;
			logger.debug('SOCKET', 'session.history.load received:', data);
			try {

				const { sessionRegistry } = getServices();

				if (!sessionRegistry || !data.sessionId) {
					if (callback)
						callback({
							success: false,
							error: 'Session router not available or sessionId missing'
						});
					return;
				}

				// Get buffered messages for the session
				const sinceTimestamp = data.sinceTimestamp || 0;
				const messages = sessionRegistry.getBufferedMessages(data.sessionId, sinceTimestamp);

				logger.info(
					'SOCKET',
					`Loading ${messages.length} buffered messages for session ${data.sessionId}`
				);

				if (callback) {
					callback({
						success: true,
						sessionId: data.sessionId,
						messages: messages,
						count: messages.length
					});
				}

				// Optionally emit the messages directly to the socket
				if (data.replay) {
					sessionRegistry.replayBufferedMessages(socket, data.sessionId, sinceTimestamp);
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

				const { sessionRegistry } = getServices();

				if (sessionRegistry.refreshCommands && data.sessionId) {
					try {
						const commands = await sessionRegistry.refreshCommands(data.sessionId);
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

	// Set up periodic cleanup of expired message buffers
	setInterval(() => {
		try {
			const { sessionRegistry } = getServices();
			if (sessionRegistry && sessionRegistry.cleanupExpiredBuffers) {
				sessionRegistry.cleanupExpiredBuffers();
				logger.debug('SOCKET', 'Cleaned up expired message buffers');
			}
		} catch (err) {
			logger.error('SOCKET', 'Error cleaning up expired buffers:', err);
		}
	}, 60000); // Clean up every minute

	logger.info('SOCKET', 'Simplified Socket.IO server initialized');
	return io;
}
