import {
	createControllerRoute,
	createOptionsResponse
} from '$lib/server/shared/api/controllerFactory.js';
import {
	SettingsController,
	schemas as settingsSchemas
} from '$lib/server/shared/api/controllers/SettingsController.js';

export const POST = createControllerRoute(SettingsController, 'completeOnboarding', {
	bodySchema: settingsSchemas.onboarding.body,
	controllerOptions: { component: 'ONBOARDING_API' },
	successStatus: 201
});

export const OPTIONS = createOptionsResponse(['POST']);
