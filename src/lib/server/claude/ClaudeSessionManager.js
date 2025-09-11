import { query } from '@anthropic-ai/claude-code';

import { resolve, join } from 'path';
import { homedir } from 'node:os';
import { readdir, stat, readFile } from 'node:fs/promises';
import { ClaudeProjectsReader } from '../core/ClaudeProjectsReader.js';

export class ClaudeSessionManager {
	/**
	 * @param {{ io: any }} param0
	 */
	constructor({ io }) {
		this.io = io;
		this.sessions = new Map(); // id -> { workspacePath, options }
		this.nextId = 1;

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
		this.projectsReader = new ClaudeProjectsReader(join(process.env.HOME || homedir(), '.claude', 'projects'));
	}

	setSocketIO(io) {
		this.io = io;
	}

	/**
	 * @param {{ workspacePath: string, options?: object, sessionId?: string }} param0
	 */
	async create({ workspacePath, options = {}, sessionId = null }) {
		const realSessionId = sessionId || `${this.nextId++}`;
		const id = `claude_${realSessionId}`;
		
		// Determine if we can actually resume (only when an on-disk conversation exists)
		let resumeCapable = false;
		if (sessionId) {
			try {
				resumeCapable = await this.#conversationExists(sessionId);
			} catch {
				resumeCapable = false;
			}
		}

		/** @type {{ workspacePath: string, sessionId: string, resumeCapable: boolean, options: object }} */
		const sessionData = {
			workspacePath,
			sessionId: realSessionId,
			resumeCapable, // true only if resuming an existing on-disk session
			options: {
				...this.defaultOptions,
				cwd: workspacePath,
				...options,
				env: { ...process.env, HOME: process.env.HOME }
			}
		};
		
		console.log(`[Claude] Creating session ${id} with:`, {
			workspacePath,
			sessionId: realSessionId,
			cwd: sessionData.options.cwd,
			resumeCapable
		});
		
		this.sessions.set(id, sessionData);
		// Also map raw session id for clients that pass it directly
		this.sessions.set(realSessionId, this.sessions.get(id));
		return { id, sessionId: realSessionId };
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
		console.log(`ClaudeSessionManager: send to session ${id}:`, userInput);
		console.log(`ClaudeSessionManager: HOME=${process.env.HOME}`);
		console.log(`ClaudeSessionManager: Current sessions:`, Array.from(this.sessions.keys()));

		// Resolve or lazily hydrate a session mapping for this id
		const { key, session } = await this.#ensureSession(id);
		/** @type {{ workspacePath: string, sessionId: string, resumeCapable?: boolean, options: object }} */
		const s = session;
		console.log(`ClaudeSessionManager: Using session ${key} with sessionId ${s.sessionId}`);

		let sawNoConversation = false;
		try {
			const debugEnv = { ...process.env, HOME: process.env.HOME };
			// If you want SDK debug logs, uncomment next line
			// debugEnv.DEBUG = debugEnv.DEBUG || '1';
			
			console.log(`[Claude] Session ${s.sessionId} options:`, {
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
					maxTurns: s.resumeCapable ? Math.min(20, this.defaultOptions.maxTurns || 20) : (this.defaultOptions.maxTurns || 20),
					continue: !!s.resumeCapable,
					...(s.resumeCapable ? { resume: s.sessionId } : {}),
					stderr: (data) => {
						try {
							const text = String(data || '');
							if (text.toLowerCase().includes('no conversation found')) {
								sawNoConversation = true;
							}
							console.error(`[Claude stderr ${s.sessionId}]`, data);
						} catch {}
					},
					env: debugEnv
				}
			});

			if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
				console.error('Query did not return a valid async iterator');
				return;
			}

			for await (const event of stream) {
				if (event && this.io) {
					this.io.emit('message.delta', [event]);
				}
			}
			// Emit a completion event so the session can be marked as idle
			if (this.io) {
				this.io.emit('message.complete', { sessionId: key });
			}
		} catch (error) {
			console.error(`Error in Claude session ${id}:`, error);
			// If the prompt/history is too long OR resume target missing, retry without resume
			const msg = String(error?.message || '');
			const lc = msg.toLowerCase();
			const isTooLong = lc.includes('prompt too long') || (lc.includes('context') && lc.includes('too') && lc.includes('long'));
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
							stderr: (data) => { try { console.error(`[Claude stderr ${s.sessionId}]`, data); } catch {} },
							env: debugEnv
						}
					});

					for await (const event of fresh) {
						if (event && this.io) this.io.emit('message.delta', [event]);
					}
					// Emit completion event for the fresh query
					if (this.io) {
						this.io.emit('message.complete', { sessionId: key });
					}
					return;
				} catch (retryErr) {
					console.error('Retry without resume failed:', retryErr);
					if (this.io) {
						this.io.emit('error', { message: 'Failed to process message', error: String(retryErr?.message || retryErr) });
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
		const candidates = [
			process.env.CLAUDE_PROJECTS_DIR,
			join(process.env.HOME || homedir(), '.claude', 'projects'),
			join(process.cwd(), '.dispatch-home', '.claude', 'projects'),
			join(process.cwd(), '.claude', 'projects')
		].filter(Boolean);
		for (const projectsDir of candidates) {
			try {
				const dirs = await readdir(projectsDir, { withFileTypes: true });
				for (const d of dirs) {
					if (!d.isDirectory()) continue;
					const filePath = join(projectsDir, d.name, `${sessionId}.jsonl`);
					try {
						const st = await stat(filePath);
						if (st && st.isFile()) return true;
					} catch {}
				}
			} catch {}
		}
		return false;
	}

	/**
	 * Ensure we have a session object for the provided id.
	 * Accepts either a manager key (e.g. "claude_<uuid>"), a raw sessionId ("<uuid>"), 
	 * or a simple numeric key (e.g. "claude_1").
	 * If not present, attempts to locate the session on disk and hydrate it.
	 * @param {string} id
	 * @returns {Promise<{ key: string, session: { workspacePath: string, sessionId: string, options: any } }>} 
	 */
	async #ensureSession(id) {
		console.log(`[Claude] #ensureSession called with id: ${id}`);
		
		// Try exact key first
		let s = this.sessions.get(id);
		if (s) {
			console.log(`[Claude] Found session in memory with exact key: ${id}`);
			return { key: id, session: s };
		}

		// Check if this looks like a UUID (with or without claude_ prefix)
		const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
		               /^claude_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
		
		// Extract sessionId (UUID) from the input
		let sessionId;
		if (isUuid) {
			sessionId = id.startsWith('claude_') ? id.replace(/^claude_/, '') : id;
		} else if (id.startsWith('claude_')) {
			// This might be a simple manager ID like "claude_1", we can't hydrate without UUID
			console.log(`[Claude] Cannot hydrate session with manager ID ${id} - UUID required`);
			throw new Error('unknown session - UUID required for hydration');
		} else {
			// Assume it's a raw UUID
			sessionId = id;
		}
		
		const key = `claude_${sessionId}`;
		s = this.sessions.get(key);
		if (s) {
			console.log(`[Claude] Found session in memory with constructed key: ${key}`);
			return { key, session: s };
		}
		
		// Also try with just the sessionId as key
		s = this.sessions.get(sessionId);
		if (s) {
			console.log(`[Claude] Found session in memory with sessionId: ${sessionId}`);
			return { key: sessionId, session: s };
		}

		// Hydrate from disk by scanning candidate projects directories for the session jsonl
		const candidates = [
			// Explicit env var if provided
			process.env.CLAUDE_PROJECTS_DIR,
			// HOME-based default (dev sets HOME to .dispatch-home)
			join(process.env.HOME || homedir(), '.claude', 'projects'),
			// Fallback to repo-local .dispatch-home
			join(process.cwd(), '.dispatch-home', '.claude', 'projects'),
			// Fallback to repo-local .claude (some setups)
			join(process.cwd(), '.claude', 'projects')
		].filter(Boolean);
		let found = null;
		for (const projectsDir of candidates) {
			try { console.log(`[Claude] Looking for session ${sessionId} in ${projectsDir}`); } catch {}
			try {
				const dirs = await readdir(projectsDir, { withFileTypes: true });
				for (const d of dirs) {
					if (!d.isDirectory()) continue;
					const filePath = join(projectsDir, d.name, `${sessionId}.jsonl`);
					try {
						const st = await stat(filePath);
						if (st && st.isFile()) {
							found = { projectDirName: d.name, filePath, projectsDir };
							break;
						}
					} catch {}
				}
				if (found) break;
			} catch (e) {
				// ignore scan errors for this candidate
			}
		}

		if (!found) {
			console.warn(`[Claude] Session ${sessionId} not found in any projects dir`);
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
		/** @type {{ workspacePath: string, sessionId: string, resumeCapable: boolean, options: object }} */
		const hydrated = {
			workspacePath,
			sessionId,
			resumeCapable: true,
			options: {
				...this.defaultOptions,
				cwd: workspacePath,
				env: { ...process.env, HOME: process.env.HOME }
			}
		};
		this.sessions.set(key, hydrated);
		this.sessions.set(sessionId, hydrated);
		console.log(`[Claude] Hydrated session ${sessionId} @ ${workspacePath} (from ${found.projectsDir})`);
		return { key, session: hydrated };
	}
}
