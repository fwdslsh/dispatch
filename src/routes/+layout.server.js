/**
 * Root layout server load
 * Provides application settings to every page via `page.data`
 * @type {import('./$types').LayoutServerLoad}
 */
export async function load({ locals }) {
	const services = locals?.services;

	if (!services?.settingsRepository) {
		return {
			settings: {},
			settingsMeta: []
		};
	}

	try {
		const categories = await services.settingsRepository.getAll();

		const settings = {};
		const settingsMeta = [];

		for (const category of categories) {
			settings[category.category] = category.settings ?? {};
			settingsMeta.push({
				category: category.category,
				description: category.description,
				createdAt: category.createdAt,
				updatedAt: category.updatedAt
			});
		}

		return {
			settings,
			settingsMeta
		};
	} catch (error) {
		console.error('[layout.server] Failed to load application settings', error);
		return {
			settings: {},
			settingsMeta: []
		};
	}
}
