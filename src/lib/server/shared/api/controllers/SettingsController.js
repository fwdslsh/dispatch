import { BaseController } from '../BaseController.js';
import { string, object } from '../validation.js';
import { logger } from '../../utils/logger.js';

const CATEGORY_PARAM_SCHEMA = {
	category: string({ trim: true })
};

const SETTINGS_UPDATE_SCHEMA = {
	settings: object({}, { required: true })
};

const WORKSPACE_ENV_SCHEMA = {
	envVariables: object({}, { required: true })
};

const ONBOARDING_SCHEMA = {
	terminalKey: string({ minLength: 8, trim: true }),
	workspaceName: string({ required: false, trim: true }),
	workspacePath: string({ required: false, trim: true }),
	preferences: object({}, { required: false })
};

function isValidEnvName(name) {
	return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function isValidWorkspacePath(path) {
	if (!path || typeof path !== 'string') return false;
	if (path.includes('..') || path.includes('~')) return false;
	if (!path.startsWith('/')) return false;
	if (path.length > 500) return false;
	return true;
}

function deriveWorkspaceName(path) {
	const segments = path.split('/').filter(Boolean);
	return segments[segments.length - 1] || 'Root';
}

export class SettingsController extends BaseController {
	constructor(event, options = {}) {
		super(event, { component: options.component || 'SETTINGS_API' });
	}

	async getSettings({ query, services }) {
		const database = services.database;
		if (!database?.settings) {
			throw new Error('Settings repository unavailable');
		}

		if (query?.category) {
			const categorySettings = await database.settings.getCategorySettings(query.category);
			return { [query.category]: categorySettings || {} };
		}

		const records = await database.settings.getAll();
		const result = {};
		for (const record of records) {
			result[record.category] = record.settings;
		}
		return result;
	}

	async updateCategory({ params, body, services, locals }) {
		const database = services.database;
		if (!database?.settings) {
			throw new Error('Settings repository unavailable');
		}

		const currentSettings = await database.settings.getCategorySettings(params.category);
		const updatedSettings = {
			...currentSettings,
			...body.settings
		};

		await database.settings.setCategory(
			params.category,
			updatedSettings,
			`Settings for ${params.category} category`
		);

		if (params.category === 'authentication' && body.settings.terminal_key !== undefined) {
			locals.services?.auth?.updateCachedKey?.(body.settings.terminal_key);
		}

		return {
			success: true,
			category: params.category,
			settings: updatedSettings,
			updated_count: Object.keys(body.settings).length
		};
	}

	async getWorkspaceEnvironment({ services }) {
		const workspaceSettings = await services.database.settings.getCategorySettings('workspace');
		return { envVariables: workspaceSettings?.envVariables || {} };
	}

	async updateWorkspaceEnvironment({ body, services }) {
		const envVariables = body.envVariables || {};

		for (const [key, value] of Object.entries(envVariables)) {
			if (!isValidEnvName(key)) {
				return this.fail(400, `Invalid environment variable name: ${key}`);
			}
			if (typeof value !== 'string') {
				return this.fail(400, `Environment variable values must be strings: ${key}`);
			}
		}

		const currentSettings = await services.database.settings.getCategorySettings('workspace');
		const updatedSettings = {
			...currentSettings,
			envVariables
		};

		await services.database.settings.setCategory(
			'workspace',
			updatedSettings,
			'Workspace-level environment variables for all sessions'
		);

		return { success: true, envVariables };
	}

	async clearWorkspaceEnvironment({ services }) {
		const currentSettings = await services.database.settings.getCategorySettings('workspace');
		const updatedSettings = {
			...currentSettings,
			envVariables: {}
		};

		await services.database.settings.setCategory(
			'workspace',
			updatedSettings,
			'Workspace-level environment variables for all sessions'
		);

		return { success: true, envVariables: {} };
	}

	async completeOnboarding({ body, services, locals }) {
		const database = services.database;
		await database.init();

		const onboardingState = await database.settings.getCategorySettings('onboarding');
		if (onboardingState?.isComplete) {
			logger.warn(this.component, 'Attempt to complete onboarding when already complete');
			return this.fail(409, 'Onboarding has already been completed');
		}

		const { terminalKey, workspaceName, workspacePath, preferences } = body;

		if ((workspaceName && !workspacePath) || (!workspaceName && workspacePath)) {
			return this.fail(400, 'Both workspaceName and workspacePath must be provided together');
		}

		if (workspacePath && !isValidWorkspacePath(workspacePath)) {
			return this.fail(400, 'Invalid workspace path format');
		}

		let workspaceId = null;

		try {
			await database.settings.setCategory(
				'authentication',
				{ terminal_key: terminalKey },
				'Authentication settings configured during onboarding'
			);

			locals.services?.auth?.updateCachedKey?.(terminalKey);

			if (workspaceName && workspacePath) {
				const existingWorkspace = await database.get('SELECT path FROM workspaces WHERE path = ?', [
					workspacePath
				]);

				if (existingWorkspace) {
					return this.fail(409, 'Workspace already exists at this path');
				}

				const displayName = workspaceName.trim() || deriveWorkspaceName(workspacePath);
				await database.createWorkspace(workspacePath, displayName);
				workspaceId = workspacePath;
			}

			if (preferences && typeof preferences === 'object') {
				for (const [category, prefs] of Object.entries(preferences)) {
					if (prefs && typeof prefs === 'object') {
						await database.users.updatePreferences(category, prefs);
					}
				}
			}

			const completionTimestamp = new Date().toISOString();
			await database.settings.setCategory(
				'onboarding',
				{
					isComplete: true,
					completedAt: completionTimestamp,
					firstWorkspaceId: workspaceId
				},
				'Onboarding completed successfully'
			);

			return {
				success: true,
				onboarding: {
					isComplete: true,
					completedAt: completionTimestamp,
					firstWorkspaceId: workspaceId
				},
				workspace: workspaceId
					? {
							id: workspaceId,
							name: workspaceName,
							path: workspacePath
						}
					: null
			};
		} catch (error) {
			logger.error(this.component, 'Onboarding operation failed:', error);

			try {
				await database.run('DELETE FROM settings WHERE category IN (?, ?)', [
					'authentication',
					'onboarding'
				]);

				if (workspaceId) {
					await database.run('DELETE FROM workspaces WHERE path = ?', [workspaceId]);
				}
			} catch (rollbackError) {
				logger.error(this.component, 'Onboarding rollback failed:', rollbackError);
			}

			if (error?.code === 'SQLITE_CONSTRAINT') {
				return this.fail(409, 'Database constraint violation');
			}

			throw error;
		}
	}
}

export const schemas = {
	listSettings: {
		query: {
			category: string({ required: false, trim: true })
		}
	},
	updateCategory: {
		params: CATEGORY_PARAM_SCHEMA,
		body: SETTINGS_UPDATE_SCHEMA
	},
	workspaceEnv: {
		body: WORKSPACE_ENV_SCHEMA
	},
	onboarding: {
		body: ONBOARDING_SCHEMA
	}
};
