import FileEditorPane from '$lib/client/file-editor/FileEditorPane.svelte';
import { SESSION_TYPE } from '$lib/shared/session-types.js';

export const fileEditorSessionModule = {
	type: SESSION_TYPE.FILE_EDITOR,
	component: FileEditorPane,
	prepareProps(session = {}) {
		console.log('[file-editor-module] Preparing props for session:', session);
		// Use the session.id directly for file editor sessions
		const sessionId = session.id || session.typeSpecificId;
		const props = {
			sessionId: sessionId,
			workspacePath: session.workspacePath || session.workingDirectory || ''
		};
		console.log('[file-editor-module] Prepared props:', props);
		return props;
	}
};
