import { Server } from 'socket.io';
import { validateKey } from './auth.js';
import { SOCKET_EVENTS } from './utils/events.js';
import { logger } from './utils/logger.js';
import { historyManager } from './history-manager.js';
import { readFileSync } from 'node:fs';
import { claudeAuthManager } from './claude/ClaudeAuthManager.js';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Admin event tracking
let socketEvents = [];

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
		const io = globalThis.__DISPATCH_SOCKET_IO;
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

export function setupSocketIO(httpServer) {
	const io = new Server(httpServer, {
		cors: { origin: '*', methods: ['GET', 'POST'] }
	});

	// Get shared services
	const getServices = () => globalThis.__API_SERVICES || {};

	// Pass Socket.IO to session manager for real-time communication
	try {
		const { sessionManager } = getServices();
		if (sessionManager) {
			sessionManager.setSocketIO(io);
		}
	} catch (e) {
		console.error('[SOCKET] Failed to attach io to session manager:', e);
	}

	io.on('connection', async (socket) => {
		logger.info('SOCKET', `Client connected: ${socket.id}`);

		// Track connection
		socket.data = socket.data || {};
		socket.data.connectedAt = Date.now();
		socket.data.authenticated = false;

		const connectionMetadata = {
			ip: socket.handshake.address || socket.conn.remoteAddress,
			userAgent: socket.handshake.headers['user-agent']
		};

		await historyManager.initializeSocket(socket.id, connectionMetadata);
		logSocketEvent(socket.id, 'connection', connectionMetadata);

		// Authentication tracking middleware
		const originalOn = socket.on.bind(socket);
		socket.on = function (event, handler) {
			return originalOn(event, function (...args) {
				const logData = event.includes('key') || event.includes('auth') ? '[REDACTED]' : args[0];
				logSocketEvent(socket.id, event, logData);
				return handler.apply(this, args);
			});
		};

		// Authentication event - validates a key without starting a terminal
		socket.on('auth', (key, callback) => {
			try {
				if (validateKey(key)) {
					socket.data.authenticated = true;
					if (callback) callback({ success: true });
				} else {
					socket.data.authenticated = false;
					if (callback) callback({ success: false, error: 'Invalid key' });
				}
			} catch (err) {
				if (callback) callback({ success: false, error: err?.message || 'Auth error' });
			}
		});

		// Terminal start event (creates new terminal session)
		socket.on('terminal.start', async (data, callback) => {
			   logger.info('SOCKET', `[terminal.start received]`, JSON.stringify(data));
			try {
				if (!validateKey(data.key)) {
					   logger.info('SOCKET', `Invalid key for terminal.start`);
					if (callback) callback({ success: false, error: 'Invalid key' });
					return;
				}

				socket.data.authenticated = true;

				const { sessionManager, terminals } = getServices();

				// Use SessionManager if available, otherwise fallback
				if (sessionManager) {
					sessionManager.setSocketIO(socket);
					const session = await sessionManager.createSession({
						type: 'pty',
						workspacePath: data.workspacePath,
						options: {
							shell: data.shell,
							env: data.env
						}
					});
					   logger.info('SOCKET', `Terminal session created: ${session.id}`);
					if (callback) callback({ success: true, id: session.id });
				} else if (terminals) {
					// Fallback to direct terminal manager
					terminals.setSocketIO(socket);
					const result = terminals.start(data);
					   logger.info('SOCKET', `Terminal ${result.id} created directly`);
					if (callback) callback({ success: true, ...result });
				} else {
					throw new Error('No session management available');
				}
			} catch (err) {
				console.error(`[SOCKET] Terminal start error:`, err);
				if (callback) callback({ success: false, error: err.message });
			}
		});

		// Terminal write event
		socket.on('terminal.write', async (data) => {
			logger.debug('SOCKET', 'terminal.write received:', data);
			try {
				if (!validateKey(data.key)) return;

				const { sessionManager } = getServices();

				if (sessionManager) {
					sessionManager.setSocketIO(socket);
					await sessionManager.sendToSession(data.id, data.data);
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
			logger.debug('SOCKET', 'terminal.resize received:', data);
			try {
				if (!validateKey(data.key)) return;

				const { sessionManager } = getServices();

				if (sessionManager) {
					await sessionManager.sessionOperation(data.id, 'resize', {
						cols: data.cols,
						rows: data.rows
					});
					logger.debug('SOCKET', `Terminal ${data.id} resized`);
				} else {
					logger.warn('SOCKET', 'No session manager available for terminal.resize');
				}
			} catch (err) {
				console.error(`[SOCKET] Terminal resize error:`, err);
			}
		});

		// Claude send event
		socket.on(SOCKET_EVENTS.CLAUDE_SEND, async (data) => {
			logger.debug('SOCKET', 'claude.send received:', data);
			try {
				if (!validateKey(data.key)) return;

				const { sessionManager, sessions } = getServices();

				if (sessionManager && sessions) {
					// Set processing state
					sessions.setProcessing(data.id);

					try {
						sessionManager.setSocketIO(socket);
						await sessionManager.sendToSession(data.id, data.input);
						   logger.info('SOCKET', `Claude message sent via session manager`);
					} finally {
						// Will be reset to idle when message completes
					}
				} else {
					throw new Error('No session manager available for Claude');
				}
			} catch (err) {
				console.error(`[SOCKET] Claude send error:`, err);
				// Reset to idle on error
				const { sessions } = getServices();
				if (sessions) {
					sessions.setIdle(data.id);
				}
				// Notify client of error
				try {
					socket.emit('error', {
						message: 'Claude send failed',
						error: String(err?.message || err)
					});
				} catch {}
			}
		});

		// Claude OAuth: explicit start (optional; server may auto-start on detection)
		socket.on(SOCKET_EVENTS.CLAUDE_AUTH_START, (data = {}) => {
			try {
				logger.info('SOCKET', 'CLAUDE_AUTH_START received');
				if (!validateKey(data.key)) {
					logger.warn('SOCKET', 'CLAUDE_AUTH_START invalid key');
					return;
				}
				const ok = claudeAuthManager.start(socket);
				if (!ok) {
					logger.error('SOCKET', 'Failed to start Claude auth PTY');
				}
			} catch (e) {
				logger.error('SOCKET', 'CLAUDE_AUTH_START error:', e);
				try { socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, { success: false, error: String(e?.message || e) }); } catch {}
			}
		});

		// Claude OAuth: submit authorization code
		socket.on(SOCKET_EVENTS.CLAUDE_AUTH_CODE, (data = {}) => {
			try {
				logger.info('SOCKET', 'CLAUDE_AUTH_CODE received');
				if (!validateKey(data.key)) {
					logger.warn('SOCKET', 'CLAUDE_AUTH_CODE invalid key');
					return;
				}
				const code = String(data.code || '').trim();
				if (!code) {
					try { socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, { success: false, error: 'Missing authorization code' }); } catch {}
					return;
				}
				claudeAuthManager.submitCode(socket, code);
			} catch (e) {
				logger.error('SOCKET', 'CLAUDE_AUTH_CODE error:', e);
				try { socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, { success: false, error: String(e?.message || e) }); } catch {}
			}
		});

		// Session status check
		socket.on(SOCKET_EVENTS.SESSION_STATUS, (data, callback) => {
			logger.debug('SOCKET', 'session.status received:', data);
			try {
				if (!validateKey(data.key)) {
					if (callback) callback({ success: false, error: 'Invalid key' });
					return;
				}

				const { sessionManager, sessions } = getServices();

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
				logger.error('SOCKET', 'Session status error:', err);
				if (callback) callback({ success: false, error: err.message });
			}
		});

		// Session catchup event
		socket.on(SOCKET_EVENTS.SESSION_CATCHUP, (data) => {
			logger.debug('SOCKET', 'session.catchup received:', data);
			// Could be used to resend missed messages if needed
		});



		// Commands refresh event - canonical Claude name
		socket.on(SOCKET_EVENTS.CLAUDE_COMMANDS_REFRESH, async (data, callback) => {
			logger.debug('SOCKET', 'claude.commands.refresh received:', data);
			try {
				if (!validateKey(data.key)) {
					if (callback) callback({ success: false, error: 'Invalid key' });
					return;
				}

				const { sessionManager } = getServices();

				if (sessionManager && sessionManager.refreshCommands && data.sessionId) {
					try {
						const commands = await sessionManager.refreshCommands(data.sessionId);
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

		logger.info('SOCKET', 'Simplified Socket.IO server initialized');
	return io;
}
