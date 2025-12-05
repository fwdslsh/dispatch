import TerminalPane from '$lib/client/terminal/TerminalPane.svelte';
import TerminalHeader from '$lib/client/terminal/TerminalHeader.svelte';
import IconRobot from '$lib/client/shared/components/Icons/IconRobot.svelte';
import { SESSION_TYPE } from '$lib/shared/session-types.js';

/**
 * OpenCode TUI Session Module
 * Uses terminal components to render the OpenCode TUI interface
 *
 * @type {import('$lib/client/shared/types.js').ISessionModule} ISessionModule
 */
export const opencodeTuiSessionModule = {
	type: SESSION_TYPE.OPENCODE_TUI,
	component: TerminalPane, // Reuse terminal component
	header: TerminalHeader, // Reuse terminal header
	prepareProps(session = {}) {
		console.log('[opencode-tui-module] Preparing props for session:', session);
		// Use typeSpecificId as sessionId since that's the runId for PTY sessions
		const sessionId = session.typeSpecificId || session.id;
		const props = {
			sessionId: sessionId,
			shouldResume: Boolean(session.resumeSession),
			workspacePath: session.workspacePath,
			shell: 'opencode' // Display "opencode" instead of "bash"
		};
		console.log('[opencode-tui-module] Prepared props:', props);
		return props;
	},
	prepareHeaderProps(session = {}, options = {}) {
		const { onClose, index } = options;
		return {
			session,
			onClose,
			index,
			shell: 'OpenCode TUI' // Display "OpenCode TUI" in header
		};
	}
};
