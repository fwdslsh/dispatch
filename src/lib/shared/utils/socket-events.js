/**
 * Shared Socket.IO event constants for frontend and backend
 * Provides single source of truth for all socket event names
 */

// Re-export server events for consistency
export const SOCKET_EVENTS = {
	// Connection events
	CONNECTION: 'connection',
	DISCONNECT: 'disconnect',
	ERROR: 'error',
	CONNECT_ERROR: 'connect_error',
	RECONNECT: 'reconnect',
	RECONNECT_ATTEMPT: 'reconnect_attempt',
	
	// Authentication events
	AUTH: 'auth',
	AUTH_SUCCESS: 'auth.success',
	AUTH_ERROR: 'auth.error',
	
	// Session management events
	SESSION_CREATE: 'session.create',
	SESSION_ATTACH: 'session.attach',
	SESSION_LIST: 'session.list',
	SESSION_STATUS: 'session.status',
	SESSION_END: 'session.end',
	SESSION_DETACH: 'session.detach',
	SESSION_CATCHUP: 'session.catchup',
	
	// Claude-specific events
	CLAUDE_SEND: 'claude.send',
	CLAUDE_MESSAGE_DELTA: 'claude.message.delta',
	CLAUDE_MESSAGE_COMPLETE: 'claude.message.complete',
	CLAUDE_ERROR: 'claude.error',
	CLAUDE_TOOLS_AVAILABLE: 'claude.tools.available',
	
	// Terminal events
	TERMINAL_INPUT: 'terminal.input',
	TERMINAL_OUTPUT: 'terminal.output',
	TERMINAL_RESIZE: 'terminal.resize',
	TERMINAL_ERROR: 'terminal.error',
	
	// Workspace events
	WORKSPACE_LIST: 'workspace.list',
	WORKSPACE_CREATE: 'workspace.create',
	WORKSPACE_OPEN: 'workspace.open',
	
	// Admin/system events
	ADMIN_EVENT_LOGGED: 'admin.event.logged',
	SYSTEM_STATUS: 'system.status',
	
	// Public URL events
	GET_PUBLIC_URL: 'get-public-url',
	PUBLIC_URL_RESPONSE: 'public-url-response',
	
	// Legacy events (for backwards compatibility)
	MESSAGE_DELTA: 'message.delta',
	MESSAGE_COMPLETE: 'message.complete'
};

// Event name aliases for common patterns
export const EVENT_NAMES = SOCKET_EVENTS;

// Export individual event groups for convenience
export const CONNECTION_EVENTS = {
	CONNECTION: SOCKET_EVENTS.CONNECTION,
	DISCONNECT: SOCKET_EVENTS.DISCONNECT,
	ERROR: SOCKET_EVENTS.ERROR,
	CONNECT_ERROR: SOCKET_EVENTS.CONNECT_ERROR,
	RECONNECT: SOCKET_EVENTS.RECONNECT,
	RECONNECT_ATTEMPT: SOCKET_EVENTS.RECONNECT_ATTEMPT
};

export const SESSION_EVENTS = {
	CREATE: SOCKET_EVENTS.SESSION_CREATE,
	ATTACH: SOCKET_EVENTS.SESSION_ATTACH,
	LIST: SOCKET_EVENTS.SESSION_LIST,
	STATUS: SOCKET_EVENTS.SESSION_STATUS,
	END: SOCKET_EVENTS.SESSION_END,
	DETACH: SOCKET_EVENTS.SESSION_DETACH,
	CATCHUP: SOCKET_EVENTS.SESSION_CATCHUP
};

export const CLAUDE_EVENTS = {
	SEND: SOCKET_EVENTS.CLAUDE_SEND,
	MESSAGE_DELTA: SOCKET_EVENTS.CLAUDE_MESSAGE_DELTA,
	MESSAGE_COMPLETE: SOCKET_EVENTS.CLAUDE_MESSAGE_COMPLETE,
	ERROR: SOCKET_EVENTS.CLAUDE_ERROR,
	TOOLS_AVAILABLE: SOCKET_EVENTS.CLAUDE_TOOLS_AVAILABLE
};

export const TERMINAL_EVENTS = {
	INPUT: SOCKET_EVENTS.TERMINAL_INPUT,
	OUTPUT: SOCKET_EVENTS.TERMINAL_OUTPUT,
	RESIZE: SOCKET_EVENTS.TERMINAL_RESIZE,
	ERROR: SOCKET_EVENTS.TERMINAL_ERROR
};