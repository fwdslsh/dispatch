import {
	createControllerRoute,
	createOptionsResponse
} from '$lib/server/shared/api/controllerFactory.js';
import {
	SettingsController,
	schemas as settingsSchemas
} from '$lib/server/shared/api/controllers/SettingsController.js';

export const GET = createControllerRoute(SettingsController, 'getSettings', {
	requireAuth: true,
	querySchema: settingsSchemas.listSettings.query,
	controllerOptions: { component: 'SETTINGS_API' }
});

export const OPTIONS = createOptionsResponse(['GET']);
