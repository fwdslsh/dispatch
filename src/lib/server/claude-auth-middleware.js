import { ClaudeCodeService } from '$lib/services/claude-code-service.js';

const claudeService = new ClaudeCodeService();

/**
 * Authentication middleware for Claude Code endpoints
 * @param {Function} handler - The route handler function
 * @returns {Function} Wrapped handler with authentication check
 */
export function withClaudeAuth(handler) {
  return async (context) => {
    try {
      const isAuthenticated = await claudeService.checkAuthentication();
      
      if (!isAuthenticated) {
        return new Response(JSON.stringify({
          error: 'Not authenticated with Claude CLI',
          hint: 'Run: npx @anthropic-ai/claude-code login'
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      // Add Claude service to context for use in handlers
      context.claudeService = claudeService;
      
      return await handler(context);
      
    } catch (error) {
      console.error('Claude authentication middleware error:', error);
      
      return new Response(JSON.stringify({
        error: 'Authentication verification failed',
        details: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  };
}

/**
 * Check Claude CLI authentication status
 * @returns {Promise<boolean>} Authentication status
 */
export async function checkClaudeAuth() {
  try {
    return await claudeService.checkAuthentication();
  } catch (error) {
    console.error('Claude auth check failed:', error);
    return false;
  }
}

/**
 * Get Claude service instance
 * @returns {ClaudeCodeService} The Claude service instance
 */
export function getClaudeService() {
  return claudeService;
}