import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * API Key Management Endpoints
 * Handles listing and creating API keys
 */

/**
 * GET /api/auth/keys
 * List all API keys for authenticated user
 */
/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	const services = locals.services;
	const userId = locals.auth?.userId || 'default';

	if (!locals.auth?.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Get all API keys for user
	const keys = await services.apiKeyManager.listKeys(userId);

	logger.debug('API_KEYS', `Listed ${keys.length} API keys for user ${userId}`);

	return json({ keys });
}

/**
 * POST /api/auth/keys
 * Create a new API key
 */
/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	const services = locals.services;
	const userId = locals.auth?.userId || 'default';

	if (!locals.auth?.authenticated) {
		return json({ error: 'Authentication required' }, { status: 401 });
	}

	// Validate CSRF for cookie-based requests
	const origin = request.headers.get('origin');
	const host = request.headers.get('host');

	// Skip CSRF check for API key auth (header-based), enforce for cookie auth
	if (locals.auth.provider !== 'api_key') {
		if (!origin || new URL(origin).host !== host) {
			logger.warn('API_KEYS', `CSRF check failed: origin=${origin}, host=${host}`);
			return json({ error: 'Invalid request origin' }, { status: 403 });
		}
	}

	// Parse request body
	const body = await request.json();
	const { label } = body;

	if (!label || typeof label !== 'string' || label.trim().length === 0) {
		return json({ error: 'Label is required' }, { status: 400 });
	}

	// Generate new API key
	const apiKey = await services.apiKeyManager.generateKey(userId, label);

	logger.info(
		'API_KEYS',
		`Generated new API key ${apiKey.id} for user ${userId} (label: ${label})`
	);

	return json({
		id: apiKey.id,
		key: apiKey.key,
		label: apiKey.label,
		message: 'API key created successfully. Save this key - it will not be shown again.'
	});
}
