import { createControllerRoute } from '$lib/server/shared/api/controllerFactory.js';
import {
	SettingsController,
	schemas as settingsSchemas
} from '$lib/server/shared/api/controllers/SettingsController.js';

export const GET = createControllerRoute(SettingsController, 'getWorkspaceEnvironment', {
	requireAuth: true,
	controllerOptions: { component: 'SETTINGS_WORKSPACE_API' }
});

export const POST = createControllerRoute(SettingsController, 'updateWorkspaceEnvironment', {
	requireAuth: true,
	bodySchema: settingsSchemas.workspaceEnv.body,
	controllerOptions: { component: 'SETTINGS_WORKSPACE_API' }
});

export const DELETE = createControllerRoute(SettingsController, 'clearWorkspaceEnvironment', {
	requireAuth: true,
	controllerOptions: { component: 'SETTINGS_WORKSPACE_API' }
});
