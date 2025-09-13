import { json } from '@sveltejs/kit';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const execAsync = promisify(exec);

/**
 * Claude Authentication API
 * GET: Check authentication status
 * POST: Manual API key authentication
 * DELETE: Sign out/clear credentials
 */

export async function GET() {
	try {
		// Check if Claude CLI is available and authenticated
		const { stdout, stderr } = await execAsync('claude auth status', {
			timeout: 5000,
			env: { ...process.env, PATH: process.env.PATH }
		});

		if (stdout.includes('authenticated') || stdout.includes('logged in')) {
			return json({
				authenticated: true,
				status: 'authenticated'
			});
		} else {
			return json({
				authenticated: false,
				status: 'not_authenticated',
				hint: 'Use the OAuth flow or enter your API key to authenticate'
			});
		}
	} catch (error) {
		console.error('Claude auth status check failed:', error);

		// If Claude CLI is not available, return not authenticated
		if (error.message?.includes('command not found') || error.message?.includes('not found')) {
			return json({
				authenticated: false,
				status: 'not_authenticated',
				hint: 'Claude CLI not available - use API key authentication'
			});
		}

		return json(
			{
				authenticated: false,
				status: 'error',
				error: 'Failed to check authentication status'
			},
			{ status: 500 }
		);
	}
}

export async function POST({ request }) {
	try {
		const { apiKey } = await request.json();

		if (!apiKey || typeof apiKey !== 'string') {
			return json(
				{
					success: false,
					error: 'API key is required'
				},
				{ status: 400 }
			);
		}

		// Validate API key format (Anthropic keys start with sk-ant-)
		if (!apiKey.startsWith('sk-ant-')) {
			return json(
				{
					success: false,
					error: 'Invalid API key format'
				},
				{ status: 400 }
			);
		}

		// Try to authenticate with the API key using Claude CLI
		try {
			const { stdout, stderr } = await execAsync(`claude auth login --api-key "${apiKey}"`, {
				timeout: 10000,
				env: { ...process.env, PATH: process.env.PATH }
			});

			return json({
				success: true,
				message: 'API key authentication successful'
			});
		} catch (authError) {
			console.error('Claude API key auth failed:', authError);
			return json(
				{
					success: false,
					error: 'Invalid API key or authentication failed'
				},
				{ status: 401 }
			);
		}
	} catch (error) {
		console.error('Claude auth POST error:', error);
		return json(
			{
				success: false,
				error: 'Authentication request failed'
			},
			{ status: 500 }
		);
	}
}

export async function DELETE() {
	try {
		// Sign out using Claude CLI
		await execAsync('claude auth logout', {
			timeout: 5000,
			env: { ...process.env, PATH: process.env.PATH }
		});

		// Also try to remove credentials file if it exists
		try {
			const credentialsPath = join(homedir(), '.claude', 'credentials.json');
			await fs.unlink(credentialsPath);
		} catch {
			// Ignore errors removing credentials file
		}

		return json({
			success: true,
			message: 'Signed out successfully'
		});
	} catch (error) {
		console.error('Claude sign out failed:', error);
		return json(
			{
				success: false,
				error: 'Failed to sign out'
			},
			{ status: 500 }
		);
	}
}
