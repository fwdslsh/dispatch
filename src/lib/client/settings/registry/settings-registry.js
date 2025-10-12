/**
 * Settings Registry - Plugin-based settings section registration
 *
 * Provides a centralized registry for settings sections, allowing session
 * adapters and other plugins to register their settings without modifying
 * core settings files.
 */

/** @typedef {import('svelte').Component} Component */

const settingsSections = new Map();
const settingsCategories = new Map();

/**
 * Settings section registration object
 * @typedef {Object} SettingsSection
 * @property {string} id - Unique section identifier
 * @property {string} label - Display label for navigation
 * @property {string} [category='core'] - Category for grouping ('core', 'auth', 'connectivity', 'sessions')
 * @property {Component} icon - Svelte icon component
 * @property {Component} component - Svelte settings component
 * @property {string} navAriaLabel - Accessibility label
 * @property {number} [order=100] - Display order (lower = earlier)
 */

/**
 * Register a settings section
 * @param {SettingsSection} section - Section definition
 */
export function registerSettingsSection(section) {
	if (!section?.id || !section?.component) {
		// Invalid section registration - skip silently in production
		return;
	}

	const normalizedSection = {
		order: 100,
		category: 'core',
		...section
	};

	// If re-registering, remove from old category first
	const existingSection = settingsSections.get(section.id);
	if (existingSection) {
		const oldCategoryList = settingsCategories.get(existingSection.category);
		if (oldCategoryList) {
			const oldIndex = oldCategoryList.findIndex((s) => s.id === section.id);
			if (oldIndex !== -1) {
				oldCategoryList.splice(oldIndex, 1);
			}
		}
	}

	settingsSections.set(section.id, normalizedSection);

	// Add to new category
	const category = normalizedSection.category;
	if (!settingsCategories.has(category)) {
		settingsCategories.set(category, []);
	}
	const categoryList = settingsCategories.get(category);
	categoryList.push(normalizedSection);
}

/**
 * Get all registered settings sections, sorted by order
 */
export function getSettingsSections() {
	return Array.from(settingsSections.values()).sort((a, b) => (a.order || 100) - (b.order || 100));
}

/**
 * Get settings sections by category
 */
export function getSettingsByCategory(category) {
	return (settingsCategories.get(category) || []).sort(
		(a, b) => (a.order || 100) - (b.order || 100)
	);
}

/**
 * Get all categories
 */
export function getCategories() {
	return Array.from(settingsCategories.keys());
}

/**
 * Unregister a section (useful for testing)
 */
export function unregisterSettingsSection(id) {
	const section = settingsSections.get(id);
	if (section) {
		settingsSections.delete(id);
		// Remove from category
		const categoryList = settingsCategories.get(section.category);
		if (categoryList) {
			const index = categoryList.findIndex((s) => s.id === id);
			if (index !== -1) categoryList.splice(index, 1);
		}
	}
}

/**
 * Clear all registrations (useful for testing)
 */
export function clearSettingsRegistry() {
	settingsSections.clear();
	settingsCategories.clear();
}
