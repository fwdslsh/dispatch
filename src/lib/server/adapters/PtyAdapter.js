import { logger } from '../utils/logger.js';

/**
 * PTY adapter for terminal sessions using node-pty
 * Provides a simple adapter interface that wraps node-pty functionality
 */
export class PtyAdapter {
	/**
	 * @param {Object} params
	 * @param {string} params.cwd - Working directory
	 * @param {Object} [params.options={}] - PTY options
	 * @param {Object} [params.options.env] - Environment variables
	 * @param {number} [params.options.cols] - Terminal columns
	 * @param {number} [params.options.rows] - Terminal rows
	 * @param {string} [params.options.name] - Terminal name
	 * @param {string|null} [params.options.encoding] - String encoding
	 * @param {boolean} [params.options.handleFlowControl] - Flow control
	 * @param {string} [params.options.flowControlPause] - Flow control pause
	 * @param {string} [params.options.flowControlResume] - Flow control resume
	 * @param {number} [params.options.uid] - Unix user ID
	 * @param {number} [params.options.gid] - Unix group ID
	 * @param {boolean} [params.options.useConpty] - Windows ConPTY
	 * @param {boolean} [params.options.useConptyDll] - Windows ConPTY DLL
	 * @param {boolean} [params.options.conptyInheritCursor] - Windows ConPTY cursor
	 * @param {string} [params.options.shell] - Shell command
	 * @param {string[]} [params.options.args] - Shell arguments
	 * @param {Function} params.onEvent - Event callback
	 */
	async create({ cwd, options = {}, onEvent }) {
		// Lazy load node-pty to handle cases where it's not available
		let pty;
		try {
			pty = await import('node-pty');
		} catch (error) {
			logger.error('PTY_ADAPTER', 'Failed to load node-pty:', error);
			throw new Error(`Terminal functionality not available: ${error.message}`);
		}

		// Prepare node-pty options with defaults
		const ptyOptions = {
			// Working directory
			cwd: cwd || process.env.WORKSPACES_ROOT || process.env.HOME,

			// Environment variables
			env: options.env ? { ...process.env, ...options.env } : process.env,

			// Terminal dimensions
			cols: options.cols || 80,
			rows: options.rows || 24,

			// Terminal name/type
			name: options.name || 'xterm-256color',

			// String encoding (utf8, null for binary)
			encoding: options.encoding !== undefined ? options.encoding : 'utf8',

			// Flow control options (experimental)
			handleFlowControl: options.handleFlowControl || false,
			flowControlPause: options.flowControlPause || '\x13', // XOFF
			flowControlResume: options.flowControlResume || '\x11', // XON

			// Unix-specific options
			uid: options.uid,
			gid: options.gid,

			// Windows-specific options
			useConpty: options.useConpty,
			useConptyDll: options.useConptyDll,
			conptyInheritCursor: options.conptyInheritCursor,

			// Allow any other node-pty options
			...options
		};

		// Extract shell and args from options or use defaults
		const shell = options.shell || process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : 'bash');
		const args = options.args || [];

		logger.info('PTY_ADAPTER', `Spawning ${shell} with args:`, args, 'options:', {
			cwd: ptyOptions.cwd,
			cols: ptyOptions.cols,
			rows: ptyOptions.rows,
			name: ptyOptions.name,
			encoding: ptyOptions.encoding
		});

		const term = pty.spawn(shell, args, ptyOptions);

		// Set up event handlers
		term.onData(data => {
			onEvent({
				channel: 'pty:stdout',
				type: 'chunk',
				payload: ptyOptions.encoding === null ? data : new TextEncoder().encode(data)
			});
		});

		term.onExit((exitInfo) => {
			logger.info('PTY_ADAPTER', `Process exited with code ${exitInfo.exitCode}, signal ${exitInfo.signal}`);
			onEvent({
				channel: 'system:status',
				type: 'closed',
				payload: {
					exitCode: exitInfo.exitCode,
					signal: exitInfo.signal
				}
			});
		});

		// Return adapter interface
		return {
			kind: 'pty',
			input: {
				write(data) {
					const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
					term.write(text);
				}
			},
			resize(cols, rows) {
				term.resize(cols, rows);
				onEvent({
					channel: 'pty:resize',
					type: 'dimensions',
					payload: { cols, rows }
				});
			},
			clear() {
				if (term.clear) {
					term.clear();
				}
			},
			pause() {
				if (term.pause) {
					term.pause();
				}
			},
			resume() {
				if (term.resume) {
					term.resume();
				}
			},
			close() {
				term.kill();
			},
			// Expose pty properties
			get pid() { return term.pid; },
			get process() { return term.process; },
			get cols() { return term.cols; },
			get rows() { return term.rows; }
		};
	}
}