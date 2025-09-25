import { json } from '@sveltejs/kit';
import { AuthManager } from '$lib/server/shared/auth/AuthManager.js';
import { DatabaseManager } from '$lib/server/shared/db/DatabaseManager.js';
import { logger } from '$lib/server/shared/utils/logger.js';

/**
 * Local authentication API endpoint
 * POST /api/auth/local - Authenticate with access code
 */

export async function POST({ request, cookies, url }) {
	try {
		const db = new DatabaseManager();
		await db.init();

		const authManager = new AuthManager(db);
		const body = await request.json();
		const { accessCode, returnTo = '/' } = body;

		// Validate input
		if (!accessCode) {
			return json({
				success: false,
				error: 'Access code is required'
			}, { status: 400 });
		}

		// Check if local authentication is enabled
		const settings = await db.settings.getByCategory('auth');
		const localEnabled = settings.find(s => s.key === 'local_enabled')?.value === 'true';

		if (!localEnabled) {
			return json({
				success: false,
				error: 'Local authentication is not enabled'
			}, { status: 403 });
		}

		// Get client IP for rate limiting
		const clientIp = request.headers.get('x-forwarded-for') ||
			request.headers.get('x-real-ip') ||
			'unknown';

		// Authenticate using local adapter
		const authResult = await authManager.authenticate('local', {
			accessCode,
			clientIp,
			userAgent: request.headers.get('user-agent') || 'unknown'
		});

		if (!authResult.success) {
			logger.warn('AUTH', `Local auth failed for IP ${clientIp}: ${authResult.error}`);
			return json({
				success: false,
				error: authResult.error || 'Authentication failed'
			}, { status: 401 });
		}

		// Set authentication session cookie
		if (authResult.token) {
			cookies.set('auth-token', authResult.token, {
				httpOnly: true,
				secure: url.protocol === 'https:',
				sameSite: 'strict',
				path: '/',
				maxAge: 60 * 60 * 24 // 24 hours
			});
		}

		logger.info('AUTH', `Local authentication successful for user ${authResult.user.id}`);

		return json({
			success: true,
			user: {
				id: authResult.user.id,
				email: authResult.user.email,
				name: authResult.user.name
			},
			authMethod: 'local',
			token: authResult.token,
			returnTo
		});

	} catch (error) {
		logger.error('AUTH', `Local authentication error: ${error.message}`);
		return json({
			success: false,
			error: 'Authentication service error'
		}, { status: 500 });
	}
}