import { json } from '@sveltejs/kit';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(exec);

// Store for OAuth sessions (in production, use Redis or database)
const oauthSessions = new Map();

// Clean up expired sessions every 10 minutes
setInterval(
	() => {
		const now = Date.now();
		for (const [sessionId, session] of oauthSessions.entries()) {
			if (now - session.created > 30 * 60 * 1000) {
				// 30 minutes
				oauthSessions.delete(sessionId);
			}
		}
	},
	10 * 60 * 1000
);

/**
 * Setup Token API
 * Initiates Claude OAuth authentication flow
 */
export async function POST() {
	try {
		// Generate session ID for tracking this auth flow
		const sessionId = randomUUID();

		// Start Claude setup-token flow
		const { stdout, stderr } = await execAsync('claude setup-token', {
			timeout: 15000,
			env: { ...process.env, PATH: process.env.PATH }
		});

		// Parse the output to extract the OAuth URL
		// Claude CLI typically outputs something like:
		// "Please visit: https://console.anthropic.com/login?code=..."
		const urlMatch = stdout.match(/https:\/\/console\.anthropic\.com\/login\?code=[\w-]+/);

		if (!urlMatch) {
			console.error('Failed to extract OAuth URL from Claude CLI output:', stdout, stderr);
			return json(
				{
					success: false,
					error: 'Failed to generate authentication URL'
				},
				{ status: 500 }
			);
		}

		const authUrl = urlMatch[0];

		// Store session info
		oauthSessions.set(sessionId, {
			created: Date.now(),
			authUrl,
			completed: false
		});

		return json({
			success: true,
			authUrl,
			sessionId,
			instructions:
				'Complete authentication in the browser window, then paste the authorization code'
		});
	} catch (error) {
		console.error('Claude setup-token failed:', error);

		if (error.message?.includes('command not found') || error.message?.includes('not found')) {
			return json(
				{
					success: false,
					error:
						'Claude CLI not available. Please install the Claude CLI or use API key authentication.'
				},
				{ status: 503 }
			);
		}

		return json(
			{
				success: false,
				error: 'Failed to initiate OAuth flow'
			},
			{ status: 500 }
		);
	}
}
