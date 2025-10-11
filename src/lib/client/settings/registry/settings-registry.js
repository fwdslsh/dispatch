/**
 * Settings Registry - Plugin-based settings section registration
 *
 * Provides a centralized registry for settings sections, allowing session
 * adapters and other plugins to register their settings without modifying
 * core settings files.
 */

const settingsSections = new Map();
const settingsCategories = new Map();

/**
 * Register a settings section
 * @param {Object} section - Section definition
 * @param {string} section.id - Unique section identifier
 * @param {string} section.label - Display label for navigation
 * @param {string} [section.category='core'] - Category for grouping ('core', 'auth', 'connectivity', 'sessions')
 * @param {Component} section.icon - Svelte icon component
 * @param {Component} section.component - Svelte settings component
 * @param {string} section.navAriaLabel - Accessibility label
 * @param {number} [section.order=100] - Display order (lower = earlier)
 */
export function registerSettingsSection(section) {
	if (!section?.id || !section?.component) {
		console.warn('[Settings Registry] Invalid section:', section);
		return;
	}

	const normalizedSection = {
		order: 100,
		category: 'core',
		...section
	};

	settingsSections.set(section.id, normalizedSection);

	// Group by category
	const category = normalizedSection.category;
	if (!settingsCategories.has(category)) {
		settingsCategories.set(category, []);
	}
	const categoryList = settingsCategories.get(category);

	// Remove existing entry if re-registering
	const existingIndex = categoryList.findIndex(s => s.id === section.id);
	if (existingIndex !== -1) {
		categoryList.splice(existingIndex, 1);
	}

	categoryList.push(normalizedSection);
}

/**
 * Get all registered settings sections, sorted by order
 */
export function getSettingsSections() {
	return Array.from(settingsSections.values())
		.sort((a, b) => (a.order || 100) - (b.order || 100));
}

/**
 * Get settings sections by category
 */
export function getSettingsByCategory(category) {
	return (settingsCategories.get(category) || [])
		.sort((a, b) => (a.order || 100) - (b.order || 100));
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
			const index = categoryList.findIndex(s => s.id === id);
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
