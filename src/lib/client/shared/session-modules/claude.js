import ClaudePane from '$lib/client/claude/ClaudePane.svelte';
import ClaudeSettings from '$lib/client/shared/components/session-settings/ClaudeSettings.svelte';

export const claudeSessionModule = {
	type: 'claude',
	component: ClaudePane,
	settingsComponent: ClaudeSettings,
	prepareProps(session = {}) {
		return {
			sessionId: session.id,
			claudeSessionId: session.claudeSessionId || session.typeSpecificId || session.sessionId,
			shouldResume: Boolean(session.shouldResume || session.resumeSession),
			workspacePath: session.workspacePath
		};
	}
};
