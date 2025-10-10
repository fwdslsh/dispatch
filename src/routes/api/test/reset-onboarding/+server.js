/**
 * Test API - Reset Onboarding State
 *
 * This endpoint is ONLY available in test environments (NODE_ENV !== 'production')
 * It resets the onboarding state to allow E2E tests to test the onboarding flow
 *
 * POST /api/test/reset-onboarding - Reset onboarding state
 */

import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * POST /api/test/reset-onboarding
 * Reset onboarding state in the database
 *
 * Only available in non-production environments for testing
 * No authentication required - this is a test-only endpoint
 */
export async function POST({ locals }) {
	// Security: Only allow in test/development environments
	if (process.env.NODE_ENV === 'production') {
		return json({ error: 'Not available in production' }, { status: 403 });
	}

	// Log for debugging
	logger.debug('TEST_API', 'Reset onboarding request received');

	try {
		const { database } = locals.services;

		// Delete onboarding_complete setting from system category
		// The onboarding status is stored in settings table as JSON
		// We need to remove the onboarding_complete key from the system category JSON

		// Get current system settings
		const systemRow = await database.get(
			`SELECT settings_json FROM settings WHERE category = ?`,
			['system']
		);

		if (systemRow) {
			const settings = JSON.parse(systemRow.settings_json || '{}');
			delete settings.onboarding_complete;

			// Update settings without onboarding_complete
			await database.run(
				`UPDATE settings SET settings_json = ?, updated_at = ? WHERE category = ?`,
				[JSON.stringify(settings), Date.now(), 'system']
			);
		}

		// Also delete any API keys that were created during onboarding
		// This ensures a clean slate for the onboarding flow
		try {
			await database.run('DELETE FROM auth_api_keys WHERE label = ?', 'First API Key');
		} catch (dbError) {
			logger.warn('TEST_API', 'Could not delete onboarding API keys:', dbError.message);
		}

		logger.debug('TEST_API', 'Onboarding state reset successfully');

		return json({
			success: true,
			message: 'Onboarding state reset successfully'
		});
	} catch (error) {
		logger.error('TEST_API', 'Failed to reset onboarding state:', error);
		return json(
			{
				error: 'Failed to reset onboarding state',
				details: error.message
			},
			{ status: 500 }
		);
	}
}
