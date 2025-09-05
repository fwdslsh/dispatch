/**
 * Session Types - Server-side exports
 * 
 * This module contains server-only session type functionality including handlers
 * and server-side session type implementations that use Node.js APIs.
 */

// Server-side session type implementations
export { shellSessionType } from './shell/index.js';
export { claudeSessionType } from './claude/index.js';

// Server-side handlers
export { createShellHandlers } from './shell/ShellHandler.js';
export { createClaudeHandlers } from './claude/ClaudeHandler.js';

/**
 * Static handler map for WebSocket handlers (server-only)
 */
export const SESSION_TYPE_HANDLERS = {
  'shell': () => import('./shell/ShellHandler.js').then(m => m.createShellHandlers),
  'claude': () => import('./claude/ClaudeHandler.js').then(m => m.createClaudeHandlers)
};