import { createControllerRoute } from '$lib/server/shared/api/controllerFactory.js';
import {
	PreferencesController,
	schemas as preferenceSchemas
} from '$lib/server/shared/api/controllers/PreferencesController.js';

export const GET = createControllerRoute(PreferencesController, 'getPreferences', {
	querySchema: preferenceSchemas.list.query,
	controllerOptions: { component: 'PREFERENCES_API' }
});

export const PUT = createControllerRoute(PreferencesController, 'updatePreferences', {
	requireAuth: true,
	bodySchema: preferenceSchemas.update.body,
	controllerOptions: { component: 'PREFERENCES_API' }
});

export const POST = createControllerRoute(PreferencesController, 'executeAction', {
	requireAuth: true,
	bodySchema: preferenceSchemas.action.body,
	controllerOptions: { component: 'PREFERENCES_API' }
});
