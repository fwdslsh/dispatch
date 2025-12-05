import { logger } from '../shared/utils/logger.js';
import { SESSION_TYPE } from '../../shared/session-types.js';
import { PtyConfig } from './PtyConfig.js';

/**
 * PTY adapter for terminal sessions using node-pty
 * Provides a simple adapter interface that wraps node-pty functionality
 */
export class PtyAdapter {
	/**
	 * @param {Object} params
	 * @param {string} params.cwd - Working directory
	 * @param {Object} [params.options={}] - PTY options (see PtyConfig for details)
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

		// Create configuration value object
		const config = new PtyConfig({ cwd, ...options });

		// Get node-pty options and shell config
		const ptyOptions = config.toNodePtyOptions();
		const { shell, args } = config.getShellConfig();

		logger.info('PTY_ADAPTER', `=== Spawning PTY ===`);
		logger.info('PTY_ADAPTER', `Shell: ${shell}`);
		logger.info('PTY_ADAPTER', `Args:`, args);
		logger.info('PTY_ADAPTER', `Options:`, config.getLoggingConfig());

		let term;
		try {
			term = pty.spawn(shell, args, ptyOptions);
		} catch (error) {
			logger.error('PTY_ADAPTER', 'Failed to spawn terminal:', error);
			throw new Error(`Failed to spawn terminal: ${error.message}`);
		}

		// Set up event handlers with error boundaries
		term.onData((data) => {
			try {
				onEvent({
					channel: 'pty:stdout',
					type: 'chunk',
					payload: config.encoding === null ? data : new TextEncoder().encode(data)
				});
			} catch (error) {
				logger.error('PTY_ADAPTER', 'Error in onData event handler:', error);
			}
		});

		term.onExit((exitInfo) => {
			logger.info(
				'PTY_ADAPTER',
				`Process exited with code ${exitInfo.exitCode}, signal ${exitInfo.signal}`
			);
			try {
				onEvent({
					channel: 'system:status',
					type: 'closed',
					payload: {
						exitCode: exitInfo.exitCode,
						signal: exitInfo.signal
					}
				});
			} catch (error) {
				logger.error('PTY_ADAPTER', 'Error in onExit event handler:', error);
			}
		});

		// Return adapter interface
		return {
			kind: SESSION_TYPE.PTY,
			input: {
				write(data) {
					const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
					term.write(text);
				}
			},
			resize(cols, rows) {
				term.resize(cols, rows);
				try {
					onEvent({
						channel: 'pty:resize',
						type: 'dimensions',
						payload: { cols, rows }
					});
				} catch (error) {
					logger.error('PTY_ADAPTER', 'Error in resize event handler:', error);
				}
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
			get pid() {
				return term.pid;
			},
			get process() {
				return term.process;
			},
			get cols() {
				return term.cols;
			},
			get rows() {
				return term.rows;
			}
		};
	}
}
