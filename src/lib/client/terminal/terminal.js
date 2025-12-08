/**
 * Terminal Session Module
 *
 * v2.0 Hard Fork: Uses canonical TERMINAL type
 * @file src/lib/client/terminal/terminal.js
 */

import TerminalPane from '$lib/client/terminal/TerminalPane.svelte';
import TerminalHeader from '$lib/client/terminal/TerminalHeader.svelte';
import { SESSION_TYPE } from '$lib/shared/session-types.js';

/**
 * @type {import('$lib/client/shared/types.js').ISessionModule} ISessionModule
 */
export const terminalSessionModule = {
	type: SESSION_TYPE.TERMINAL,
	component: TerminalPane,
	header: TerminalHeader,
	prepareProps(session = {}) {
		console.log('[terminal-module] Preparing props for session:', session);
		// Use typeSpecificId as sessionId since that's the runId for PTY sessions
		const sessionId = session.typeSpecificId || session.id;
		const props = {
			sessionId: sessionId,
			shouldResume: Boolean(session.resumeSession),
			workspacePath: session.workspacePath,
			shell: session.shell
		};
		console.log('[terminal-module] Prepared props:', props);
		return props;
	},
	prepareHeaderProps(session = {}, options = {}) {
		const { onClose, index } = options;
		return {
			session,
			onClose,
			index,
			shell: session.shell || 'bash'
		};
	}
};
