import { query } from '@anthropic-ai/claude-code';

import { resolve, join } from 'path';
import { homedir } from 'node:os';
import { readdir, stat, readFile } from 'node:fs/promises';
import { ClaudeProjectsReader } from '../core/ClaudeProjectsReader.js';
import { projectsRoot } from './cc-root.js';
import { buildClaudeOptions } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import { databaseManager } from '../db/DatabaseManager.js';

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
		this.io = io;
	}

	/**
	 * @param {{ workspacePath: string, options?: object, sessionId?: string, appSessionId?: string }} param0
	 */
	async create({ workspacePath, options = {}, sessionId = null, appSessionId = null }) {
		// Generate or use provided Claude session ID
		let claudeSessionId;

		if (sessionId) {
			// Extract UUID from normalized ID if provided (claude_uuid -> uuid)
			claudeSessionId = sessionId.startsWith('claude_')
				? sessionId.replace(/^claude_/, '')
				: sessionId;
		} else {
			// Generate new Claude session ID
			claudeSessionId = `${this.nextId++}`;
		}

		logger.debug(
			'Claude',
			`Creating session with Claude ID: ${claudeSessionId}, appSessionId: ${appSessionId}`
		);

		// Determine if we can actually resume (only when an on-disk conversation exists)
		let resumeCapable = false;
		if (sessionId) {
			try {
				resumeCapable = await this.#conversationExists(claudeSessionId);
			} catch {
				resumeCapable = false;
			}
		}

		/** @type {{ workspacePath: string, sessionId: string, resumeCapable: boolean, options: object, appSessionId?: string }} */
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

		// Store session data - use Claude session ID as key for Claude manager operations
		this.sessions.set(claudeSessionId, sessionData);

		// If appSessionId provided, create mapping for routing from app session to Claude session
		if (appSessionId) {
			this.sessions.set(appSessionId, sessionData);
		}

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

		// Fire-and-forget fetch of supported commands for this session; emit to socket when ready
		this._fetchAndEmitSupportedCommands(claudeSessionId, sessionData).catch((err) => {
			logger.error(
				'Claude',
				'Failed to fetch supported commands for',
				claudeSessionId,
				err && err.message ? err.message : err
			);
		});

		return {
			claudeId: claudeSessionId
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

			for await (const event of stream) {
				if (event && this.io) {
					this.io.emit('message.delta', [event]);
				}
			}
			// Emit a completion event so the session can be marked as idle
			// Use appSessionId if available, otherwise fall back to the key
			if (this.io) {
				const emitSessionId = s.appSessionId || key;
				this.io.emit('message.complete', { sessionId: emitSessionId });
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
						if (event && this.io) this.io.emit('message.delta', [event]);
					}
					// Emit completion event for the fresh query
					if (this.io) {
						const emitSessionId = s.appSessionId || key;
						this.io.emit('message.complete', { sessionId: emitSessionId });
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

	/**
	 * Fetch supported commands from the Claude SDK for a given session and emit them to clients.
	 * Uses an internal cache to avoid repeated CLI calls.
	 * @param {string} claudeSessionId - the Claude session ID
	 * @param {{ workspacePath: string, sessionId: string, options: object, appSessionId?: string }} sessionData
	 */
	async _fetchAndEmitSupportedCommands(claudeSessionId, sessionData) {
		if (!sessionData || !sessionData.options) return;
		const cacheKey = `${sessionData.options.cwd || ''}:${sessionData.options.pathToClaudeCodeExecutable || ''}`;
		// Simple cache TTL: 5 minutes
		const TTL = 5 * 60 * 1000;
		const cached = this._toolsCache.get(cacheKey);
		if (cached && Date.now() - cached.fetchedAt < TTL) {
			// Emit cached directly - emit to both Claude session ID and app session ID if available
			if (this.io) {
				this.io.emit('tools.list', { sessionId: claudeSessionId, commands: cached.commands });
				this.io.emit('session.status', {
					sessionId: claudeSessionId,
					availableCommands: cached.commands
				});

				// Also emit for app session if available
				if (sessionData.appSessionId) {
					this.io.emit('tools.list', {
						sessionId: sessionData.appSessionId,
						commands: cached.commands
					});
					this.io.emit('session.status', {
						sessionId: sessionData.appSessionId,
						availableCommands: cached.commands
					});
				}
			}
			return cached.commands;
		}
		try {
			console.log(
				`[Claude] _fetchAndEmitSupportedCommands for ${claudeSessionId} (cacheKey=${cacheKey}) - invoking SDK`
			);
			const commands = await this._fetchSupportedCommands(sessionData.options);
			console.log(
				`[Claude] _fetchAndEmitSupportedCommands received commands:`,
				Array.isArray(commands) ? commands.length : typeof commands
			);
			if (Array.isArray(commands)) {
				this._toolsCache.set(cacheKey, { commands, fetchedAt: Date.now() });
				if (this.io) {
					this.io.emit('tools.list', { sessionId: claudeSessionId, commands });
					this.io.emit('session.status', {
						sessionId: claudeSessionId,
						availableCommands: commands
					});

					// Also emit for app session if available
					if (sessionData.appSessionId) {
						this.io.emit('tools.list', { sessionId: sessionData.appSessionId, commands });
						this.io.emit('session.status', {
							sessionId: sessionData.appSessionId,
							availableCommands: commands
						});
					}
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
			try {
				const interruptFn = q['interrupt'];
				if (interruptFn) await interruptFn.call(q);
			} catch (e) {}
		}
	}
}
