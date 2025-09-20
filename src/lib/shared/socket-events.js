
// Unified Socket.IO event constants for frontend and backend (post-unified session refactor)
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

  // Unified run session events (the only session events used)
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
  PUBLIC_URL_RESPONSE: 'public-url-response'
};

