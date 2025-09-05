/**
 * Base Handler Factory
 * 
 * Common utilities for creating session type handlers.
 * Re-exports from consolidated utility modules.
 */

// Re-export handler utilities
export {
  createAuthHandler,
  createCallbackHandler,
  createInputHandler,
  emitSessionEvent,
  createSuccessResponse,
  createErrorResponse,
  safeCallback
} from '../utils/handler-utils.js';

// Re-export session utilities
export {
  validateRequiredFields,
  generateSessionId,
  logSessionOperation,
  createSessionObject,
  validateSessionOptions,
  validateTerminalDimensions,
  sanitizeSessionName
} from '../utils/session-utils.js';