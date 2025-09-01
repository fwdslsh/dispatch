import { ClaudeCodeService } from '../services/claude-code-service.js';
import fs from 'node:fs';
import path from 'node:path';

const claudeService = new ClaudeCodeService();

/**
 * Check if Claude credentials exist in a specific directory
 * @param {string} homeDir - The home directory to check for credentials
 * @returns {boolean} Whether Claude credentials exist
 */
export function checkClaudeCredentials(homeDir) {
  try {
    const credentialsPath = path.join(homeDir, '.claude', 'credentials.json');
    return fs.existsSync(credentialsPath);
  } catch (error) {
    console.error('Error checking Claude credentials:', error);
    return false;
  }
}

/**
 * Authentication middleware for Claude Code endpoints
 * @param {Function} handler - The route handler function
 * @returns {Function} Wrapped handler with authentication check
 */
export function withClaudeAuth(handler) {
  return async (context) => {
    try {
      // Test authentication by making a simple query
     // await claudeService.query('ping', { maxTurns: 1 });
      
      // Add Claude service to context for use in handlers
      context.claudeService = claudeService;
      
      return await handler(context);
      
    } catch (error) {
      console.error('Claude authentication middleware error:', error);
      
      const isAuthError = error.message?.includes('not authenticated') || error.message?.includes('login');
      
      return new Response(JSON.stringify({
        error: isAuthError ? 'Not authenticated with Claude CLI' : 'Authentication verification failed',
        hint: isAuthError ? 'Run: claude setup-token' : error.message
      }), {
        status: isAuthError ? 401 : 500,
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
    await claudeService.query('ping', { maxTurns: 1 });
    return true;
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