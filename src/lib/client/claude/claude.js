import ClaudePane from '$lib/client/claude/ClaudePane.svelte';
import ClaudeSettings from '$lib/client/claude/ClaudeSettings.svelte';
import ClaudeHeader from '$lib/client/claude/ClaudeHeader.svelte';
import ClaudeSettingsSection from '$lib/client/settings/sections/sessions/Claude.svelte';
import ClaudeIcon from '$lib/client/shared/components/Icons/ClaudeIcon.svelte';
import { SESSION_TYPE } from '$lib/shared/session-types.js';

/**
 * @type {import('$lib/client/shared/types.js').ISessionModule} ISessionModule
 */
export const claudeSessionModule = {
	type: SESSION_TYPE.CLAUDE,
	component: ClaudePane,
	header: ClaudeHeader,
	settingsComponent: ClaudeSettings, // In-session settings dialog

	// Settings page section (auto-registered by session-modules/index.js)
	settingsSection: {
		id: 'claude',
		label: 'Claude',
		icon: ClaudeIcon,
		component: ClaudeSettingsSection,
		navAriaLabel: 'Claude authentication and session settings',
		order: 70
	},
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
