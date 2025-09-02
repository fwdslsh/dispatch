import { json } from '@sveltejs/kit';
import { ClaudeCodeService } from '$lib/services/claude-code-service.js';

const claudeService = new ClaudeCodeService();

/**
 * POST /api/claude/query - Execute a query using Claude Code SDK
 */
export async function POST({ request }) {
  try {
    const { prompt, options = {} } = await request.json();
    
    if (!prompt || typeof prompt !== 'string') {
      return json({
        error: 'Prompt is required and must be a string'
      }, { status: 400 });
    }

    // // Check authentication first
    // const isAuthenticated = await claudeService.();
    // if (!isAuthenticated) {
    //   return json({
    //     error: 'Not authenticated with Claude CLI',
    //     hint: 'Run: npx @anthropic-ai/claude setup-token'
    //   }, { status: 401 });
    // }

    // Execute the query
    const response = await claudeService.query(prompt.trim(), options);

    return json({
      response,
      success: true
    });
    
  } catch (error) {
    console.error('Claude query failed:', error);
    
    return json({
      error: error.message || 'Query execution failed',
      success: false
    }, { status: 500 });
  }
}