/**
 * AI Session Module
 *
 * v2.0 Hard Fork: OpenCode-first architecture
 * Unified session module for AI-powered sessions.
 *
 * @file src/lib/client/ai/ai.js
 */

import AIPanel from '$lib/client/ai/AIPanel.svelte';
import ChatHeader from '$lib/client/ai/ChatHeader.svelte';
import AISettings from '$lib/client/ai/AISettings.svelte';
import AISettingsSection from '$lib/client/settings/sections/sessions/AI.svelte';
import IconRobot from '$lib/client/shared/components/Icons/IconRobot.svelte';
import { SESSION_TYPE } from '$lib/shared/session-types.js';

/**
 * AI session module definition
 * @type {import('$lib/client/shared/types.js').ISessionModule}
 */
export const aiSessionModule = {
	type: SESSION_TYPE.AI,
	component: AIPanel,
	header: ChatHeader,
	settingsComponent: AISettings,

	// Settings page section (auto-registered by session-modules/index.js)
	settingsSection: {
		id: 'ai',
		label: 'AI Assistant',
		icon: IconRobot,
		component: AISettingsSection,
		navAriaLabel: 'AI assistant settings and OpenCode configuration',
		order: 70
	},

	/**
	 * Prepare props for ChatPane component
	 */
	prepareProps(session = {}) {
		return {
			sessionId: session.id,
			aiSessionId: session.aiSessionId || session.typeSpecificId || session.sessionId,
			shouldResume: Boolean(session.shouldResume || session.resumeSession),
			workspacePath: session.workspacePath
		};
	},

	/**
	 * Prepare props for ChatHeader component
	 */
	prepareHeaderProps(session = {}, options = {}) {
		const { onClose, index } = options;
		return {
			session,
			onClose,
			index,
			aiSessionId: session.aiSessionId || session.typeSpecificId || session.sessionId
		};
	}
};
