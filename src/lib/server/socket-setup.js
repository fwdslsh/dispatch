import { Server } from 'socket.io';
import { validateKey } from './auth.js';
import { query } from '@anthropic-ai/claude-code';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readdir, stat, readFile } from 'node:fs/promises';
import { historyManager } from './history-manager.js';

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
			console.log(`[SOCKET] terminal.write received:`, data);
			try {
				if (!validateKey(data.key)) return;

				const { terminals } = getManagers();
				if (terminals) {
					// Update the socket reference to ensure output goes to the current connection
					terminals.setSocketIO(socket);
					terminals.write(data.id, data.data);
					console.log(`[SOCKET] Data written to terminal ${data.id} via shared manager`);
				}
			} catch (err) {
				console.error(`[SOCKET] Terminal write error:`, err);
			}
		});

		socket.on('terminal.resize', (data) => {
			console.log(`[SOCKET] terminal.resize received:`, data);
			try {
				if (!validateKey(data.key)) return;

				const { terminals } = getManagers();
				if (terminals) {
					terminals.resize(data.id, data.cols, data.rows);
				}
			} catch (err) {
				console.error(`[SOCKET] Terminal resize error:`, err);
			}
		});

		// Claude events
		socket.on('claude.send', async (data) => {
			console.log(`[SOCKET] claude.send received:`, data);
			try {
				if (!validateKey(data.key)) return;

				const { claude, sessions } = getManagers();
				if (claude) {
					// Set session as processing before starting
					if (sessions) {
						sessions.setProcessing(data.id);
					}
					
					claude.setSocketIO(socket);
					try {
						await claude.send(data.id, data.input);
						console.log(`[SOCKET] Claude message sent via shared manager`);
					} catch (err) {
						// Fallback: try direct resume if session is unknown
						if (String(err?.message || '').includes('unknown session')) {
							console.warn('[SOCKET] Unknown session in manager; attempting direct resume');
							await directResume(socket, data.id, data.input, sessions);
						} else {
							throw err;
						}
					} finally {
						// Don't reset here - let the message completion handle it
					}
				}
			} catch (err) {
				console.error(`[SOCKET] Claude send error:`, err);
				// Ensure we reset to idle on error
				const { sessions } = getManagers();
				if (sessions) {
					sessions.setIdle(data.id);
				}
			}
		});

		// Session status check event
		socket.on('session.status', (data, callback) => {
			console.log(`[SOCKET] session.status received:`, data);
			try {
				if (!validateKey(data.key)) {
					if (callback) callback({ success: false, error: 'Invalid key' });
					return;
				}

				const { sessions, claude } = getManagers();
				if (sessions && data.sessionId) {
					const activityState = sessions.getActivityState(data.sessionId);
					const hasPendingMessages = activityState === 'processing' || activityState === 'streaming';
					console.log(`[SOCKET] Session ${data.sessionId} activity state: ${activityState}, hasPending: ${hasPendingMessages}`);
					// Try to include cached availableCommands from the Claude manager if available
					let availableCommands = null;
					try {
						if (claude && typeof claude.getCachedCommands === 'function') {
							availableCommands = claude.getCachedCommands(`claude_${data.sessionId}`) || claude.getCachedCommands(data.sessionId);
						} else if (claude && claude._toolsCache) {
							// Best-effort: derive cache key from known session mapping on the claude manager
							const s = claude.sessions && claude.sessions.get(`claude_${data.sessionId}`) || claude.sessions && claude.sessions.get(data.sessionId);
							if (s && s.options) {
								const cacheKey = `${s.options.cwd || ''}:${s.options.pathToClaudeCodeExecutable || ''}`;
								const cached = claude._toolsCache.get(cacheKey);
								availableCommands = cached ? cached.commands : null;
							}
						}
					} catch (e) {
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
				console.error(`[SOCKET] Session status error:`, err);
				if (callback) callback({ success: false, error: err.message });
			}
		});

		// Session catchup event - for when a session regains focus
		socket.on('session.catchup', (data) => {
			console.log(`[SOCKET] session.catchup received:`, data);
			// This could be used to resend any missed messages if needed
			// For now, just log it
		});

		socket.on('disconnect', () => {
			console.log(`[SOCKET] Client disconnected: ${socket.id}`);
			// Track disconnection for admin console
			logSocketEvent(socket.id, 'disconnect');
			// Finalize history for this socket
			historyManager.finalizeSocket(socket.id);
		});
	});

	console.log('[SOCKET] Socket.IO server initialized with shared managers');
	return io;
}

async function directResume(socket, id, prompt, sessions) {
	const sessionId = id.startsWith('claude_') ? id.replace(/^claude_/, '') : id;
	
	// Track as processing if sessions manager available
	if (sessions) {
		sessions.setProcessing(id);
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
		// Emit completion event
		socket.emit('message.complete', { sessionId: id });
		// Reset to idle after completion
		if (sessions) {
			sessions.setIdle(id);
		}
	} catch (err) {
		const msg = String(err?.message || '').toLowerCase();
		const tooLong = msg.includes('prompt too long') || (msg.includes('context') && msg.includes('too') && msg.includes('long'));
		if (!tooLong) {
			// Reset to idle on error
			if (sessions) {
				sessions.setIdle(id);
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
		// Emit completion event
		socket.emit('message.complete', { sessionId: id });
		// Reset to idle after fresh query completes
		if (sessions) {
			sessions.setIdle(id);
		}
	}
}
