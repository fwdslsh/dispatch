import { json } from '@sveltejs/kit';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// Import the sessions map from setup-token (in production, use shared storage)
// For now, we'll create a simple shared storage mechanism
const oauthSessions = global.claudeOAuthSessions || (global.claudeOAuthSessions = new Map());

/**
 * Complete Authentication API
 * Completes Claude OAuth authentication with authorization code
 */
export async function POST({ request }) {
	try {
		const { sessionId, authCode } = await request.json();

		if (!sessionId || !authCode) {
			return json(
				{
					success: false,
					error: 'Session ID and authorization code are required'
				},
				{ status: 400 }
			);
		}

		// Validate session
		const session = oauthSessions.get(sessionId);
		if (!session) {
			return json(
				{
					success: false,
					error: 'Invalid or expired session'
				},
				{ status: 400 }
			);
		}

		if (session.completed) {
			return json(
				{
					success: false,
					error: 'Session already completed'
				},
				{ status: 400 }
			);
		}

		// Validate authorization code format
		const authCodeTrimmed = authCode.trim();
		if (authCodeTrimmed.length < 10) {
			return json(
				{
					success: false,
					error: 'Invalid authorization code format'
				},
				{ status: 400 }
			);
		}

		try {
			// Complete the authentication using Claude CLI
			// The exact command might vary - this is based on typical OAuth flows
			const { stdout, stderr } = await execAsync(`claude auth complete "${authCodeTrimmed}"`, {
				timeout: 15000,
				env: { ...process.env, PATH: process.env.PATH }
			});

			// Check if authentication was successful
			if (stdout.includes('success') || stdout.includes('authenticated')) {
				// Mark session as completed
				session.completed = true;
				oauthSessions.set(sessionId, session);

				// Clean up the session after a delay
				setTimeout(() => {
					oauthSessions.delete(sessionId);
				}, 60000); // Clean up after 1 minute

				return json({
					success: true,
					message: 'Authentication completed successfully'
				});
			} else {
				console.error('Claude auth completion failed:', stdout, stderr);
				return json(
					{
						success: false,
						error: 'Authentication failed - invalid authorization code'
					},
					{ status: 401 }
				);
			}
		} catch (execError) {
			console.error('Claude auth completion exec failed:', execError);

			// Check for specific error messages
			if (execError.message?.includes('invalid') || execError.message?.includes('expired')) {
				return json(
					{
						success: false,
						error: 'Invalid or expired authorization code'
					},
					{ status: 401 }
				);
			}

			return json(
				{
					success: false,
					error: 'Authentication completion failed'
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error('Complete auth error:', error);
		return json(
			{
				success: false,
				error: 'Authentication request failed'
			},
			{ status: 500 }
		);
	}
}
