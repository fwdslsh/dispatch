import path, { resolve } from 'node:path';
import { existsSync, unlink, unlinkSync } from 'node:fs';
import { logger } from '../shared/utils/logger.js';
import { SOCKET_EVENTS } from '../../shared/socket-events.js';
import { homedir } from 'node:os';

let pty;
async function ensurePtyLoaded() {
	if (pty) return pty;
	try {
		pty = await import('node-pty');
		logger.info('CLAUDE', 'node-pty loaded successfully');
		return pty;
	} catch (err) {
		logger.error('Failed to load node-pty:', err);
		pty = null;
		return null;
	}
}

class ClaudeAuthManager {
	constructor() {
		/**
		 * @type {Map<string, {
		 *   p: any,
		 *   buffer: string,
		 *   startedAt: number,
		 *   awaitingCode: boolean,
		 *   codeSubmitted?: boolean,
		 *   finished?: boolean,
		 *   urlEmitted?: boolean
		 * }>}
		 */
		this.sessions = new Map(); // key by socket.id
	}

	/** Strip ANSI escape sequences and control characters */
	stripAnsi(input) {
		try {
			return String(input)
				.replace(
					/[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
					''
				)
				.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
		} catch {
			return String(input || '');
		}
	}

	/** Extract OAuth URL from raw output, handling newlines and injected prompts */
	extractAuthUrl(raw) {
		if (!raw) return null;
		let text = this.stripAnsi(raw).replace(/\r/g, '');
		text = text.replace(/Paste code here if prompted >\S*/g, '');
		text = text.replace(/\n+/g, ' ');
		const starts = [
			'https://console.anthropic.com/login?',
			'https://console.anthropic.com/oauth/authorize?',
			'https://claude.ai/oauth/authorize?'
		];
		let idx = -1;
		for (const s of starts) {
			const i = text.indexOf(s);
			if (i !== -1 && (idx === -1 || i < idx)) idx = i;
		}
		if (idx === -1) return null;
		const after = text.slice(idx);
		const tokens = after.split(/\s+/);
		let acc = '';
		for (let i = 0; i < tokens.length; i++) {
			const t = tokens[i];
			if (i === 0) {
				acc += t;
				continue;
			}
			if (/^[&?#]/.test(t) || /[=&%]/.test(t) || /^\w+=/.test(t) || t.includes('://')) {
				acc += t;
			} else {
				break;
			}
		}
		return acc || null;
	}

	/** Start an interactive PTY session to run `claude setup-token` */
	async start(socket) {
		try {
			const key = socket.id;
			// If already running, do nothing
			if (this.sessions.has(key)) {
				logger.info('CLAUDE', `Auth session already running for socket ${key}`);
				return true;
			}

			const env = {
				...process.env,
				CI: '1',
				FORCE_COLOR: '0',
				TERM: process.env.TERM || 'xterm-256color',
				// Prevent external browser from opening on hosts that respect BROWSER
				BROWSER: 'echo'
			};

			// Do not override HOME/CLAUDE_CONFIG_DIR/XDG_CONFIG_HOME.
			// The CLI should write to $HOME/.claude/.credentials.json so our GET endpoint can read it.

			const localCli = resolve(process.cwd(), 'node_modules', '.bin', 'claude');
			let exe = existsSync(localCli) ? localCli : 'claude';
			let args = ['setup-token'];

			logger.info('CLAUDE', `Starting OAuth flow with: ${[exe, ...args].join(' ')}`);

			// Delete any existing credentials file to ensure a fresh login
			const credentialsPath = path.join(homedir(), '.claude', '.credentials.json');
			try {
				if (existsSync(credentialsPath)) {
					unlinkSync(credentialsPath);
					logger.info('CLAUDE', 'Deleted existing credentials file for fresh login');
				}
			} catch (err) {
				logger.warn('CLAUDE', 'Failed to delete existing credentials file:', err);
			}

			const loadedPty = await ensurePtyLoaded();
			if (!loadedPty) {
				logger.error('CLAUDE', 'Cannot start auth PTY: node-pty is not available');
				try {
					socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, {
						success: false,
						error: 'Terminal functionality not available - node-pty failed to load'
					});
				} catch { }
				return false;
			}

			const p = loadedPty.spawn(exe, args, {
				name: 'xterm-color',
				cols: 100,
				rows: 30,
				cwd: process.cwd(),
				env
			});

			const state = { p, buffer: '', startedAt: Date.now(), awaitingCode: true, finished: false };
			this.sessions.set(key, state);

			p.onData((data) => {
				try {
					state.buffer += String(data || '');
					if (state.finished) return;

					// One-time debug snapshot after a short delay (only if DEBUG_CLAUDE_AUTH)
					if (!state.urlEmitted && !state.debugTimer && process.env.DEBUG_CLAUDE_AUTH) {
						state.debugTimer = setTimeout(() => {
							try {
								const tail = this.stripAnsi(state.buffer).slice(-800) || '[buffer empty]';
								logger.info('CLAUDE', 'Auth buffer snapshot (tail)', tail);
							} catch { }
						}, 3500);
					}

					// Fast-path: capture OSC 8 hyperlink URL if CLI emits it
					if (!state.urlEmitted) {
						const m =
							// eslint-disable-next-line no-control-regex
							state.buffer.match(/\u001B]8;;(https?:\/\/[^\u001B\u0007]+)(?:\u0007|\u001B\\)/);
						if (m && m[1]) {
							const url = m[1];
							const payload = {
								url,
								instructions:
									'Open the link to authenticate, then paste the authorization code here.'
							};
							try {
								socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_URL, payload);
								state.urlEmitted = true;
								logger.info('CLAUDE', 'Auth URL emitted (OSC hyperlink)');
							} catch { }
						}
					}
					const plain = this.stripAnsi(state.buffer);
					if (state.codeSubmitted) {
						const lower = plain.toLowerCase();
						if (
							lower.includes('success') ||
							lower.includes('authenticated') ||
							lower.includes('you are now logged in') ||
							lower.includes('token saved') ||
							lower.includes('credentials saved') ||
							lower.includes('authentication complete')
						) {
							state.finished = true;
							try {
								socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_COMPLETE, { success: true });
							} catch { }
							logger.info('CLAUDE', 'Auth flow reported success; terminating PTY');
							try {
								state.p.kill();
							} catch { }
							return;
						}
						if (lower.includes('invalid') || lower.includes('expired') || lower.includes('error')) {
							state.finished = true;
							try {
								socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, {
									success: false,
									error: 'Authorization code rejected'
								});
							} catch { }
							logger.warn('CLAUDE', 'Auth flow reported error; terminating PTY');
							try {
								state.p.kill();
							} catch { }
							return;
						}
					}
					const url = this.extractAuthUrl(state.buffer);
					if (url) {
						// Send URL once
						if (!state.urlEmitted) {
							state.urlEmitted = true;
							const payload = {
								url,
								instructions:
									'Open the link to authenticate, then paste the authorization code here.'
							};
							try {
								socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_URL, payload);
							} catch { }
							logger.info('CLAUDE', 'Auth URL emitted to client');
						}
					}
				} catch (e) {
					logger.warn('CLAUDE', 'Error processing PTY data:', e?.message || e);
				}
			});

			p.onExit(({ exitCode }) => {
				try {
					if (state.finished) return;
					// If exited while awaiting code, treat as failure; otherwise success-ish
					const ok = !!state.codeSubmitted && exitCode === 0;
					try {
						socket.emit(
							ok ? SOCKET_EVENTS.CLAUDE_AUTH_COMPLETE : SOCKET_EVENTS.CLAUDE_AUTH_ERROR,
							ok ? { success: true } : { success: false, error: 'Authentication did not complete' }
						);
					} catch {
						logger.warn('CLAUDE', 'Failed to emit auth completion event to client');
					}
					state.finished = true;
				} finally {
					this.cleanup(key);
				}
			});

			return true;
		} catch (error) {
			logger.error('CLAUDE', 'Failed to start auth PTY:', error);
			try {
				socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, {
					success: false,
					error: String(error?.message || error)
				});
			} catch { }
			return false;
		}
	}

	/** Submit authorization code back into the PTY */
	submitCode(socket, code) {
		const key = socket.id;
		const state = this.sessions.get(key);
		if (!state || !state.p) {
			try {
				socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, {
					success: false,
					error: 'No auth session active'
				});
			} catch { }
			return false;
		}
		// Ensure state has the properties used below
		if (typeof state.codeSubmitted === 'undefined') state.codeSubmitted = false;
		if (typeof state.finished === 'undefined') state.finished = false;
		try {
			state.codeSubmitted = true;
			const toSend = String(code || '').trim();
			// Send code followed by CRLF to satisfy different line modes
			state.p.write(toSend + '\r\n');
			// Some TTYs require an extra Enter; send a second CR shortly after
			setTimeout(() => {
				try {
					if (!state.finished) state.p.write('\r');
				} catch { }
			}, 250);
			// Watchdog: if nothing concludes within 25s after code submission, emit error
			setTimeout(() => {
				if (state.finished) return;
				try {
					socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, {
						success: false,
						error: 'Authentication timeout waiting for CLI'
					});
				} catch { }
				try {
					state.p.kill();
				} catch { }
				state.finished = true;
			}, 25000);
			logger.info('CLAUDE', 'Authorization code submitted to PTY');
			// We will rely on process exit to indicate completion
			return true;
		} catch (error) {
			logger.error('CLAUDE', 'Failed to write code to PTY:', error);
			try {
				socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, {
					success: false,
					error: String(error?.message || error)
				});
			} catch { }
			return false;
		}
	}

	cleanup(key) {
		try {
			const s = this.sessions.get(key);
			if (s && s.p) {
				try {
					s.p.kill();
				} catch { }
			}
		} finally {
			this.sessions.delete(key);
		}
	}
}

// Export both the class and singleton instance for compatibility
export { ClaudeAuthManager };
export const claudeAuthManager = new ClaudeAuthManager();
