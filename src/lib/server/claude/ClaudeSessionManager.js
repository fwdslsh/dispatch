import { query } from '@anthropic-ai/claude-code';

import { resolve, join } from 'path';
import { homedir } from 'node:os';
import { readdir, stat, readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ClaudeProjectsReader } from './ClaudeProjectsReader.js';
import { projectsRoot } from './cc-root.js';
import { buildClaudeOptions } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import { SOCKET_EVENTS } from '../../shared/socket-events.js';
import { claudeAuthManager } from './ClaudeAuthManager.js';
import { ClaudeCommandCache } from './ClaudeCommandCache.js';
import { ClaudeStreamRunner } from './ClaudeStreamRunner.js';
import { findSessionFile, sessionFileExists, getFilesByExtension } from '../utils/file-scanning.js';
import { safeExecute } from '../utils/error-handling.js';
import { hasMethod } from '../utils/method-utils.js';

export class ClaudeSessionManager {
	constructor({ io, databaseManager }) {
		this.databaseManager = databaseManager;
		this.io = io;
		this.sessions = new Map(); // id -> { workspacePath, options }
		this.nextId = 1;

		this.commandCache = new ClaudeCommandCache({ log: logger });
		this.streamRunner = new ClaudeStreamRunner({ queryFn: query, log: logger });

		// Get the absolute path to the CLI executable
		const cliPath = resolve(process.cwd(), './node_modules/.bin/claude');

		this.defaultOptions = {
			maxTurns: 500,
			outputStyle: 'semantic-html',
			// customSystemPrompt:
			// 	'You are a helpful coding assistant integrated into a web terminal interface.',
			// allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebSearch', 'Task'],
			permissionMode: 'bypassPermissions',
			pathToClaudeCodeExecutable: cliPath
		};

		// Projects reader to help locate existing sessions on disk when resuming
		this.projectsReader = new ClaudeProjectsReader(
			join(process.env.HOME || homedir(), '.claude', 'projects')
		);

		// Initialize database
		this.initializeDatabase();
	}

	async initializeDatabase() {
		try {
			await this.databaseManager.init();
		} catch (error) {
			logger.error('Claude', 'Failed to initialize database', error);
		}
	}

	/**
	 * Return cached commands for a manager key if available
	 * @param {string} claudeSessionId
	 */
	getCachedCommands(claudeSessionId) {
		try {
			const s = this.sessions.get(claudeSessionId);
			if (!s || !s.options) return null;
			return this.commandCache.get(s.options) || null;
		} catch (e) {
			return null;
		}
	}

	setSocketIO(io) {
		this.io = io;
		if (io?.sockets) {
			this.serverIO = io;
		}
	}

	// Session registry removed - now using direct socket communication

	attachSocket({ appSessionId, typeSpecificId, socket }) {
		if (!socket) return;
		if (appSessionId) {
			const appSession = this.sessions.get(appSessionId);
			if (appSession) appSession.socket = socket;
		}
		if (typeSpecificId) {
			const claudeSession = this.sessions.get(typeSpecificId);
			if (claudeSession) claudeSession.socket = socket;
		}
	}

	/**
	 * @param {{ workspacePath: string, options?: object, sessionId?: string, appSessionId?: string }} param0
	 */
	/**
	 * @param {{ workspacePath: string, options?: object, sessionId?: string, appSessionId?: string, socket?: any }} param0
	 */
	async create({
		workspacePath,
		options = {},
		sessionId = null,
		appSessionId = null,
		socket = null
	}) {
		const claudeSessionId = this.#normalizeSessionId(sessionId);
		const sessionData = this.#buildSessionData({
			claudeSessionId,
			workspacePath,
			appSessionId,
			options,
			socket
		});

		logger.debug(
			'Claude',
			`Creating session with Claude ID: ${claudeSessionId}, appSessionId: ${appSessionId}`
		);

		await this.#ensureSessionFile(sessionData);
		this.#registerSession(sessionData);
		await this.#persistToDatabase(sessionData);
		this.#fetchCommandsAsync(claudeSessionId, sessionData);

		return { typeSpecificId: claudeSessionId };
	}

	/**
	 * Check if session needs ID update based on file discovery
	 * @param {object} session - Session object to check
	 * @returns {boolean} True if session needs ID update
	 */
	#needsIdUpdate(session) {
		return session &&
			   (!session.sessionId || /^\d+$/.test(String(session.sessionId))) &&
			   !session.resumeCapable;
	}

	/**
	 * Update session metadata after ID change
	 * @param {object} session - Session object
	 * @param {string} newId - New session ID
	 * @param {string} oldId - Old session ID
	 */
	async #updateSessionMetadata(session, newId, oldId) {
		// Update in-memory sessions
		this.sessions.set(newId, session);

		// Update database records
		await safeExecute(
			() => this.databaseManager.addClaudeSession(newId, session.workspacePath, newId, session.appSessionId, true),
			'Claude',
			'Failed to add session to database'
		);

		// Update workspace database
		await safeExecute(async () => {
			if (this.databaseManager) {
				await this.databaseManager.updateTypeSpecificId(session.workspacePath, session.appSessionId, newId);
			}
		}, 'Claude', 'Failed to update session metadata after ID change');

		// Refresh commands asynchronously
		this._fetchAndEmitSupportedCommands(newId, session).catch(() => {});
	}

	#normalizeSessionId(sessionId) {
		if (sessionId) {
			return sessionId.startsWith('claude_')
				? sessionId.replace(/^claude_/, '')
				: sessionId;
		}
		return randomUUID();
	}

	#buildSessionData({ claudeSessionId, workspacePath, appSessionId, options, socket }) {
		return {
			workspacePath,
			sessionId: claudeSessionId,
			resumeCapable: false, // Will be updated by #ensureSessionFile
			appSessionId,
			options: {
				...this.defaultOptions,
				cwd: workspacePath,
				...options,
				env: { ...process.env, HOME: process.env.HOME }
			},
			socket: socket || options?.socket
		};
	}

	async #ensureSessionFile(sessionData) {
		try {
			const base = projectsRoot();
			const projectDir = sessionData.options?.projectName || this.#encodeProjectPath(sessionData.workspacePath);
			const dirPath = join(base, projectDir);
			await mkdir(dirPath, { recursive: true });
			const filePath = join(dirPath, `${sessionData.sessionId}.jsonl`);

			try {
				await stat(filePath);
				sessionData.resumeCapable = true;
			} catch (error) {
				await writeFile(filePath, '', 'utf-8');
				sessionData.resumeCapable = true;
			}
		} catch (e) {
			logger.warn('Claude', 'Failed to initialize on-disk session file:', e?.message || e);
		}
	}

	#registerSession(sessionData) {
		if (sessionData.appSessionId) {
			this.sessions.set(sessionData.appSessionId, sessionData);
		}
		this.sessions.set(sessionData.sessionId, sessionData);
	}

	async #persistToDatabase(sessionData) {
		try {
			await this.databaseManager.addClaudeSession(
				sessionData.sessionId,
				sessionData.workspacePath,
				sessionData.sessionId,
				sessionData.appSessionId,
				sessionData.resumeCapable
			);
		} catch (error) {
			logger.error('Claude', 'Failed to save session to database:', error);
		}
	}

	#fetchCommandsAsync(claudeSessionId, sessionData) {
		this._fetchAndEmitSupportedCommands(claudeSessionId, sessionData).catch((err) => {
			logger.error(
				'Claude',
				'Failed to fetch supported commands for',
				claudeSessionId,
				err && err.message ? err.message : err
			);
		});
	}

	/**
	 * List all active Claude sessions
	 * @param {string} [workspacePath] - Optional filter by workspace path
	 */
	list(workspacePath) {
		const entries = Array.from(this.sessions.entries());
		const filtered = workspacePath
			? entries.filter(([, v]) => v.workspacePath === workspacePath)
			: entries;
		return filtered.map(([id, v]) => ({ id, ...v }));
	}

	/**
	 * Terminate a Claude session
	 * @param {string} id - Session ID to terminate
	 */
	async terminate(id) {
		logger.info('Claude', `Terminating session ${id}`);
		this.sessions.delete(id);
		// TODO: Cleanup any Claude Code processes if needed
	}

	/**
	 * @param {any} id
	 * @param {any} userInput
	 */
	async send(id, userInput) {
		logger.debug('Claude', `send to session ${id}:`, userInput);
		logger.debug('Claude', `HOME=${process.env.HOME}`);
		logger.debug('Claude', 'Current sessions:', Array.from(this.sessions.keys()));

		const { key, session } = await this.#ensureSession(id);
		/** @type {{ workspacePath: string, sessionId: string, resumeCapable?: boolean, options: object, appSessionId?: string, socket?: any }} */
		const s = session;
		logger.debug('Claude', `Using session ${key} with sessionId ${s.sessionId}`);

		// Activity state tracking is now handled by UI layer

		const debugEnv = { ...process.env, HOME: process.env.HOME };

		const onActivityChange = (state) => {
			// Activity state tracking is now handled by UI layer
		};

		const emitDelta = (event) => {
			const targetSessionId = s.appSessionId || id;
			const messageData = {
				sessionId: targetSessionId,
				events: [event],
				timestamp: Date.now()
			};
			// Emit directly to socket
			if (s.socket) {
				s.socket.emit(SOCKET_EVENTS.CLAUDE_MESSAGE_DELTA, messageData);
			} else if (this.io) {
				this.io.emit(SOCKET_EVENTS.CLAUDE_MESSAGE_DELTA, messageData);
			}

			try {
				if (
					event?.type === 'result' &&
					(event?.is_error || String(event?.subtype || '').toLowerCase() === 'error')
				) {
					const msg = String(event?.result || event?.message || '');
					if (/\bplease\s+run\s+\/login\b/i.test(msg) || msg.includes('/login')) {
						if (hasMethod(s.socket, 'emit')) {
							claudeAuthManager.start(s.socket);
						}
					}
				}
			} catch (error) {}
		};

		const emitCompletion = () => {
			const emitSessionId = s.appSessionId || key;
			const completeData = {
				sessionId: emitSessionId,
				timestamp: Date.now()
			};
			// Emit directly to socket
			if (s.socket) {
				s.socket.emit(SOCKET_EVENTS.CLAUDE_MESSAGE_COMPLETE, completeData);
			} else if (this.io) {
				this.io.emit(SOCKET_EVENTS.CLAUDE_MESSAGE_COMPLETE, completeData);
			}
		};

		const emitStreamError = (error) => {
			if (this.io) {
				this.io.emit('error', {
					message: 'Failed to process message',
					error: String(error?.message || error)
				});
			}
		};

		try {
			logger.debug('Claude', `Session ${s.sessionId} options:`, {
				cwd: s.options.cwd,
				workspacePath: s.workspacePath,
				resumeCapable: s.resumeCapable
			});

			await this.streamRunner.run({
				session: s,
				userInput,
				defaultOptions: this.defaultOptions,
				env: debugEnv,
				onDelta: emitDelta,
				onComplete: emitCompletion,
				onError: emitStreamError,
				onActivityChange
			});

			try {
				if (this.#needsIdUpdate(s)) {
					const projectDir = s.options?.projectName || this.#encodeProjectPath(s.workspacePath);
					const files = await this.#listProjectSessionFiles(projectDir);
					if (files && files.length > 0) {
						const newId = files[0].id;
						if (newId && newId !== s.sessionId) {
							const oldId = s.sessionId;
							s.sessionId = newId;
							await this.#updateSessionMetadata(s, newId, oldId);
						}
					}
				}
			} catch (error) {}
		} catch (error) {
			logger.error('Claude', `Error in Claude session ${id}:`, error);
		}
	}

	/**
	 * Check if a conversation exists on disk for a given sessionId
	 * @param {string} sessionId
	 */
	async #conversationExists(sessionId) {
		const baseProjectsRoot = projectsRoot();
		logger.debug('Claude', `Checking for conversation ${sessionId} in projects root:`, baseProjectsRoot);

		const exists = await sessionFileExists(baseProjectsRoot, sessionId, { component: 'Claude' });
		if (exists) {
			logger.debug('Claude', `Found conversation file for session ${sessionId}`);
		}
		return exists;
	}

	/**
	 * Ensure we have a session object for the provided id.
	 * Accepts a Claude session ID and handles hydration from disk if needed.
	 * @param {string} claudeSessionId - Claude session ID
	 * @returns {Promise<{ key: string, session: { workspacePath: string, sessionId: string, options: any, appSessionId?: string } }>}
	 */
	async #ensureSession(claudeSessionId) {
		logger.debug('Claude', `#ensureSession called with Claude ID: ${claudeSessionId}`);

		// Try exact Claude session ID first
		let s = this.sessions.get(claudeSessionId);
		if (s) {
			logger.debug('Claude', `Found session in memory with Claude ID: ${claudeSessionId}`);
			return { key: claudeSessionId, session: s };
		}

		// Extract session ID if it has claude_ prefix
		const sessionId = claudeSessionId.startsWith('claude_')
			? claudeSessionId.replace(/^claude_/, '')
			: claudeSessionId;

		// Try with extracted session ID
		s = this.sessions.get(sessionId);
		if (s) {
			logger.debug('Claude', `Found session in memory with extracted ID: ${sessionId}`);
			return { key: sessionId, session: s };
		}

		// Hydrate from disk by scanning projects directory for the session jsonl
		logger.debug('Claude', `Attempting to hydrate session ${sessionId} from disk`);

		const baseProjectsRoot = projectsRoot();
		logger.debug('Claude', `Looking for session ${sessionId} in:`, baseProjectsRoot);

		const found = await findSessionFile(baseProjectsRoot, sessionId, { component: 'Claude' });

		if (!found) {
			logger.warn('Claude', `Session ${sessionId} not found in projects directory`);
			throw new Error('unknown session');
		}

		// Try to read cwd directly from the session jsonl for accuracy
		let workspacePath = null;
		try {
			const content = await readFile(found.filePath, 'utf-8');
			const line = (content.split('\n').find((l) => l.includes('"cwd"')) || '').trim();
			if (line) {
				try {
					const parsed = JSON.parse(line);
					if (parsed && typeof parsed.cwd === 'string' && parsed.cwd.length > 0) {
						workspacePath = parsed.cwd;
					}
				} catch (error) {}
			}
		} catch (error) {}

		// Fallback to decoding project dir name if cwd not found in file
		if (!workspacePath) {
			workspacePath = this.projectsReader.decodeProjectPath(found.projectDirName);
			if (!workspacePath || !workspacePath.startsWith('/')) {
				workspacePath = resolve(process.cwd(), workspacePath || '.');
			}
		}

		// Register hydrated session with sane defaults
		/** @type {{ workspacePath: string, sessionId: string, resumeCapable: boolean, options: object, appSessionId?: string }} */
		const hydrated = {
			workspacePath,
			sessionId,
			resumeCapable: true,
			appSessionId: null, // No app session ID for hydrated sessions
			options: {
				...this.defaultOptions,
				cwd: workspacePath,
				env: { ...process.env, HOME: process.env.HOME }
			}
		};
		this.sessions.set(sessionId, hydrated);
		logger.info(
			'Claude',
			`Hydrated session ${sessionId} @ ${workspacePath} (from ${found.projectsDir})`
		);

		// After hydrating from disk, proactively fetch supported commands
		this._fetchAndEmitSupportedCommands(sessionId, hydrated).catch((err) => {
			logger.error(
				'Claude',
				'Failed to fetch supported commands for hydrated',
				sessionId,
				err && err.message ? err.message : err
			);
		});
		return { key: sessionId, session: hydrated };
	}

	#encodeProjectPath(workspacePath) {
		try {
			if (!workspacePath || typeof workspacePath !== 'string') return '';
			return workspacePath.replace(/^\//, '-').replace(/\//g, '-');
		} catch (error) {
			return '';
		}
	}

	async #listProjectSessionFiles(projectDir) {
		const baseProjectsRoot = projectsRoot();
		const dirPath = join(baseProjectsRoot, projectDir);

		const files = await getFilesByExtension(dirPath, '.jsonl', {
			sortBy: 'newest',
			component: 'Claude'
		});

		return files.map(file => ({
			id: file.name.replace(/\.jsonl$/, ''),
			mtimeMs: file.mtimeMs || 0
		}));
	}

	/**
	 * Fetch supported commands from the Claude SDK for a given session and emit them to clients.
	 * Uses an internal cache to avoid repeated CLI calls.
	 * @param {string} claudeSessionId - the Claude session ID
	 * @param {{ workspacePath: string, sessionId: string, options: object, appSessionId?: string }} sessionData
	 */
	async _fetchAndEmitSupportedCommands(claudeSessionId, sessionData) {
		logger.debug('Claude', '_fetchAndEmitSupportedCommands invoked', {
			claudeSessionId,
			sessionData
		});
		if (!sessionData || !sessionData.options) {
			logger.debug('Claude', 'No session data or options; skipping command fetch', {
				claudeSessionId
			});
			return;
		}

		try {
			const { commands, fromCache } = await this.commandCache.getOrFetch(sessionData.options, () =>
				this._fetchSupportedCommands(sessionData.options)
			);

			if (!Array.isArray(commands) || commands.length === 0) {
				logger.debug('Claude', 'No commands available to emit', {
					claudeSessionId,
					fromCache
				});
				return;
			}

			const emitIO = this.serverIO || this.io;
			logger.debug('Claude', 'Socket.IO instance availability for commands', {
				hasServerIO: !!this.serverIO,
				hasLocalIO: !!this.io,
				usingIO: !!emitIO,
				fromCache
			});

			if (!emitIO) {
				logger.info(
					'Claude',
					`No Socket.IO instance available to emit ${fromCache ? 'cached' : 'fresh'} commands for ${claudeSessionId}`
				);
				return commands;
			}

			const source = fromCache ? 'cached' : 'fresh';
			logger.info(
				'Claude',
				`Emitting ${source} tools for session ${claudeSessionId} (${commands.length})`
			);
			try {
				emitIO.emit(SOCKET_EVENTS.CLAUDE_TOOLS_AVAILABLE, {
					sessionId: claudeSessionId,
					commands
				});
			} catch (error) {}
			emitIO.emit('session.status', {
				sessionId: claudeSessionId,
				availableCommands: commands
			});

			if (sessionData.appSessionId) {
				logger.info(
					'Claude',
					`Emitting ${source} tools for app session ${sessionData.appSessionId}`
				);
				try {
					emitIO.emit(SOCKET_EVENTS.CLAUDE_TOOLS_AVAILABLE, {
						sessionId: sessionData.appSessionId,
						commands
					});
				} catch (error) {}
				emitIO.emit('session.status', {
					sessionId: sessionData.appSessionId,
					availableCommands: commands
				});
			}

			return commands;
		} catch (error) {
			logger.error('Claude', 'Failed to fetch supported commands', error);
			throw error;
		}
	}

	/**
	 * Low-level call into the SDK to obtain supported commands.
	 * Creates a streaming query (empty prompt) so `supportedCommands()` is available.
	 * @param {object} options - options to pass to the SDK (cwd, env, pathToClaudeCodeExecutable, etc.)
	 */
	async _fetchSupportedCommands(options) {
		// empty async iterable prompt to force streaming mode
		const emptyPrompt = (async function* () {})();
		logger.debug('Claude', '_fetchSupportedCommands called with options:', {
			cwd: options && options.cwd,
			path: options && options.pathToClaudeCodeExecutable
		});
		const q = query({ prompt: emptyPrompt, options: { ...options } });
		try {
			const supportedFn = q && q['supportedCommands'];
			if (!supportedFn) {
				logger.warn('Claude', 'Query instance has no supportedCommands() function');
				return null;
			}
			let commands = null;
			try {
				commands = await supportedFn.call(q);
				logger.debug('Claude', 'supportedCommands() returned', {
					type: Array.isArray(commands) ? 'array' : typeof commands,
					count: Array.isArray(commands) ? commands.length : undefined
				});
			} catch (e) {
				logger.error('Claude', 'supportedCommands() threw error', e);
				throw e;
			}
			return commands;
		} finally {
			try {
				const interruptFn = q['interrupt'];
				logger.debug('Claude', 'Interrupt function present', { hasInterrupt: !!interruptFn });
				if (interruptFn) {
					logger.debug('Claude', 'Calling interrupt function (fire-and-forget)');
					interruptFn.call(q).catch(() => {}); // Fire-and-forget cleanup
					logger.debug('Claude', 'Interrupt function invocation completed');
				}
			} catch (e) {
				logger.warn('Claude', 'Interrupt function threw error', e);
			}
			logger.debug('Claude', 'Interrupt cleanup finished');
		}
	}

	/**
	 * Refresh commands for an existing session by triggering command discovery
	 * This is useful when clients reconnect to existing sessions
	 * @param {string} sessionId - The Claude session ID
	 * @returns {Promise<Array|null>} Array of commands or null if session not found
	 */
	async refreshCommands(sessionId) {
		const session = this.sessions.get(sessionId);
		if (session) {
			return this._fetchAndEmitSupportedCommands(sessionId, session);
		}
	}

	/**
	 * Get session by ID for socket handlers
	 * @param {string} sessionId - The session ID to lookup
	 * @returns {object|null} Session object or null if not found
	 */
	getSession(sessionId) {
		return this.sessions.get(sessionId) || null;
	}
}
