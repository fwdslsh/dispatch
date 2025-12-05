import { logger } from '../shared/utils/logger.js';
import { SESSION_TYPE } from '../../shared/session-types.js';

/**
 * OpenCode TUI adapter
 * Wraps PTY adapter to automatically launch the `opencode` command
 * Automatically starts the OpenCode server if not already running
 */
export class OpenCodeTuiAdapter {
	/**
	 * @param {Object} options
	 * @param {*} [options.serverManager] - OpenCode server manager instance
	 */
	constructor({ serverManager } = {}) {
		this.serverManager = serverManager;
	}

	/**
	 * @param {Object} params
	 * @param {string} params.cwd - Working directory
	 * @param {Object} [params.options={}] - Options
	 * @param {Function} params.onEvent - Event callback
	 */
	async create({ cwd, options = {}, onEvent }) {
		logger.info('OPENCODE_TUI', '=== OpenCodeTuiAdapter.create() called ===');
		logger.info('OPENCODE_TUI', `CWD: ${cwd}`);
		logger.info('OPENCODE_TUI', `Options:`, options);

		// Import PTY adapter dynamically
		const { PtyAdapter } = await import('../terminal/PtyAdapter.js');
		const ptyAdapter = new PtyAdapter();

		logger.info('OPENCODE_TUI', `Creating OpenCode TUI session in ${cwd}`);

		// Automatically start OpenCode server if not running
		if (this.serverManager) {
			const status = this.serverManager.getStatus();
			if (!status.running) {
				logger.info('OPENCODE_TUI', 'OpenCode server not running, starting automatically...');
				try {
					await this.serverManager.start();
					logger.info('OPENCODE_TUI', 'OpenCode server started successfully');
				} catch (error) {
					logger.warn('OPENCODE_TUI', `Failed to auto-start OpenCode server: ${error.message}`);
					logger.warn('OPENCODE_TUI', 'The TUI will launch but may not connect without the server');
				}
			} else {
				logger.info('OPENCODE_TUI', `OpenCode server already running at ${status.url}`);
			}
		} else {
			logger.warn('OPENCODE_TUI', 'No server manager available - cannot auto-start OpenCode server');
		}

		// Create PTY session with opencode command
		const ptyOptions = {
			...options,
			shell: 'opencode', // Launch OpenCode TUI
			args: null, // Explicitly pass null to avoid default shell args
			env: {
				...process.env,
				...(options.env || {}),
				// Add any OpenCode-specific env vars here
				TERM: 'xterm-256color'
			}
		};

		// Create the underlying PTY session
		const ptySession = await ptyAdapter.create({
			cwd,
			options: ptyOptions,
			onEvent
		});

		// Return adapter interface with OPENCODE_TUI kind
		return {
			...ptySession,
			kind: SESSION_TYPE.OPENCODE_TUI
		};
	}
}
