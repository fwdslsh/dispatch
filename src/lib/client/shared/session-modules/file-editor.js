import FileEditorPane from '$lib/client/file-editor/FileEditorPane.svelte';

export const fileEditorSessionModule = {
	type: 'file-editor',
	aliases: ['editor', 'file'],
	component: FileEditorPane,
	prepareProps(session = {}) {
		console.log('[file-editor-module] Preparing props for session:', session);
		// Use typeSpecificId as sessionId since that's the runId for file editor sessions
		const sessionId = session.typeSpecificId || session.id;
		const props = {
			sessionId: sessionId,
			workspacePath: session.workspacePath
		};
		console.log('[file-editor-module] Prepared props:', props);
		return props;
	}
};