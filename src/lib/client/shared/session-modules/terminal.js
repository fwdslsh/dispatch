import TerminalPane from '$lib/client/terminal/TerminalPane.svelte';

export const terminalSessionModule = {
	type: 'pty',
	aliases: ['terminal'],
	component: TerminalPane,
	prepareProps(session = {}) {
		return {
			sessionId: session.id,
			shouldResume: Boolean(session.resumeSession),
			workspacePath: session.workspacePath,
			shell: session.shell
		};
	}
};
