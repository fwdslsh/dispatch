/**
 * Settings Page State Management
 *
 * Provides state management utilities for the settings page.
 * Settings sections are registered via the settings registry system.
 */

// Initialize settings registry
// IMPORTANT: Import session modules FIRST to ensure they register their settings sections
import '$lib/client/shared/session-modules/index.js';
import { registerCoreSettings } from './registry/core-sections.js';
import { getSettingsSections as getRegisteredSections } from './registry/settings-registry.js';

// Register core settings on module load (after session modules have been imported)
registerCoreSettings();

// Section label lookup for error messages (built dynamically from registry)
let SECTION_LABEL_LOOKUP = null;

function getSectionLabelLookup() {
	if (!SECTION_LABEL_LOOKUP) {
		const sections = getRegisteredSections();
		SECTION_LABEL_LOOKUP = new Map(sections.map((section) => [section.id, section.label]));
	}
	return SECTION_LABEL_LOOKUP;
}

export function getSettingsSections() {
	return getRegisteredSections();
}

export function createSettingsPageState(options = {}) {
	const sections = getSettingsSections();
	const defaultSectionId = sections[0]?.id ?? null;
	const initialSectionId = sections.some((section) => section.id === options.initialSection)
		? options.initialSection
		: defaultSectionId;

	return {
		sections,
		activeSection: initialSectionId,
		savedMessage: null,
		error: null
	};
}

export function setActiveSection(state, sectionId) {
	if (!state || !Array.isArray(state.sections)) return state?.activeSection ?? null;
	const exists = state.sections.some((section) => section.id === sectionId);
	if (!exists) {
		return state.activeSection;
	}
	state.activeSection = sectionId;
	state.savedMessage = null;
	state.error = null;
	return state.activeSection;
}

export function recordSaveMessage(state, message) {
	if (!state) return message;
	state.savedMessage = message;
	state.error = null;
	return message;
}

export function recordError(state, message) {
	if (!state) return message;
	state.error = message;
	state.savedMessage = null;
	return message;
}

export function translateSettingsError(error) {
	if (!error) {
		return 'An unexpected settings error occurred. Please try again.';
	}

	if (typeof error === 'string') {
		return error;
	}

	const lookup = getSectionLabelLookup();
	const sectionLabel = error.sectionId ? lookup.get(error.sectionId) : null;

	switch (error.type) {
		case 'component-load':
			return `We couldn't load the ${sectionLabel ?? error.sectionId ?? 'requested'} section. Try refreshing the page or checking your connection.`;
		case 'missing-preferences':
			return 'Unable to load user preferences. Try resetting to defaults or restoring from a backup.';
		case 'section-not-found':
			return `The ${error.sectionId} section is not available. Contact support if you need help restoring it.`;
		default:
			return error.message ?? 'An unexpected settings error occurred. Please try again.';
	}
}
