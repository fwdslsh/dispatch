import { json } from '@sveltejs/kit';
import { ClaudeCodeService } from '../../../../lib/services/claude-code-service.js';

const claudeService = new ClaudeCodeService();

/**
 * GET /api/claude/auth - Check Claude CLI authentication status
 */
export async function GET() {
  try {
    // Test authentication by making a simple query
    await claudeService.query('ping', { maxTurns: 1 });
    
    return json({
      authenticated: true,
      error: null
    });
    
  } catch (error) {
    console.error('Claude auth check failed:', error);
    
    await claudeService.query('/login', { maxTurns: 1 });
    const isAuthError = error.message?.includes('not authenticated') || error.message?.includes('login');
    
    return json({
      authenticated: false,
      error: isAuthError ? 'Not authenticated with Claude CLI' : error.message,
      hint: isAuthError ? 'Run: npx @anthropic-ai/claude setup-token' : 'Authentication check failed'
    }, { status: 500 });
  }
}