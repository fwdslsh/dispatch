/**
 * Onboarding Settings API Endpoint
 * Manages onboarding state as a settings category in the settings table
 * GET /api/settings/onboarding - Get onboarding state
 * PUT /api/settings/onboarding - Update onboarding state
 */

import { json } from '@sveltejs/kit';

/**
 * GET /api/settings/onboarding
 * Retrieve current onboarding state
 *
 * Note: GET does not require authentication to allow initial onboarding checks
 */
export async function GET({ locals }) {
	try {
		// GET does not require authentication for initial onboarding

		// Get onboarding settings from database
		const onboardingSettings = await locals.services.database.getSettingsByCategory('onboarding');

		// Return defaults if not found
		if (!onboardingSettings || Object.keys(onboardingSettings).length === 0) {
			return json({
				currentStep: 'auth',
				completedSteps: [],
				isComplete: false,
				firstWorkspaceId: null
			});
		}

		return json(onboardingSettings, {
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				Pragma: 'no-cache',
				Expires: '0'
			}
		});
	} catch (error) {
		console.error('[Onboarding Settings API] Failed to get onboarding state:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * PUT /api/settings/onboarding
 * Update onboarding state
 */
export async function POST({ request, locals }) {
	try {
		// Get onboarding settings from database
		const onboardingSettings = await locals.services.database.getSettingsByCategory('onboarding');

		// See if onboarding already completed
		if (onboardingSettings && Object.keys(onboardingSettings).length > 0) {
			return json({ error: 'Onboarding already completed' }, { status: 401 });
		}

		const body = await request.json();

		// Build onboarding state from request
		const onboardingState = {
			currentStep: body.currentStep || 'auth',
			completedSteps: body.completedSteps || [],
			isComplete: body.isComplete || false,
			firstWorkspaceId: body.firstWorkspaceId || null
		};

		// Include step data if provided
		if (body.stepData) {
			onboardingState.stepData = body.stepData;
		}

		// Save to database
		await locals.services.database.setSettingsForCategory(
			'onboarding',
			onboardingState,
			'User onboarding state and progress'
		);

		return json(
			{
				success: true,
				...onboardingState
			},
			{
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate'
				}
			}
		);
	} catch (error) {
		console.error('[Onboarding Settings API] Failed to update onboarding state:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * PUT /api/settings/onboarding
 * Update onboarding state and handle special actions like storing terminal key
 *
 * Authentication: Not required - this is a public endpoint for initial setup
 */
export async function PUT({ request, url, locals }) {
	try {
		const body = await request.json();

		// Handle terminal key storage during auth step
		if (body.stepData?.terminalKey) {
			const terminalKey = body.stepData.terminalKey;

			// Validate terminal key
			if (typeof terminalKey !== 'string' || terminalKey.length < 8) {
				return json(
					{ error: 'Terminal key must be at least 8 characters long' },
					{ status: 400 }
				);
			}

			// Store terminal key in authentication settings
			const currentAuthSettings = await locals.services.database.getSettingsByCategory('authentication');
			const updatedAuthSettings = {
				...currentAuthSettings,
				terminal_key: terminalKey
			};

			await locals.services.database.setSettingsForCategory(
				'authentication',
				updatedAuthSettings,
				'Authentication settings'
			);

			// Update the cached terminal key for immediate use
			locals.services.auth.updateCachedKey(terminalKey);

			console.log('[Onboarding] Terminal key stored in authentication settings');
		}

		// Build onboarding state from request
		const onboardingState = {
			currentStep: body.currentStep || 'auth',
			completedSteps: body.completedSteps || [],
			isComplete: body.isComplete || false,
			firstWorkspaceId: body.firstWorkspaceId || null
		};

		// Include step data if provided (but don't store sensitive data)
		if (body.stepData) {
			// Remove sensitive data before storing
			const { terminalKey, ...safeStepData } = body.stepData;
			if (Object.keys(safeStepData).length > 0) {
				onboardingState.stepData = safeStepData;
			}
		}

		// Determine next step based on current step
		const stepOrder = ['auth', 'workspace', 'settings', 'complete'];
		const currentIndex = stepOrder.indexOf(body.currentStep);
		if (currentIndex >= 0 && currentIndex < stepOrder.length - 1) {
			onboardingState.currentStep = stepOrder[currentIndex + 1];
		}

		// Mark as complete if we've reached the complete step
		if (onboardingState.currentStep === 'complete') {
			onboardingState.isComplete = true;
			// Ensure all steps are in completedSteps
			onboardingState.completedSteps = ['auth', 'workspace', 'settings', 'complete'];
		}

		// Save onboarding state to database
		await locals.services.database.setSettingsForCategory(
			'onboarding',
			onboardingState,
			'User onboarding state and progress'
		);

		return json(
			{
				success: true,
				...onboardingState
			},
			{
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate'
				}
			}
		);
	} catch (error) {
		console.error('[Onboarding Settings API] Failed to update onboarding state:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * OPTIONS /api/settings/onboarding
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
}