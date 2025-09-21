import TerminalPane from '$lib/client/terminal/TerminalPane.svelte';
import { SESSION_TYPE } from '$lib/shared/session-types.js';

export const terminalSessionModule = {
	type: SESSION_TYPE.PTY,
	component: TerminalPane,
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
	}
};
