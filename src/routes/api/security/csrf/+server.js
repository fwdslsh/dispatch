import { json } from '@sveltejs/kit';
import { SecurityPolicyManager } from '../../../../lib/server/shared/security/SecurityPolicyManager.js';
import { DatabaseManager } from '../../../../lib/server/shared/db/DatabaseManager.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, cookies }) {
	try {
		const dbManager = new DatabaseManager();
		await dbManager.init();
		const securityManager = new SecurityPolicyManager(dbManager);

		// Get or create session ID from cookies
		let sessionId = cookies.get('session_id');
		if (!sessionId) {
			sessionId = crypto.randomUUID();
			cookies.set('session_id', sessionId, {
				path: '/',
				httpOnly: true,
				secure: request.url.startsWith('https:'),
				sameSite: 'strict',
				maxAge: 60 * 60 * 24 // 24 hours
			});
		}

		// Generate CSRF token
		const token = securityManager.generateCSRFToken();
		securityManager.storeCSRFToken(sessionId, token);

		return json({
			success: true,
			token,
			sessionId
		});

	} catch (error) {
		console.error('Error generating CSRF token:', error);
		return json({
			success: false,
			error: error.message
		}, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies }) {
	try {
		const { token } = await request.json();
		const sessionId = cookies.get('session_id');

		if (!sessionId) {
			return json({
				success: false,
				error: 'No session found'
			}, { status: 401 });
		}

		const dbManager = new DatabaseManager();
		await dbManager.init();
		const securityManager = new SecurityPolicyManager(dbManager);

		const isValid = securityManager.validateCSRFToken(sessionId, token);

		return json({
			success: true,
			valid: isValid
		});

	} catch (error) {
		console.error('Error validating CSRF token:', error);
		return json({
			success: false,
			error: error.message
		}, { status: 500 });
	}
}