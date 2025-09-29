// Unified Socket.IO event constants for frontend and backend
export const SOCKET_EVENTS = {
	// Core connection/auth events
	CONNECTION: 'connect',
	DISCONNECT: 'disconnect',
	ERROR: 'error',
	CONNECT_ERROR: 'connect_error',
	RECONNECT: 'reconnect',
	RECONNECT_ATTEMPT: 'reconnect_attempt',
	AUTH: 'auth',
	AUTH_SUCCESS: 'auth.success',
	AUTH_ERROR: 'auth.error',

	// Run session events
	RUN_ATTACH: 'run:attach',
	RUN_INPUT: 'run:input',
	RUN_RESIZE: 'run:resize',
	RUN_CLOSE: 'run:close',
	RUN_EVENT: 'run:event',

	// Claude authentication (OAuth) events (still needed for auth flow)
	CLAUDE_AUTH_START: 'claude.auth.start',
	CLAUDE_AUTH_URL: 'claude.auth.url',
	CLAUDE_AUTH_CODE: 'claude.auth.code',
	CLAUDE_AUTH_COMPLETE: 'claude.auth.complete',
	CLAUDE_AUTH_ERROR: 'claude.auth.error',

	// Workspace/admin events (minimal, not session-related)
	WORKSPACE_LIST: 'workspace.list',
	WORKSPACE_CREATE: 'workspace.create',
	WORKSPACE_OPEN: 'workspace.open',
	ADMIN_EVENT_LOGGED: 'admin.event.logged',
	SYSTEM_STATUS: 'system.status',
	GET_PUBLIC_URL: 'get-public-url',
	PUBLIC_URL_RESPONSE: 'public-url-response',

	// Tunnel control events
	TUNNEL_ENABLE: 'tunnel.enable',
	TUNNEL_DISABLE: 'tunnel.disable',
	TUNNEL_STATUS: 'tunnel.status',
	TUNNEL_UPDATE_CONFIG: 'tunnel.updateConfig',

	// VS Code tunnel events
	VSCODE_TUNNEL_START: 'vscode.tunnel.start',
	VSCODE_TUNNEL_STOP: 'vscode.tunnel.stop',
	VSCODE_TUNNEL_STATUS: 'vscode.tunnel.status',
	VSCODE_TUNNEL_LOGIN_URL: 'vscode.tunnel.login-url',

	// Settings events for real-time updates
	SETTINGS_UPDATED: 'settings.updated',
	SETTINGS_CATEGORY_UPDATED: 'settings.category.updated',
	SETTINGS_AUTH_INVALIDATED: 'settings.auth.invalidated'
};
