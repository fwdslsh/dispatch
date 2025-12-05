import WebViewPane from '$lib/client/web-view/WebViewPane.svelte';
import { SESSION_TYPE } from '$lib/shared/session-types.js';

/**
 * @type {import('$lib/client/shared/types.js').ISessionModule} ISessionModule
 */
export const webViewSessionModule = {
	type: SESSION_TYPE.WEB_VIEW,
	component: WebViewPane,
	prepareProps(session = {}) {
		// Use the session.id directly for web view sessions
		const sessionId = session.id || session.typeSpecificId;
		const props = {
			sessionId: sessionId,
			workspacePath: session.workspacePath || session.workingDirectory || ''
		};
		return props;
	},
	prepareHeaderProps: function (_session, _options) {
		return {};
	}
};
