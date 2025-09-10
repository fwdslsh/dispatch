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
		
		this.sessions.set(id, {
			workspacePath,
			sessionId: realSessionId,
			options: {
				...this.defaultOptions,
				cwd: workspacePath,
				...options,
				env: { ...process.env, HOME: process.env.HOME }
			}
		});
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
		console.log(`ClaudeSessionManager: send to session ${id}:`, userInput, process.env.HOME);

		// Resolve or lazily hydrate a session mapping for this id
		const { key, session } = await this.#ensureSession(id);
		const s = session;

		try {
			const stream = query({
				prompt: userInput,
				options: {
					...s.options,
					continue: true,
					resume: s.sessionId,
					env: { ...process.env, HOME: process.env.HOME }
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
		} catch (error) {
			console.error(`Error in Claude session ${id}:`, error);
			if (this.io) {
				this.io.emit('error', {
					message: 'Failed to process message',
					error: error.message
				});
			}
		}
	}

	/**
	 * Ensure we have a session object for the provided id.
	 * Accepts either a manager key (e.g. "claude_<uuid>") or a raw sessionId ("<uuid>").
	 * If not present, attempts to locate the session on disk and hydrate it.
	 * @param {string} id
	 * @returns {Promise<{ key: string, session: { workspacePath: string, sessionId: string, options: any } }>} 
	 */
	async #ensureSession(id) {
		// Try exact key first
		let s = this.sessions.get(id);
		if (s) return { key: id, session: s };

		// Try prefixed form if raw uuid was provided
		const sessionId = id.startsWith('claude_') ? id.replace(/^claude_/, '') : id;
		const key = `claude_${sessionId}`;
		s = this.sessions.get(key);
		if (s) return { key, session: s };

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
		const hydrated = {
			workspacePath,
			sessionId,
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
