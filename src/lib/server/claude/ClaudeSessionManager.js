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
import { databaseManager } from '../db/DatabaseManager.js';
import { claudeAuthManager } from './ClaudeAuthManager.js';

export class ClaudeSessionManager {
	/**
	 * @param {{ io: any }} param0
	 */
	constructor({ io }) {
		this.io = io;
		this.sessions = new Map(); // id -> { workspacePath, options }
		this.nextId = 1;

		// Cache supported commands per workspace or CLI path
		this._toolsCache = new Map(); // key -> { commands, fetchedAt }

		// Get the absolute path to the CLI executable
		const cliPath = resolve(process.cwd(), './node_modules/.bin/claude');

		this.defaultOptions = {
			maxTurns: 50,
			outputStyle: 'semantic-html',
			customSystemPrompt:
				'You are a helpful coding assistant integrated into a web terminal interface.',
			allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebSearch', 'Task'],
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
			await databaseManager.init();
		} catch (error) {
			console.error('[CLAUDE] Failed to initialize database:', error);
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
			const cacheKey = `${s.options.cwd || ''}:${s.options.pathToClaudeCodeExecutable || ''}`;
			const cached = this._toolsCache.get(cacheKey);
			return cached ? cached.commands : null;
		} catch (e) {
			return null;
		}
	}

	setSocketIO(io) {
		// Store the Socket.IO instance
		// This could be either a global server instance (for broadcasting)
		// or a specific client socket (for client-specific events)
		this.io = io;

		// Debug what type of instance this is
		logger.info('Claude', '[ClaudeSessionManager] setSocketIO called with:', {
			hasSocketsProperty: !!(io && io.sockets),
			hasEmitMethod: !!(io && io.emit),
			constructorName: io?.constructor?.name,
			isSocketIO: !!(io && io.sockets && io.emit)
		});

		// If this is a server instance (has a 'sockets' property), store it as the global server
		// for broadcasting events to all clients
		if (io && io.sockets) {
			this.serverIO = io;
			logger.info('Claude', '[ClaudeSessionManager] Set serverIO for broadcasting');
		}
	}

	/**
	 * @param {{ workspacePath: string, options?: object, sessionId?: string, appSessionId?: string }} param0
	 */
	async create({ workspacePath, options = {}, sessionId = null, appSessionId = null }) {
		// Normalize provided Claude session ID if present, otherwise generate a real one now
		let claudeSessionId = null;
		if (sessionId) {
			claudeSessionId = sessionId.startsWith('claude_')
				? sessionId.replace(/^claude_/, '')
				: sessionId;
		} else {
			claudeSessionId = randomUUID();
		}

		logger.debug(
			'Claude',
			`Creating session with Claude ID: ${claudeSessionId}, appSessionId: ${appSessionId}`
		);

		// Determine if we can actually resume (only when an on-disk conversation exists)
		let resumeCapable = false;

		/** @type {{ workspacePath: string, sessionId: string|null, resumeCapable: boolean, options: object, appSessionId?: string }} */
		const sessionData = {
			workspacePath,
			sessionId: claudeSessionId,
			resumeCapable, // true only if resuming an existing on-disk session
			appSessionId, // Store application session ID for routing
			options: {
				...this.defaultOptions,
				cwd: workspacePath,
				...options,
				env: { ...process.env, HOME: process.env.HOME }
			}
		};

		logger.info('Claude', `Creating Claude session ${claudeSessionId} with:`, {
			workspacePath,
			sessionId: claudeSessionId,
			appSessionId,
			cwd: sessionData.options.cwd,
			resumeCapable
		});

		// Ensure a real on-disk session exists so the ID is valid immediately
		try {
			const base = projectsRoot();
			const projectDir = options?.projectName || this.#encodeProjectPath(workspacePath);
			const dirPath = join(base, projectDir);
			await mkdir(dirPath, { recursive: true });
			const filePath = join(dirPath, `${claudeSessionId}.jsonl`);
			try {
				// Only create if it doesn't already exist
				await stat(filePath);
				resumeCapable = true;
			} catch {
				// Create an empty JSONL to initialize the session
				await writeFile(filePath, '', 'utf-8');
				resumeCapable = true;
			}
			// Update flag in session data
			sessionData.resumeCapable = resumeCapable;
		} catch (e) {
			logger.warn('Claude', 'Failed to initialize on-disk session file:', e?.message || e);
		}

		// Store session data mappings
		if (appSessionId) this.sessions.set(appSessionId, sessionData);
		this.sessions.set(claudeSessionId, sessionData);

		// Save session metadata to database
		try {
			await databaseManager.addClaudeSession(
				claudeSessionId,
				workspacePath,
				claudeSessionId,
				appSessionId,
				resumeCapable
			);
		} catch (error) {
			logger.error('Claude', 'Failed to save session to database:', error);
		}

		// Fire-and-forget publish of supported commands for this session; emit to socket when ready
		this._fetchAndEmitSupportedCommands(claudeSessionId, sessionData).catch((err) => {
			logger.error(
				'Claude',
				'Failed to fetch supported commands for',
				claudeSessionId,
				err && err.message ? err.message : err
			);
		});

		return {
			typeSpecificId: claudeSessionId
		};
	}
	/**
	 * @param {any} workspacePath
	 */
	list(workspacePath) {
		return Array.from(this.sessions.entries())
			.filter(([, v]) => v.workspacePath === workspacePath)
			.map(([id, v]) => ({ id, ...v }));
	}
	/**
	 * @param {any} id
	 * @param {any} userInput
	 */
	async send(id, userInput) {
		logger.debug('Claude', `send to session ${id}:`, userInput);
		logger.debug('Claude', `HOME=${process.env.HOME}`);
		logger.debug('Claude', `Current sessions:`, Array.from(this.sessions.keys()));

		// Resolve or lazily hydrate a session mapping for this id
		const { key, session } = await this.#ensureSession(id);
		/** @type {{ workspacePath: string, sessionId: string, resumeCapable?: boolean, options: object, appSessionId?: string }} */
		const s = session;
		logger.debug('Claude', `Using session ${key} with sessionId ${s.sessionId}`);

		let sawNoConversation = false;
		try {
			const debugEnv = { ...process.env, HOME: process.env.HOME };
			// If you want SDK debug logs, uncomment next line
			// debugEnv.DEBUG = debugEnv.DEBUG || '1';

			logger.debug('Claude', `Session ${s.sessionId} options:`, {
				cwd: s.options.cwd,
				workspacePath: s.workspacePath,
				resumeCapable: s.resumeCapable
			});

			const stream = query({
				prompt: userInput,
				options: {
					...s.options,
					// When resuming, keep history bounded to avoid context overflows
					// Reduce maxTurns specifically for resumed sessions
					maxTurns: s.resumeCapable
						? Math.min(20, this.defaultOptions.maxTurns || 20)
						: this.defaultOptions.maxTurns || 20,
					continue: !!s.resumeCapable,
					...(s.resumeCapable ? { resume: s.sessionId } : {}),
					stderr: (data) => {
						try {
							const text = String(data || '');
							if (text.toLowerCase().includes('no conversation found')) {
								sawNoConversation = true;
							}
							logger.error('Claude', `stderr ${s.sessionId}`, data);
						} catch {}
					},
					env: debugEnv
				}
			});

			if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
				logger.error('Claude', 'Query did not return a valid async iterator');
				return;
			}

			let sawAnyEvent = false;
			for await (const event of stream) {
				sawAnyEvent = true;
				if (event && this.io) {
					try {
						this.io.emit(SOCKET_EVENTS.CLAUDE_MESSAGE_DELTA, [event]);
					} catch {}
					// Auto-start OAuth flow if Claude asks user to run /login
					try {
						if (
							event?.type === 'result' &&
							(event?.is_error || String(event?.subtype || '').toLowerCase() === 'error')
						) {
							const msg = String(event?.result || event?.message || '');
							if (/\bplease\s+run\s+\/login\b/i.test(msg) || msg.includes('/login')) {
								// this.io is a Socket when set by socket-setup; guard against Server
								if (this.io && typeof this.io.emit === 'function' && this.io.id) {
									claudeAuthManager.start(this.io);
								}
							}
						}
					} catch {}
				}
			}

			// After first response, if we didn't have a concrete Claude session ID, try to detect it now
			try {
				if (s && (!s.sessionId || /^\d+$/.test(String(s.sessionId))) && !s.resumeCapable) {
					const projectDir = s.options?.projectName || this.#encodeProjectPath(s.workspacePath);
					const files = await this.#listProjectSessionFiles(projectDir);
					if (files && files.length > 0) {
						const newId = files[0].id;
						if (newId && newId !== s.sessionId) {
							// Update in-memory mapping
							const oldId = s.sessionId;
							s.sessionId = newId;
							this.sessions.set(newId, s);

							// Persist to DB
							try {
								await databaseManager.addClaudeSession(
									newId,
									s.workspacePath,
									newId,
									s.appSessionId,
									true
								);
							} catch {}

							// Update router descriptor to route future messages by the real typeSpecificId
							try {
								const services = globalThis.__API_SERVICES || {};
								if (services.sessions) {
									services.sessions.updateTypeSpecificId(s.appSessionId, newId);
								}
								if (services.workspaces) {
									await services.workspaces.updateTypeSpecificId(
										s.workspacePath,
										s.appSessionId,
										newId
									);
								}

								// Optionally emit updated commands/status under the new session ID
								this._fetchAndEmitSupportedCommands(newId, s).catch(() => {});
							} catch {}
						}
					}
				}
			} catch {}
			// Emit a completion event so the session can be marked as idle
			// Use appSessionId if available, otherwise fall back to the key
			if (this.io) {
				const emitSessionId = s.appSessionId || key;
				try {
					this.io.emit(SOCKET_EVENTS.CLAUDE_MESSAGE_COMPLETE, { sessionId: emitSessionId });
				} catch {}
			}
		} catch (error) {
			logger.error('Claude', `Error in Claude session ${id}:`, error);
			// If the prompt/history is too long OR resume target missing, retry without resume
			const msg = String(error?.message || '');
			const lc = msg.toLowerCase();
			const isTooLong =
				lc.includes('prompt too long') ||
				(lc.includes('context') && lc.includes('too') && lc.includes('long'));
			const missingConversation = typeof sawNoConversation !== 'undefined' && sawNoConversation;
			if (isTooLong || missingConversation) {
				try {
					const debugEnv = { ...process.env, HOME: process.env.HOME };
					const fresh = query({
						prompt: userInput,
						options: {
							...s.options,
							// Start a fresh turn without resuming prior history
							continue: false,
							maxTurns: Math.min(20, this.defaultOptions.maxTurns || 20),
							stderr: (data) => {
								try {
									console.error(`[Claude stderr ${s.sessionId}]`, data);
								} catch {}
							},
							env: debugEnv
						}
					});

					for await (const event of fresh) {
						if (event && this.io) {
							try {
								this.io.emit(SOCKET_EVENTS.CLAUDE_MESSAGE_DELTA, [event]);
							} catch {}
						}
					}
					// Emit completion event for the fresh query
					if (this.io) {
						const emitSessionId = s.appSessionId || key;
						try {
							this.io.emit(SOCKET_EVENTS.CLAUDE_MESSAGE_COMPLETE, { sessionId: emitSessionId });
						} catch {}
					}
					return;
				} catch (retryErr) {
					console.error('Retry without resume failed:', retryErr);
					if (this.io) {
						this.io.emit('error', {
							message: 'Failed to process message',
							error: String(retryErr?.message || retryErr)
						});
					}
					return;
				}
			}

			if (this.io) {
				this.io.emit('error', {
					message: 'Failed to process message',
					error: error.message
				});
			}
		}
	}

	/**
	 * Check if a conversation exists on disk for a given sessionId
	 * @param {string} sessionId
	 */
	async #conversationExists(sessionId) {
		try {
			const baseProjectsRoot = projectsRoot();
			logger.debug(
				'Claude',
				`Checking for conversation ${sessionId} in projects root:`,
				baseProjectsRoot
			);

			const dirs = await readdir(baseProjectsRoot, { withFileTypes: true });
			for (const d of dirs) {
				if (!d.isDirectory()) continue;
				const filePath = join(baseProjectsRoot, d.name, `${sessionId}.jsonl`);
				try {
					const st = await stat(filePath);
					if (st && st.isFile()) {
						logger.debug('Claude', `Found conversation file:`, filePath);
						return true;
					}
				} catch {}
			}
		} catch (error) {
			logger.warn('Claude', 'Error checking for conversation existence:', error.message);
		}
		return false;
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

		let found = null;
		try {
			const baseProjectsRoot = projectsRoot();
			logger.debug('Claude', `Looking for session ${sessionId} in:`, baseProjectsRoot);

			const dirs = await readdir(baseProjectsRoot, { withFileTypes: true });
			for (const d of dirs) {
				if (!d.isDirectory()) continue;
				const filePath = join(baseProjectsRoot, d.name, `${sessionId}.jsonl`);
				try {
					const st = await stat(filePath);
					if (st && st.isFile()) {
						found = { projectDirName: d.name, filePath, projectsDir: baseProjectsRoot };
						logger.debug('Claude', `Found session file:`, filePath);
						break;
					}
				} catch {}
			}
		} catch (error) {
			logger.error('Claude', 'Error scanning projects directory:', error.message);
		}

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
				} catch {}
			}
		} catch {}

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
		} catch {
			return '';
		}
	}

	async #listProjectSessionFiles(projectDir) {
		const baseProjectsRoot = projectsRoot();
		const dirPath = join(baseProjectsRoot, projectDir);
		try {
			const files = await readdir(dirPath, { withFileTypes: true });
			const result = [];
			for (const f of files) {
				if (f.isFile() && f.name.endsWith('.jsonl')) {
					const filePath = join(dirPath, f.name);
					try {
						const st = await stat(filePath);
						result.push({ id: f.name.replace(/\.jsonl$/, ''), mtimeMs: st.mtimeMs || 0 });
					} catch {}
				}
			}
			return result.sort((a, b) => b.mtimeMs - a.mtimeMs);
		} catch {
			return [];
		}
	}

	/**
	 * Fetch supported commands from the Claude SDK for a given session and emit them to clients.
	 * Uses an internal cache to avoid repeated CLI calls.
	 * @param {string} claudeSessionId - the Claude session ID
	 * @param {{ workspacePath: string, sessionId: string, options: object, appSessionId?: string }} sessionData
	 */
	async _fetchAndEmitSupportedCommands(claudeSessionId, sessionData) {
		console.log('🔥 [DEBUG] _fetchAndEmitSupportedCommands called - NEW IMPLEMENTATION!');
		console.log('🔥 [DEBUG] sessionData:', sessionData);
		if (!sessionData || !sessionData.options) {
			console.log('🔥 [DEBUG] Early return - no sessionData or options');
			return;
		}
		const cacheKey = `${sessionData.options.cwd || ''}:${sessionData.options.pathToClaudeCodeExecutable || ''}`;
		console.log('🔥 [DEBUG] cacheKey:', cacheKey);
		// Simple cache TTL: 5 minutes
		const TTL = 5 * 60 * 1000;
		const cached = this._toolsCache.get(cacheKey);
		console.log(
			'🔥 [DEBUG] cached result:',
			!!cached,
			cached ? 'age:' + (Date.now() - cached.fetchedAt) : 'none'
		);
		if (cached && Date.now() - cached.fetchedAt < TTL) {
			// Emit cached directly - emit to both Claude session ID and app session ID if available
			// Use global server instance for broadcasting if available, otherwise use current io
			const emitIO = this.serverIO || this.io || globalThis.__DISPATCH_SOCKET_IO;
			console.log('🔍 [DEBUG] Socket.IO instance check for cached:', {
				hasServerIO: !!this.serverIO,
				hasLocalIO: !!this.io,
				hasGlobalIO: !!globalThis.__DISPATCH_SOCKET_IO,
				usingIO: !!emitIO
			});
			if (emitIO) {
				logger.info(
					'Claude',
					`Emitting tools for session ${claudeSessionId} (cached: ${cached.commands.length})`
				);
				try {
					emitIO.emit(SOCKET_EVENTS.CLAUDE_TOOLS_AVAILABLE, {
						sessionId: claudeSessionId,
						commands: cached.commands
					});
				} catch {}
				emitIO.emit('session.status', {
					sessionId: claudeSessionId,
					availableCommands: cached.commands
				});

				// Also emit for app session if available
				if (sessionData.appSessionId) {
					logger.info(
						'Claude',
						`Emitting tools for app session ${sessionData.appSessionId} (cached)`
					);
					try {
						emitIO.emit(SOCKET_EVENTS.CLAUDE_TOOLS_AVAILABLE, {
							sessionId: sessionData.appSessionId,
							commands: cached.commands
						});
					} catch {}
					emitIO.emit('session.status', {
						sessionId: sessionData.appSessionId,
						availableCommands: cached.commands
					});
				}
			} else {
				logger.info(
					'Claude',
					`No Socket.IO instance available to emit cached commands for ${claudeSessionId}`
				);
			}
			return cached.commands;
		}
		try {
			logger.info(
				'Claude',
				`_fetchAndEmitSupportedCommands for ${claudeSessionId} (cacheKey=${cacheKey}) - invoking SDK`
			);
			console.log('🔥 [DEBUG] About to call _fetchSupportedCommands...');
			const commands = await this._fetchSupportedCommands(sessionData.options);
			console.log('🔥 [DEBUG] _fetchSupportedCommands completed!');
			console.log(
				`[Claude] _fetchAndEmitSupportedCommands received commands:`,
				Array.isArray(commands) ? commands.length : typeof commands
			);
			if (Array.isArray(commands)) {
				this._toolsCache.set(cacheKey, { commands, fetchedAt: Date.now() });

				// Use global server instance for broadcasting if available, otherwise use current io
				const emitIO = this.serverIO || this.io || globalThis.__DISPATCH_SOCKET_IO;
				console.log('🔍 [DEBUG] Socket.IO instance check for fresh commands:', {
					hasServerIO: !!this.serverIO,
					hasLocalIO: !!this.io,
					hasGlobalIO: !!globalThis.__DISPATCH_SOCKET_IO,
					usingIO: !!emitIO
				});
				if (emitIO) {
					logger.info(
						'Claude',
						`Emitting tools for session ${claudeSessionId} (fresh: ${commands.length})`
					);
					try {
						emitIO.emit(SOCKET_EVENTS.CLAUDE_TOOLS_AVAILABLE, {
							sessionId: claudeSessionId,
							commands
						});
					} catch {}
					emitIO.emit('session.status', {
						sessionId: claudeSessionId,
						availableCommands: commands
					});

					// Also emit for app session if available
					if (sessionData.appSessionId) {
						logger.info(
							'Claude',
							`Emitting tools for app session ${sessionData.appSessionId} (fresh)`
						);
						try {
							emitIO.emit(SOCKET_EVENTS.CLAUDE_TOOLS_AVAILABLE, {
								sessionId: sessionData.appSessionId,
								commands
							});
						} catch {}
						emitIO.emit('session.status', {
							sessionId: sessionData.appSessionId,
							availableCommands: commands
						});
					}
				} else {
					logger.info(
						'Claude',
						`No Socket.IO instance available to emit fresh commands for ${claudeSessionId}`
					);
				}
			}
			return commands;
		} catch (err) {
			logger.error(
				'Claude',
				'Error fetching supported commands:',
				err && err.message ? err.message : err
			);
			throw err;
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
				console.log(
					'[Claude] supportedCommands() returned:',
					Array.isArray(commands) ? `${commands.length} commands` : typeof commands
				);
			} catch (e) {
				console.error('[Claude] supportedCommands() threw error:', e && e.message ? e.message : e);
				throw e;
			}
			return commands;
		} finally {
			// best-effort cleanup: try interrupting the query to stop the child process
			console.log('🔥 [DEBUG] In finally block, about to call interrupt...');
			try {
				const interruptFn = q['interrupt'];
				console.log('🔥 [DEBUG] interruptFn exists:', !!interruptFn);
				if (interruptFn) {
					console.log('🔥 [DEBUG] Calling interrupt function (no await)...');
					interruptFn.call(q).catch(() => {}); // Fire-and-forget cleanup
					console.log('🔥 [DEBUG] Interrupt function called (fire-and-forget)');
				}
			} catch (e) {
				console.log('🔥 [DEBUG] Interrupt function threw error:', e);
			}
			console.log('🔥 [DEBUG] Finally block completed');
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
}
