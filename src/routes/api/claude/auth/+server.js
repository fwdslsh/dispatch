import { json } from '@sveltejs/kit';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '$lib/server/shared/utils/logger.js';

const execAsync = promisify(exec);

/**
 * Claude Authentication API
 * GET: Check authentication status
 * POST: Manual API key authentication
 * DELETE: Sign out/clear credentials
 */

export async function GET() {
	// Check ~/.claude/.credentials.json for valid Claude OAuth token
	try {
		const credentialsPath = join(homedir(), '.claude', '.credentials.json');
		// If the file doesn't exist, user is not authenticated
		try {
			await fs.access(credentialsPath);
		} catch {
			return json({
				authenticated: false,
				status: 'not_authenticated',
				hint: 'Claude credentials file not found'
			});
		}
		const raw = await fs.readFile(credentialsPath, 'utf8');
		const creds = JSON.parse(raw);
		const oauth = creds.claudeAiOauth;
		if (
			oauth &&
			typeof oauth.accessToken === 'string' &&
			oauth.accessToken.length > 0 &&
			typeof oauth.expiresAt === 'number' &&
			oauth.expiresAt > Date.now()
		) {
			return json({
				authenticated: true,
				status: 'authenticated'
			});
		} else {
			logger.warn('CLAUDE', 'Claude OAuth token missing or expired', {
				expiresAt: oauth?.expiresAt,
				now: Date.now()
			});

			return json({
				authenticated: false,
				status: 'not_authenticated',
				hint: 'No valid Claude OAuth token found'
			});
		}
	} catch (error_) {
		logger.error('Claude auth GET error:', error_);

		return json({
			authenticated: false,
			status: 'not_authenticated',
			hint: 'Claude credentials not found or invalid',
			error: error_
		});
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
			await execAsync(`claude auth login --api-key "${apiKey}"`, {
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
	} catch (error_) {
		console.error('Claude auth POST error:', error_);
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
	} catch (error_) {
		console.error('Claude sign out failed:', error_);
		return json(
			{
				success: false,
				error: 'Failed to sign out'
			},
			{ status: 500 }
		);
	}
}
