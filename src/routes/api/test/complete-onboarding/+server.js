/**
 * Test API - Complete Onboarding
 *
 * This endpoint is ONLY available in test environments (NODE_ENV !== 'production')
 * It marks onboarding as complete without going through the full flow
 * Used by tests that need to test post-onboarding features (like login)
 *
 * POST /api/test/complete-onboarding - Mark onboarding as complete
 */

import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * POST /api/test/complete-onboarding
 * Mark onboarding as complete in the database
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
	logger.debug('TEST_API', 'Complete onboarding request received');

	try {
		const { database, settingsManager } = locals.services;

		// Create default user if it doesn't exist (required for foreign key constraints)
		const now = Date.now();
		await database.run(
			`INSERT OR IGNORE INTO auth_users (user_id, email, name, created_at, last_login)
			 VALUES (?, NULL, ?, ?, ?)`,
			['default', 'Default User', now, now]
		);

		// Mark onboarding as complete
		await settingsManager.updateSettings('system', {
			onboarding_complete: true
		});

		// Verify the setting was actually written to database
		const verifyStatus = await settingsManager.getSystemStatus();
		if (!verifyStatus.onboarding.isComplete) {
			logger.error('TEST_API', 'Failed to mark onboarding as complete - verification failed');
			throw new Error('Failed to mark onboarding as complete');
		}

		logger.debug('TEST_API', 'Onboarding marked as complete successfully');

		return json({
			success: true,
			message: 'Onboarding marked as complete'
		});
	} catch (error) {
		logger.error('TEST_API', 'Failed to complete onboarding:', error);
		return json(
			{
				error: 'Failed to complete onboarding',
				details: error.message
			},
			{ status: 500 }
		);
	}
}
