import { logger } from '../shared/utils/logger.js';
import { SESSION_TYPE } from '../../shared/session-types.js';

/**
 * OpenCode TUI adapter
 * Wraps PTY adapter to automatically launch the `opencode` command
 */
export class OpenCodeTuiAdapter {
	/**
	 * @param {Object} params
	 * @param {string} params.cwd - Working directory
	 * @param {Object} [params.options={}] - Options
	 * @param {Function} params.onEvent - Event callback
	 */
	async create({ cwd, options = {}, onEvent }) {
		// Import PTY adapter dynamically
		const { PtyAdapter } = await import('../terminal/PtyAdapter.js');
		const ptyAdapter = new PtyAdapter();

		logger.info('OPENCODE_TUI', `Creating OpenCode TUI session in ${cwd}`);

		// Create PTY session with opencode command
		const ptyOptions = {
			...options,
			command: 'opencode', // Launch OpenCode TUI
			args: [], // No args needed - launches TUI by default
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
