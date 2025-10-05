import {
	createControllerRoute,
	createOptionsResponse
} from '$lib/server/shared/api/controllerFactory.js';
import {
	SettingsController,
	schemas as settingsSchemas
} from '$lib/server/shared/api/controllers/SettingsController.js';

export const PUT = createControllerRoute(SettingsController, 'updateCategory', {
	requireAuth: true,
	paramsSchema: settingsSchemas.updateCategory.params,
	bodySchema: settingsSchemas.updateCategory.body,
	controllerOptions: { component: 'SETTINGS_CATEGORY_API' }
});

export const OPTIONS = createOptionsResponse(['PUT']);
