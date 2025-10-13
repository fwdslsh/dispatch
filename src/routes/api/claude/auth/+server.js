import { json } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '$lib/server/shared/utils/logger.js';
import { AUTH_TIMEOUTS } from '$lib/shared/constants/auth-timeouts.js';

/**
 * Promisify spawn() for async/await with timeout support
 * Prevents shell injection by passing arguments as array
 */
function spawnAsync(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const { timeout, ...spawnOptions } = options;
		const child = spawn(command, args, spawnOptions);

		let stdout = '';
		let stderr = '';
		let timedOut = false;
		let timeoutId;

		// Set up timeout if specified
		if (timeout) {
			timeoutId = setTimeout(() => {
				timedOut = true;
				child.kill('SIGTERM');
				reject(new Error(`Process timed out after ${timeout}ms`));
			}, timeout);
		}

		if (child.stdout) {
			child.stdout.on('data', (data) => {
				stdout += data.toString();
			});
		}

		if (child.stderr) {
			child.stderr.on('data', (data) => {
				stderr += data.toString();
			});
		}

		child.on('error', (error) => {
			if (timeoutId) clearTimeout(timeoutId);
			if (!timedOut) reject(error);
		});

		child.on('close', (code) => {
			if (timeoutId) clearTimeout(timeoutId);
			if (timedOut) return; // Error already sent

			if (code === 0) {
				resolve({ stdout, stderr });
			} else {
				const error = /** @type {Error & {code?: number, stdout?: string, stderr?: string}} */ (
					new Error(`Process exited with code ${code}`)
				);
				error.code = code || undefined;
				error.stdout = stdout;
				error.stderr = stderr;
				reject(error);
			}
		});
	});
}

/**
 * Claude Authentication API
 * GET: Check authentication status
 * POST: Manual API key authentication
 * DELETE: Sign out/clear credentials
 */

export async function GET() {
    // Only support $HOME/.claude/.credentials.json
    try {
        const credentialsPath = join(homedir(), '.claude', '.credentials.json');
        try {
            await fs.access(credentialsPath);
        } catch {
            return json({ authenticated: false, status: 'not_authenticated', hint: 'Claude credentials file not found' });
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

			return json({ authenticated: false, status: 'not_authenticated', hint: 'No valid Claude OAuth token found' });
		}
	} catch (error_) {
		logger.error('Claude auth GET error:', error_);
        return json({ authenticated: false, status: 'not_authenticated', hint: 'Claude credentials not found or invalid', error: error_.message || 'Unknown error' });
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
		// SECURITY: Use spawn() with array args to prevent shell injection
		try {
			await spawnAsync('claude', ['auth', 'login', '--api-key', apiKey], {
				timeout: AUTH_TIMEOUTS.API_REQUEST,
				env: { ...process.env, PATH: process.env.PATH }
			});

			return json({
				success: true,
				message: 'API key authentication successful'
			});
		} catch (authError) {
			logger.error('Claude API key auth failed:', authError);
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
		// SECURITY: Use spawn() with array args to prevent shell injection
		await spawnAsync('claude', ['auth', 'logout'], {
			timeout: AUTH_TIMEOUTS.LOGOUT,
			env: { ...process.env, PATH: process.env.PATH }
		});

    // Also try to remove credentials file if it exists
    try {
        const credentialsPath = join(homedir(), '.claude', '.credentials.json');
		console.log('Removing Claude credentials from', credentialsPath);
        await fs.unlink(credentialsPath);
    } catch {
        // Ignore errors removing credentials file
    }

		return json({
			success: true,
			message: 'Signed out successfully'
		});
	} catch (error_) {
		logger.error('Claude sign out failed:', error_);
		return json(
			{
				success: false,
				error: 'Failed to sign out'
			},
			{ status: 500 }
		);
	}
}
