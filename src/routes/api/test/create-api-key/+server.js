/**
 * Test API - Create API Key
 *
 * This endpoint is ONLY available in test environments (NODE_ENV !== 'production')
 * It creates an API key with a specific value for testing authentication
 *
 * POST /api/test/create-api-key - Create a test API key
 */

import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * POST /api/test/create-api-key
 * Create an API key with a specific value for testing
 *
 * Body: { key: string, label?: string }
 *
 * Only available in non-production environments for testing
 * No authentication required - this is a test-only endpoint
 */
export async function POST({ request, locals }) {
	// Security: Only allow in test/development environments
	if (process.env.NODE_ENV === 'production') {
		return json({ error: 'Not available in production' }, { status: 403 });
	}

	try {
		const body = await request.json();
		const { key, label = 'Test API Key' } = body;

		if (!key || typeof key !== 'string') {
			return json({ error: 'Key is required' }, { status: 400 });
		}

		const { apiKeyManager } = locals.services;

		// First, ensure a default user exists
		const db = apiKeyManager.db;
		let user = await db.get('SELECT user_id FROM auth_users WHERE user_id = ?', ['default']);

		if (!user) {
			// Create default user if it doesn't exist
			const now = Date.now();
			await db.run(
				`INSERT INTO auth_users (user_id, email, name, created_at, last_login) VALUES (?, ?, ?, ?, ?)`,
				['default', 'test@dispatch.test', 'Test User', now, now]
			);
			user = { user_id: 'default' };
		}

		// Create the API key with the specified value
		// For testing, we need to directly insert the hashed key
		const bcrypt = await import('bcrypt');
		const hashedKey = await bcrypt.hash(key, 12);

		// Generate a unique ID for the API key
		const crypto = await import('crypto');
		const keyId = crypto.randomUUID();

		const now = Date.now();
		const result = await db.run(
			`INSERT INTO auth_api_keys (id, user_id, key_hash, label, created_at, last_used_at, disabled)
			 VALUES (?, ?, ?, ?, ?, NULL, 0)`,
			[keyId, user.user_id, hashedKey, label, now]
		);

		logger.debug('TEST_API', `Test API key created: ${label} for user ${user.user_id}`);

		return json({
			success: true,
			message: 'API key created',
			id: keyId
		});
	} catch (error) {
		logger.error('TEST_API', 'Failed to create test API key:', error);
		return json(
			{
				error: 'Failed to create API key',
				details: error.message
			},
			{ status: 500 }
		);
	}
}
