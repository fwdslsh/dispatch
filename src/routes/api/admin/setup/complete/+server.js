/**
 * Complete onboarding process
 */

import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const body = await request.json();

		const settingsManager = globalThis.__API_SERVICES?.settingsManager;
		if (!settingsManager) {
			return json({ success: false, error: 'Settings service unavailable' }, { status: 503 });
		}

		// Mark onboarding as complete
		await settingsManager.set('system.onboarding.completed', true);
		await settingsManager.set('system.onboarding.completed_at', new Date().toISOString());

		// Initialize legacy system settings
		await settingsManager.set('system.legacy.terminal_key_disabled', false);

		// Set initial security policy
		await settingsManager.set('security.policies.initialized', true);
		await settingsManager.set('security.policies.last_review', new Date().toISOString());

		// Initialize audit logging settings
		await settingsManager.set('security.audit.enabled', true);
		await settingsManager.set('security.audit.retention_days', 90);

		// Log onboarding completion
		const authEventLogger = globalThis.__API_SERVICES?.authEventLogger;
		if (authEventLogger) {
			await authEventLogger.logEvent({
				userId: null,
				eventType: 'onboarding_completed',
				ipAddress: 'system',
				userAgent: 'onboarding',
				metadata: {
					completedAt: new Date().toISOString()
				}
			});
		}

		return json({
			success: true,
			message: 'Onboarding completed successfully',
			nextSteps: {
				loginUrl: '/admin/login',
				adminPanelUrl: '/admin',
				securityReviewUrl: '/admin/security'
			}
		});
	} catch (error) {
		console.error('Error completing onboarding:', error);
		return json(
			{
				success: false,
				error: 'Failed to complete onboarding'
			},
			{ status: 500 }
		);
	}
}
