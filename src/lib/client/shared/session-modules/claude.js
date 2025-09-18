import ClaudePane from '$lib/client/claude/ClaudePane.svelte';

export const claudeSessionModule = {
	type: 'claude',
	component: ClaudePane,
	prepareProps(session = {}) {
		return {
			sessionId: session.id,
			claudeSessionId: session.claudeSessionId || session.typeSpecificId || session.sessionId,
			shouldResume: Boolean(session.shouldResume || session.resumeSession),
			workspacePath: session.workspacePath
		};
	}
};
