import { json } from '@sveltejs/kit';
import { SecurityPolicyManager } from '../../../../lib/server/shared/security/SecurityPolicyManager.js';
import { DatabaseManager } from '../../../../lib/server/shared/db/DatabaseManager.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, request }) {
	try {
		const dbManager = new DatabaseManager();
		await dbManager.init();
		const securityManager = new SecurityPolicyManager(dbManager);

		const context = securityManager.detectSecurityContext({
			hostname: url.hostname,
			protocol: url.protocol
		});

		// Get current security policies
		const corsConfig = await securityManager.getCORSConfiguration();
		const hstsConfig = await securityManager.getHSTSConfiguration();
		const helmetConfig = securityManager.getHelmetConfiguration({
			environment: process.env.NODE_ENV || 'development',
			...context
		});

		const cookieOptions = securityManager.getCookieOptions(context);
		const rateLimitConfig = securityManager.getRateLimitConfiguration('api', context);

		return json({
			success: true,
			policies: {
				cors: corsConfig,
				hsts: hstsConfig,
				helmet: helmetConfig,
				cookies: cookieOptions,
				rateLimit: rateLimitConfig,
				context
			}
		});

	} catch (error) {
		console.error('Error getting security policies:', error);
		return json({
			success: false,
			error: error.message
		}, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function PUT({ request, url }) {
	try {
		const { policy, config } = await request.json();

		const dbManager = new DatabaseManager();
		await dbManager.init();
		const securityManager = new SecurityPolicyManager(dbManager);

		switch (policy) {
			case 'cors':
				if (config.origins) {
					await securityManager.updateCORSOrigins(config.origins);
				}
				break;

			case 'certificate':
				if (config.context) {
					await securityManager.updateCertificateContext(config.context);
				}
				break;

			case 'tunnel':
				if (config.tunnelInfo) {
					await securityManager.updateTunnelOrigins(config.tunnelInfo);
				}
				break;

			default:
				return json({
					success: false,
					error: `Unknown policy type: ${policy}`
				}, { status: 400 });
		}

		return json({
			success: true,
			message: `${policy} policy updated successfully`
		});

	} catch (error) {
		console.error('Error updating security policy:', error);
		return json({
			success: false,
			error: error.message
		}, { status: 500 });
	}
}