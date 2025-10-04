/**
 * System Status API Endpoint
 * Provides system status information including onboarding completion
 *
 * GET /api/status - Get system status (no authentication required)
 */

import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * GET /api/status
 * Retrieve system status including onboarding state
 *
 * No authentication required to allow initial status checks
 */
export async function GET({ locals }) {
	try {
		const dbManager = locals.services.database;
		await dbManager.init();

		// Get onboarding settings from database
		const onboardingSettings = await dbManager.getSettingsByCategory('onboarding');

		// Get authentication settings to check if terminal key exists
		const authSettings = await dbManager.getSettingsByCategory('authentication');
		const hasTerminalKey = !!authSettings?.terminal_key;

		// Build response
		const response = {
			onboarding: {
				isComplete: onboardingSettings?.isComplete || false,
				completedAt: onboardingSettings?.completedAt || null,
				firstWorkspaceId: onboardingSettings?.firstWorkspaceId || null
			},
			authentication: {
				configured: hasTerminalKey
			},
			server: {
				version: process.env.npm_package_version || '1.0.0',
				uptime: process.uptime()
			}
		};

		logger.debug('STATUS_API', 'Status check:', response);

		return json(response, {
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				Pragma: 'no-cache',
				Expires: '0'
			}
		});
	} catch (error) {
		logger.error('STATUS_API', 'Failed to get system status:', error);
		return json(
			{
				error: 'Internal server error',
				onboarding: { isComplete: false },
				authentication: { configured: false }
			},
			{ status: 500 }
		);
	}
}

/**
 * OPTIONS /api/status
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
}
