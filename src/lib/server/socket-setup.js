import { Server } from 'socket.io';
import { validateKey } from './auth.js';
import { query } from '@anthropic-ai/claude-code';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readdir, stat, readFile } from 'node:fs/promises';
import { historyManager } from './history-manager.js';
import { readFileSync } from 'node:fs';
import { SOCKET_EVENTS, emitPublicUrlResponse } from './utils/events.js';
import { logger } from './utils/logger.js';

import { getTypeSpecificId, getSessionType } from './utils/session-ids.js';

/**
 * Route application session ID to appropriate session type manager
 * @param {string} appSessionId - Application-managed session ID
 * @param {object} managers - Available managers (sessions, claude, terminals)
 * @returns {object|null} Routing result with typeSpecificId and manager info
 */
function routeSessionId(appSessionId, managers) {
	if (!appSessionId || !managers?.sessions) {
		return null;
	}
	
	// Get session descriptor from sessions router
	const sessionDescriptor = managers.sessions.get(appSessionId);
	if (!sessionDescriptor) {
		logger.debug('SOCKET', `No session descriptor found for app session ID: ${appSessionId}`);
		return null;
	}
	
	const sessionType = getSessionType(sessionDescriptor);
	const typeSpecificId = getTypeSpecificId(sessionDescriptor);
	
	if (!sessionType || !typeSpecificId) {
		logger.warn('SOCKET', `Session ${appSessionId} missing type or type-specific ID:`, { sessionType, typeSpecificId });
		return null;
	}
	
	logger.debug('SOCKET', `Routing session ${appSessionId} -> ${sessionType}:${typeSpecificId}`);
	
	return {
		sessionType,
		typeSpecificId,
		sessionDescriptor,
		manager: sessionType === 'claude' ? managers.claude : 
		         sessionType === 'pty' ? managers.terminals : null
	};
}

// Admin event tracking
let socketEvents = [];

function logSocketEvent(socketId, eventType, data = null) {
	const event = {
		socketId,
		type: eventType,
		data: data ? JSON.parse(JSON.stringify(data)) : null, // Deep clone to avoid references
		timestamp: Date.now()
	};
	
	socketEvents.unshift(event);
	
	// Keep only the most recent 500 events to prevent memory issues
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

	// Add to persistent history
	try {
		// Determine direction based on event type
		let direction = 'system';
		if (eventType.includes('.write') || eventType.includes('.send')) {
			direction = 'in';
		} else if (eventType.includes('.data') || eventType.includes('.delta')) {
			direction = 'out';
		}
		
		historyManager.addEvent(socketId, eventType, direction, data);
	} catch (error) {
		console.error('[HISTORY] Failed to log event to history:', error);
	}
}

// Export function to get events for API
export function getSocketEvents(limit = 100) {
	return socketEvents.slice(0, Math.min(limit, socketEvents.length));
}

export function setupSocketIO(httpServer) {
	const io = new Server(httpServer, {
		cors: { origin: '*', methods: ['GET', 'POST'] }
	});

	// If API services were initialized earlier, give them the server-level io
	// so managers can emit broadcast events (e.g. tools.list) even when no
	// individual socket has called setSocketIO.
	try {
		// Access the already-initialized API services if present. Avoid calling
		// getManagers() here since it's declared later in the file.
		const managers = globalThis.__API_SERVICES || {};
		if (managers) {
			if (managers.terminals && typeof managers.terminals.setSocketIO === 'function') {
				managers.terminals.setSocketIO(io);
			}
			if (managers.claude && typeof managers.claude.setSocketIO === 'function') {
				managers.claude.setSocketIO(io);
			}
		}
	} catch (e) {
		console.error('[SOCKET] Failed to attach server io to managers:', e && e.message ? e.message : e);
	}

	// Get shared managers from hooks.server.js
	const getManagers = () => globalThis.__API_SERVICES || {};

	io.on('connection', (socket) => {
		console.log(`[SOCKET] Client connected: ${socket.id}`);
		
		// Track connection for admin console
		socket.data = socket.data || {};
		socket.data.connectedAt = Date.now();
		socket.data.authenticated = false;
		
		const connectionMetadata = { 
			ip: socket.handshake.address || socket.conn.remoteAddress,
			userAgent: socket.handshake.headers['user-agent']
		};
		
		// Initialize history tracking for this socket
		historyManager.initializeSocket(socket.id, connectionMetadata);
		
		logSocketEvent(socket.id, 'connection', connectionMetadata);

		// Authentication tracking middleware
		const originalOn = socket.on.bind(socket);
		socket.on = function(event, handler) {
			return originalOn(event, function(...args) {
				// Log the event for admin monitoring (exclude sensitive data)
				const logData = event.includes('key') || event.includes('auth') ? '[REDACTED]' : args[0];
				logSocketEvent(socket.id, event, logData);
				return handler.apply(this, args);
			});
		};

		// Terminal events
		socket.on('terminal.start', async (data, callback) => {
			console.log(`[SOCKET] terminal.start received:`, data);
			try {
				if (!validateKey(data.key)) {
					console.log(`[SOCKET] Invalid key for terminal.start`);
					if (callback) callback({ success: false, error: 'Invalid key' });
					return;
				}
				
				// Mark as authenticated for admin tracking
				socket.data.authenticated = true;

				const { terminals } = getManagers();
				if (!terminals) {
					throw new Error('Terminal manager not available');
				}

				// Set the Socket.IO instance for this terminal's output
				terminals.setSocketIO(socket);
				const result = terminals.start(data);
				console.log(`[SOCKET] Terminal ${result.id} created via shared manager`);

				if (callback) callback({ success: true, ...result });
			} catch (err) {
				console.error(`[SOCKET] Terminal start error:`, err);
				if (callback) callback({ success: false, error: err.message });
			}
		});

		socket.on('terminal.write', (data) => {
			logger.debug('SOCKET', 'terminal write received:', data);
			try {
				if (!validateKey(data.key)) return;

				const managers = getManagers();
				
				// Route application session ID to terminal session
				const routing = routeSessionId(data.id, managers);
				if (!routing || routing.sessionType !== 'pty') {
					// Fallback: treat provided id as a direct terminal ID (e.g. "pty_1")
					if (managers?.terminals && typeof managers.terminals.write === 'function') {
						managers.terminals.setSocketIO(socket);
						managers.terminals.write(data.id, data.data);
						logger.debug('SOCKET', `Data written to terminal ${data.id} via fallback direct routing`);
						return;
					}
					logger.warn('SOCKET', `Invalid or non-PTY session for terminal.write: ${data.id}`);
					return;
				}
				
				const { typeSpecificId, manager: terminals } = routing;
				
				if (terminals) {
					// Update the socket reference to ensure output goes to the current connection
					terminals.setSocketIO(socket);
					terminals.write(typeSpecificId, data.data);
					logger.debug('SOCKET', `Data written to terminal ${typeSpecificId} via shared manager (app session: ${data.id})`);
				}
			} catch (err) {
				logger.error('SOCKET', 'Terminal write error:', err);
			}
		});

			socket.on(SOCKET_EVENTS.TERMINAL_RESIZE, (data) => {
			logger.debug('SOCKET', 'terminal resize received:', data);
			try {
				if (!validateKey(data.key)) return;

				const managers = getManagers();
				
				// Route application session ID to terminal session
				const routing = routeSessionId(data.id, managers);
				if (!routing || routing.sessionType !== 'pty') {
					// Fallback: treat provided id as a direct terminal ID (e.g. "pty_1")
					if (managers?.terminals && typeof managers.terminals.resize === 'function') {
						managers.terminals.resize(data.id, data.cols, data.rows);
						logger.debug('SOCKET', `Terminal ${data.id} resized via fallback direct routing`);
						return;
					}
					logger.warn('SOCKET', `Invalid or non-PTY session for terminal.resize: ${data.id}`);
					return;
				}
				
				const { typeSpecificId, manager: terminals } = routing;
				
				if (terminals) {
					terminals.resize(typeSpecificId, data.cols, data.rows);
					logger.debug('SOCKET', `Terminal ${typeSpecificId} resized via shared manager (app session: ${data.id})`);
				}
			} catch (err) {
				console.error(`[SOCKET] Terminal resize error:`, err);
			}
		});

		// Claude events
		socket.on(SOCKET_EVENTS.CLAUDE_SEND, async (data) => {
			logger.debug('SOCKET', 'claude.send received:', data);
			try {
				if (!validateKey(data.key)) return;

				const managers = getManagers();
				const { sessions } = managers;
				
				// Route application session ID to Claude session
				const routing = routeSessionId(data.id, managers);
				if (!routing || routing.sessionType !== 'claude') {
					throw new Error(`Invalid or non-Claude session: ${data.id}`);
				}
				
				const { typeSpecificId, manager: claude } = routing;
				
				if (claude) {
					// Set session as processing before starting (use app session ID)
					if (sessions) {
						sessions.setProcessing(data.id);
					}
					
					claude.setSocketIO(socket);
					try {
						// Use Claude-specific ID for the Claude manager
						await claude.send(typeSpecificId, data.input);
						console.log(`[SOCKET] Claude message sent via shared manager (app session: ${data.id}, claude session: ${typeSpecificId})`);
					} catch (err) {
						// Fallback: try direct resume if session is unknown
						if (String(err?.message || '').includes('unknown session')) {
							console.warn('[SOCKET] Unknown Claude session in manager; attempting direct resume');
							await directResume(socket, typeSpecificId, data.input, sessions, data.id);
						} else {
							throw err;
						}
					} finally {
						// Don't reset here - let the message completion handle it
					}
				}
			} catch (err) {
				console.error(`[SOCKET] Claude send error:`, err);
				// Ensure we reset to idle on error (use app session ID)
				const { sessions } = getManagers();
				if (sessions) {
					sessions.setIdle(data.id);
				}
				// Proactively notify the client of the error so the UI can react
				try { socket.emit('error', { message: 'Claude send failed', error: String(err?.message || err) }); } catch {}
			}
		});

		// Session status check event
		socket.on(SOCKET_EVENTS.SESSION_STATUS, (data, callback) => {
			logger.debug('SOCKET', 'session.status received:', data);
			try {
				if (!validateKey(data.key)) {
					if (callback) callback({ success: false, error: 'Invalid key' });
					return;
				}

				const managers = getManagers();
				const { sessions } = managers;
				
				if (sessions && data.sessionId) {
					// Use application session ID for activity tracking
					const activityState = sessions.getActivityState(data.sessionId);
					const hasPendingMessages = activityState === 'processing' || activityState === 'streaming';
					logger.debug('SOCKET', `Session ${data.sessionId} activity state: ${activityState}, hasPending: ${hasPendingMessages}`);
					
					// Try to get available commands from the appropriate session type
					let availableCommands = null;
					try {
						const routing = routeSessionId(data.sessionId, managers);
						if (routing && routing.sessionType === 'claude' && routing.manager) {
							const claude = routing.manager;
							// Use the Claude-specific session ID for command lookup
							if (typeof claude.getCachedCommands === 'function') {
								availableCommands = claude.getCachedCommands(routing.typeSpecificId);
							}
						}
					} catch (e) {
						logger.debug('SOCKET', 'Error fetching cached commands:', e.message);
						availableCommands = null;
					}
					
					if (callback) callback({ 
						success: true, 
						activityState,
						hasPendingMessages,
						availableCommands: Array.isArray(availableCommands) ? availableCommands : undefined
					});
				} else {
					if (callback) callback({ 
						success: true, 
						activityState: 'idle',
						hasPendingMessages: false 
					});
				}
			} catch (err) {
				logger.error('SOCKET', 'Session status error:', err);
				if (callback) callback({ success: false, error: err.message });
			}
		});

		// Session catchup event - for when a session regains focus
		socket.on(SOCKET_EVENTS.SESSION_CATCHUP, (data) => {
			logger.debug('SOCKET', 'session.catchup received:', data);
			// This could be used to resend any missed messages if needed
			// For now, just log it
		});

		// Public URL retrieval handler
		socket.on(SOCKET_EVENTS.GET_PUBLIC_URL, (callback) => {
			logger.debug('SOCKET', 'get-public-url handler called');
			
			try {
				// Get config directory from environment or default
				const configDir = process.env.DISPATCH_CONFIG_DIR || 
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
						} else {
							emitPublicUrlResponse(socket, true, url);
						}
						return;
					}
				} catch (readError) {
					// File doesn't exist or can't be read
					logger.debug('SOCKET', 'Tunnel URL file not found or unreadable:', tunnelFile);
				}
				
				// No URL available
				if (callback) {
					callback({ ok: false });
				} else {
					emitPublicUrlResponse(socket, false);
				}
			} catch (error) {
				logger.error('SOCKET', 'Error handling get-public-url:', error);
				if (callback) {
					callback({ ok: false, error: error.message });
				} else {
					emitPublicUrlResponse(socket, false);
				}
			}
		});

		socket.on(SOCKET_EVENTS.DISCONNECT, () => {
			logger.debug('SOCKET', `Client disconnected: ${socket.id}`);
			// Track disconnection for admin console
			logSocketEvent(socket.id, 'disconnect');
			// Finalize history for this socket
			historyManager.finalizeSocket(socket.id);
		});
	});

	console.log('[SOCKET] Socket.IO server initialized with shared managers');
	return io;
}

async function directResume(socket, claudeSessionId, prompt, sessions, appSessionId = null) {
	// Extract session ID if it has claude_ prefix
	const sessionId = claudeSessionId.startsWith('claude_') ? 
		claudeSessionId.replace(/^claude_/, '') : claudeSessionId;
	
	// Track as processing if sessions manager available (use app session ID if provided)
	const trackingId = appSessionId || claudeSessionId;
	if (sessions) {
		sessions.setProcessing(trackingId);
	}
	const candidates = [
		process.env.CLAUDE_PROJECTS_DIR,
		join(process.env.HOME || homedir(), '.claude', 'projects'),
		join(process.cwd(), '.dispatch-home', '.claude', 'projects'),
		join(process.cwd(), '.claude', 'projects')
	].filter(Boolean);

	let filePath = null;
	for (const projectsDir of candidates) {
		try {
			const entries = await readdir(projectsDir, { withFileTypes: true });
			for (const e of entries) {
				const p = join(projectsDir, e.name, `${sessionId}.jsonl`);
				try {
					const st = await stat(p);
					if (st && st.isFile()) {
						filePath = p;
						break;
					}
				} catch {}
			}
			if (filePath) break;
		} catch {}
	}

	if (!filePath) throw new Error('unknown session');

	// Extract cwd from jsonl
	let cwd = process.cwd();
	try {
		const content = await readFile(filePath, 'utf-8');
		const line = (content.split('\n').find((l) => l.includes('"cwd"')) || '').trim();
		if (line) {
			const parsed = JSON.parse(line);
			if (parsed && typeof parsed.cwd === 'string' && parsed.cwd.length > 0) cwd = parsed.cwd;
		}
	} catch {}

	try {
		const stream = query({
			prompt,
			options: {
				continue: true,
				resume: sessionId,
				cwd,
				stderr: (data) => { try { console.error(`[Claude stderr ${sessionId}]`, data); } catch {} },
				env: { ...process.env, HOME: process.env.HOME }
			}
		});

		for await (const event of stream) {
			if (event) socket.emit('message.delta', [event]);
		}
		// Emit completion event (use the tracking ID which could be app session ID)
		socket.emit('message.complete', { sessionId: trackingId });
		// Reset to idle after completion
		if (sessions) {
			sessions.setIdle(trackingId);
		}
	} catch (err) {
		const msg = String(err?.message || '').toLowerCase();
		const tooLong = msg.includes('prompt too long') || (msg.includes('context') && msg.includes('too') && msg.includes('long'));
		if (!tooLong) {
			// Reset to idle on error (use tracking ID)
			if (sessions) {
				sessions.setIdle(trackingId);
			}
			throw err;
		}
		// Retry without resuming history
		const fresh = query({
			prompt,
			options: {
				continue: false,
				cwd,
				stderr: (data) => { try { console.error(`[Claude stderr ${sessionId}]`, data); } catch {} },
				env: { ...process.env, HOME: process.env.HOME }
			}
		});
		for await (const event of fresh) {
			if (event) socket.emit('message.delta', [event]);
		}
		// Emit completion event (use tracking ID)
		socket.emit('message.complete', { sessionId: trackingId });
		// Reset to idle after fresh query completes
		if (sessions) {
			sessions.setIdle(trackingId);
		}
	}
}
