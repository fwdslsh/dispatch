import { json } from '@sveltejs/kit';
import { ClaudeCodeService } from '../../../../lib/services/claude-code-service.js';

const claudeService = new ClaudeCodeService();

/**
 * GET /api/claude/auth - Check Claude CLI authentication status
 */
export async function GET() {
  try {
    const isAuthenticated = await claudeService.checkAuthentication();
    
    return json({
      authenticated: isAuthenticated,
      error: isAuthenticated ? null : 'Not authenticated with Claude CLI'
    });
    
  } catch (error) {
    console.error('Claude auth check failed:', error);
    
    return json({
      authenticated: false,
      error: error.message || 'Authentication check failed',
      hint: 'Run: npx @anthropic-ai/claude-code login'
    }, { status: 500 });
  }
}