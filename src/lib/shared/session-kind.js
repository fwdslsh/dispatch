/**
 * Normalize various session type aliases to canonical kinds.
 * @param {string | null | undefined} value
 * @returns {'pty' | 'claude' | 'file-editor' | null}
 */
export function normalizeSessionKind(value) {
	if (!value) return null;
	const normalized = String(value).trim().toLowerCase();
	if (!normalized) return null;

	switch (normalized) {
		case 'pty':
		case 'terminal':
		case 'terminal_session':
		case 'terminal-session':
		case 'terminalsession':
		case 'shell':
			return 'pty';
		case 'claude':
		case 'claude_session':
		case 'claude-session':
		case 'claudesession':
		case 'claude_code':
		case 'claude-code':
		case 'claudecode':
			return 'claude';
		case 'file-editor':
		case 'file_editor':
		case 'fileeditor':
		case 'editor':
		case 'file':
			return 'file-editor';
		default:
			return null;
	}
}

