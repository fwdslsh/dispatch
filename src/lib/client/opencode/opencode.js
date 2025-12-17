/**
 * OpenCode Session Module
 *
 * Provides OpenCode AI session integration in workspace windows.
 * Reuses portal components for consistent UX.
 *
 * @file src/lib/client/opencode/opencode.js
 */

import OpenCodePane from '$lib/client/opencode/OpenCodePane.svelte';
import OpenCodeHeader from '$lib/client/opencode/OpenCodeHeader.svelte';
import IconRobot from '$lib/client/shared/components/Icons/IconRobot.svelte';
import { SESSION_TYPE } from '$lib/shared/session-types.js';

/**
 * OpenCode session module definition
 * Provides OpenCode portal UI in workspace windows
 * @type {import('$lib/client/shared/types.js').ISessionModule}
 */
export const opencodeSessionModule = {
	type: SESSION_TYPE.OPENCODE,
	component: OpenCodePane,
	header: OpenCodeHeader,

	// Settings section (if needed in future)
	settingsSection: null,

	/**
	 * Prepare props for OpenCodePane component
	 */
	prepareProps(session = {}) {
		return {
			sessionId: session.id,
			opencodeSessionId: session.opencodeSessionId || session.typeSpecificId || session.id,
			workspacePath: session.workspacePath,
			provider: session.provider,
			model: session.model
		};
	},

	/**
	 * Prepare props for OpenCodeHeader component
	 */
	prepareHeaderProps(session = {}, options = {}) {
		const { onClose, index } = options;
		return {
			session,
			onClose,
			index,
			opencodeSessionId: session.opencodeSessionId || session.typeSpecificId || session.id
		};
	}
};
