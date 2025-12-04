import OpenCodePane from '$lib/client/opencode/OpenCodePane.svelte';
import OpenCodeSettings from '$lib/client/opencode/OpenCodeSettings.svelte';
import OpenCodeHeader from '$lib/client/opencode/OpenCodeHeader.svelte';
import OpenCodeSettingsSection from '$lib/client/settings/sections/sessions/OpenCode.svelte';
import IconRobot from '$lib/client/shared/components/Icons/IconRobot.svelte';
import { SESSION_TYPE } from '$lib/shared/session-types.js';

/**
 * @type {import('$lib/client/shared/types.js').ISessionModule} ISessionModule
 */
export const opencodeSessionModule = {
	type: SESSION_TYPE.OPENCODE,
	component: OpenCodePane,
	header: OpenCodeHeader,
	settingsComponent: OpenCodeSettings, // In-session settings dialog

	// Settings page section (auto-registered by session-modules/index.js)
	settingsSection: {
		id: 'opencode',
		label: 'OpenCode',
		icon: IconRobot,
		component: OpenCodeSettingsSection,
		navAriaLabel: 'OpenCode server configuration and session settings',
		order: 75 // Place after Claude (70) but before other sessions
	},
	prepareProps(session = {}) {
		return {
			sessionId: session.id,
			opencodeSessionId: session.opencodeSessionId || session.typeSpecificId || session.sessionId,
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
			opencodeSessionId:
				session.opencodeSessionId || session.typeSpecificId || session.sessionId
		};
	}
};
