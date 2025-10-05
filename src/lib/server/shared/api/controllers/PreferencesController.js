import { BaseController } from '../BaseController.js';
import { string, object } from '../validation.js';

const VALID_CATEGORIES = ['ui', 'auth', 'workspace', 'terminal', 'maintenance', 'themes'];

const CATEGORY_QUERY_SCHEMA = {
	category: string({ required: false, trim: true })
};

const UPDATE_SCHEMA = {
	category: string({ trim: true }),
	preferences: object({}, { required: true })
};

const ACTION_SCHEMA = {
	action: string({ trim: true }),
	category: string({ required: false, trim: true }),
	preferences: object({}, { required: false })
};

function validateCategory(category) {
	return VALID_CATEGORIES.includes(category);
}

function getDefaultPreferences(category) {
	const defaults = {
		ui: {
			theme: 'auto',
			showWorkspaceInTitle: true,
			autoHideInactiveTabsMinutes: 0
		},
		auth: {
			sessionDuration: 30,
			rememberLastWorkspace: true
		},
		workspace: {
			defaultPath: '',
			autoCreateMissingDirectories: true
		},
		terminal: {
			fontSize: 14,
			fontFamily: 'Monaco, monospace',
			scrollback: 1000
		},
		maintenance: {
			sessionRetentionDays: 30,
			logRetentionDays: 7,
			autoCleanupEnabled: true
		},
		themes: {}
	};

	return defaults[category] || {};
}

export class PreferencesController extends BaseController {
	constructor(event, options = {}) {
		super(event, { component: options.component || 'PREFERENCES_API' });
	}

	async getPreferences({ query, services }) {
		const database = services.database;
		if (query?.category) {
			const preferences = await database.users.getPreferences(query.category);
			return preferences || {};
		}

		return await database.users.getAllPreferences();
	}

	async updatePreferences({ body, services }) {
		const { category, preferences } = body;

		if (!validateCategory(category)) {
			return this.fail(400, 'Invalid preference category');
		}

		if (category === 'auth') {
			const duration = preferences.sessionDuration;
			if (
				duration !== undefined &&
				(!Number.isInteger(duration) || duration < 1 || duration > 365)
			) {
				return this.fail(400, 'Session duration must be between 1 and 365 days');
			}
		}

		if (category === 'ui') {
			if (
				preferences.theme !== undefined &&
				!['light', 'dark', 'auto'].includes(preferences.theme)
			) {
				return this.fail(400, 'Theme must be light, dark, or auto');
			}
		}

		if (category === 'maintenance') {
			const retention = preferences.sessionRetentionDays;
			if (
				retention !== undefined &&
				(!Number.isInteger(retention) || retention < 1 || retention > 365)
			) {
				return this.fail(400, 'Session retention days must be between 1 and 365');
			}

			const logRetention = preferences.logRetentionDays;
			if (
				logRetention !== undefined &&
				(!Number.isInteger(logRetention) || logRetention < 1 || logRetention > 90)
			) {
				return this.fail(400, 'Log retention days must be between 1 and 90');
			}
		}

		const updated = await services.database.users.updatePreferences(category, preferences);
		return {
			success: true,
			category,
			preferences: updated
		};
	}

	async executeAction({ body, services }) {
		const { action } = body;

		if (action === 'reset') {
			if (!body.category) {
				return this.fail(400, 'Missing category parameter for reset action');
			}

			if (!validateCategory(body.category)) {
				return this.fail(400, 'Invalid preference category');
			}

			const defaults = getDefaultPreferences(body.category);
			const result = await services.database.users.updatePreferences(body.category, defaults);
			return {
				success: true,
				category: body.category,
				preferences: result
			};
		}

		if (action === 'export') {
			const allPreferences = await services.database.users.getAllPreferences();
			return {
				success: true,
				preferences: allPreferences,
				exportedAt: new Date().toISOString()
			};
		}

		if (action === 'import') {
			if (!body.preferences || typeof body.preferences !== 'object') {
				return this.fail(400, 'Missing or invalid preferences object for import');
			}

			const results = {};
			for (const [category, prefs] of Object.entries(body.preferences)) {
				try {
					if (!validateCategory(category)) {
						results[category] = { error: 'Invalid preference category' };
						continue;
					}

					if (!prefs || typeof prefs !== 'object') {
						results[category] = { error: 'Invalid preferences object' };
						continue;
					}

					results[category] = await services.database.users.updatePreferences(category, prefs);
				} catch (error) {
					results[category] = { error: error.message };
				}
			}

			return {
				success: true,
				importResults: results
			};
		}

		return this.fail(400, 'Invalid action');
	}
}

export const schemas = {
	list: {
		query: CATEGORY_QUERY_SCHEMA
	},
	update: {
		body: UPDATE_SCHEMA
	},
	action: {
		body: ACTION_SCHEMA
	}
};
