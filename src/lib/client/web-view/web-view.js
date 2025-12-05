import WebViewPane from '$lib/client/web-view/WebViewPane.svelte';
import { SESSION_TYPE } from '$lib/shared/session-types.js';

/**
 * @type {import('$lib/client/shared/types.js').ISessionModule} ISessionModule
 */
export const webViewSessionModule = {
	type: SESSION_TYPE.WEB_VIEW,
	component: WebViewPane,
	prepareProps(session = {}) {
		console.log('[web-view-module] Preparing props for session:', session);
		// Use the session.id directly for web view sessions
		const sessionId = session.id || session.typeSpecificId;
		const props = {
			sessionId: sessionId,
			workspacePath: session.workspacePath || session.workingDirectory || ''
		};
		console.log('[web-view-module] Prepared props:', props);
		return props;
	},
	prepareHeaderProps: function (_session, _options) {
		return {};
	}
};
