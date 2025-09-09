import { query } from '@anthropic-ai/claude-code';

import { dirname, resolve } from 'path';

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
	}

	setSocketIO(io) {
		this.io = io;
	}

	/**
	 * @param {{ workspacePath: string, options?: object, sessionId?: string }} param0
	 */
	async create({ workspacePath, options = {}, sessionId = null }) {
		const id = sessionId ? `claude_${sessionId}` : `claude_${this.nextId++}`;
		this.sessions.set(id, {
			workspacePath,
			sessionId: sessionId || id.replace('claude_', ''),
			options: {
				...this.defaultOptions,
				...options,
				cwd: workspacePath,
				env: {
					HOME: process.env.HOME
				}
			}
		});
		return { id, sessionId: sessionId || id.replace('claude_', '') };
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
		const s = this.sessions.get(id);
		if (!s) throw new Error('unknown session');

		try {
			const stream = query({
				prompt: userInput,
				options: {
					...s.options,
					continue: true,
					sessionId: s.sessionId, // Pass the session ID to continue existing session
					cwd: s.workspacePath,
					env: {
						HOME: process.env.HOME
					}
				}
			});

			if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
				console.error('Query did not return a valid async iterator');
				return;
			}

			let results = [];
			for await (const event of stream) {
				if (event) {
					results.push(event);
					//this.io.io.to(`claude:${id}`).emit('message.delta', event);
				}
			}

			// Emit the final results array
			if (this.io) {
				this.io.emit('message.delta', results);
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
}
