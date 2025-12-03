import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';
import {
	UnauthorizedError,
	BadRequestError,
	NotFoundError,
	handleApiError
} from '$lib/server/shared/utils/api-errors.js';

/**
 * API Key Detail Endpoints
 * Handles updating and deleting individual API keys
 */

/**
 * DELETE /api/auth/keys/[keyId]
 * Delete an API key permanently
 */
/** @type {import('./$types').RequestHandler} */
export async function DELETE({ params, locals }) {
	try {
		const services = locals.services;
		const userId = locals.auth?.userId || 'default';
		const { keyId } = params;

		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required');
		}

		// Delete the API key
		const deleted = await services.apiKeyManager.deleteKey(keyId, userId);

		if (!deleted) {
			logger.warn(
				'API_KEYS',
				`Failed to delete key ${keyId}: not found or not owned by user ${userId}`
			);
			throw new NotFoundError('API key not found');
		}

		logger.info('API_KEYS', `Deleted API key ${keyId} for user ${userId}`);

		return json({ success: true });
	} catch (err) {
		handleApiError(err, 'DELETE /api/auth/keys/[keyId]');
	}
}

/**
 * PATCH /api/auth/keys/[keyId]
 * Update API key status (enable/disable)
 */
/** @type {import('./$types').RequestHandler} */
export async function PATCH({ params, request, locals }) {
	try {
		const services = locals.services;
		const userId = locals.auth?.userId || 'default';
		const { keyId } = params;

		if (!locals.auth?.authenticated) {
			throw new UnauthorizedError('Authentication required');
		}

		// Parse request body
		const body = await request.json();
		const { disabled } = body;

		if (typeof disabled !== 'boolean') {
			throw new BadRequestError('Invalid disabled value (must be boolean)', 'INVALID_DISABLED');
		}

		// Update key status
		const updated = disabled
			? await services.apiKeyManager.disableKey(keyId, userId)
			: await services.apiKeyManager.enableKey(keyId, userId);

		if (!updated) {
			logger.warn(
				'API_KEYS',
				`Failed to update key ${keyId}: not found or not owned by user ${userId}`
			);
			throw new NotFoundError('API key not found');
		}

		logger.info('API_KEYS', `Updated API key ${keyId} for user ${userId} (disabled=${disabled})`);

		return json({ success: true });
	} catch (err) {
		handleApiError(err, 'PATCH /api/auth/keys/[keyId]');
	}
}
