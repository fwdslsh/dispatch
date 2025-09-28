import { json } from '@sveltejs/kit';
import { validateKey } from '$lib/server/shared/auth.js';

/**
 * Onboarding API - Manages user onboarding state and progress
 * Following the progressive onboarding pattern from the specification
 */

export async function GET({ url, locals }) {
	try {
		const onboardingState = await locals.services.database.getOnboardingState();

		// Return current onboarding state with progress information
		return json({
			currentStep: onboardingState?.current_step || 'auth',
			completedSteps: onboardingState?.completed_steps || [],
			isComplete: onboardingState?.is_complete || false,
			progressPercentage: Math.round(((onboardingState?.completed_steps || []).length / 4) * 100)
		});
	} catch (error) {
		console.error('[Onboarding API] Failed to get onboarding state:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

export async function POST({ request, locals }) {
	try {
		const body = await request.json();
		const { action, step, data = {} } = body;

		if (action === 'updateProgress') {
			if (!step) {
				return json({ error: 'Missing step parameter' }, { status: 400 });
			}

			// Validate step progression
			const validSteps = ['auth', 'workspace', 'settings', 'complete'];
			if (!validSteps.includes(step)) {
				return json({ error: 'Invalid step' }, { status: 400 });
			}

			// Get current state
			const currentState = await locals.services.database.getOnboardingState();
			const completedSteps = currentState?.completedSteps || [];

			// Add step to completed if not already there
			if (!completedSteps.includes(step)) {
				completedSteps.push(step);
			}

			// Update onboarding state
			await locals.services.database.updateOnboardingState({
				currentStep: step,
				completedSteps,
				stepData: data
			});

			return json({
				success: true,
				currentStep: step,
				completedSteps,
				progressPercentage: Math.round((completedSteps.length / 4) * 100)
			});
		}

		if (action === 'complete') {
			const { workspaceId } = body;

			// Mark onboarding as complete
			await locals.services.database.updateOnboardingState({
				currentStep: 'complete',
				completedSteps: ['auth', 'workspace', 'settings', 'complete'],
				isComplete: true,
				workspaceId
			});

			return json({
				success: true,
				currentStep: 'complete',
				isComplete: true,
				progressPercentage: 100
			});
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		console.error('[Onboarding API] Failed to update onboarding state:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
