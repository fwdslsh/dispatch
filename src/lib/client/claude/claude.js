import ClaudePane from '$lib/client/claude/ClaudePane.svelte';
import ClaudeSettings from '$lib/client/claude/ClaudeSettings.svelte';
import ClaudeHeader from '$lib/client/claude/ClaudeHeader.svelte';
import { SESSION_TYPE } from '$lib/shared/session-types.js';

export const claudeSessionModule = {
	type: SESSION_TYPE.CLAUDE,
	component: ClaudePane,
	header: ClaudeHeader,
	settingsComponent: ClaudeSettings,
	prepareProps(session = {}) {
		return {
			sessionId: session.id,
			claudeSessionId: session.claudeSessionId || session.typeSpecificId || session.sessionId,
			shouldResume: Boolean(session.shouldResume || session.resumeSession),
			workspacePath: session.workspacePath
		};
	},
	prepareHeaderProps(session = {}, options = {}) {
		const { onClose, index } = options;
		return {
			session,
			onClose,
			index,
			claudeSessionId: session.claudeSessionId || session.typeSpecificId || session.sessionId
		};
	}
};
