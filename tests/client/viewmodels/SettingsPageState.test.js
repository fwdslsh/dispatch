import { describe, it, expect, beforeEach } from 'vitest';

import {
	getSettingsSections,
	createSettingsPageState,
	setActiveSection,
	recordSaveMessage,
	recordError,
	translateSettingsError
} from '$lib/client/settings/pageState.js';

describe('Settings Page State Helpers', () => {
	let state;

	beforeEach(() => {
		state = createSettingsPageState();
	});

	it('returns all expected sections with unique ids and accessible labels', () => {
		const sections = getSettingsSections();
		expect(sections.length).toBeGreaterThan(0);

		const ids = sections.map((section) => section.id);
		expect(new Set(ids).size).toBe(ids.length);

		// Updated to match the actual registry-based implementation
		// Sections are ordered by their 'order' property:
		// - themes (10), home (20), workspace-env (30), keys (40),
		//   authentication (50), tunnels (60), ai (70), data-management (90)
		const expectedOrder = [
			'themes',
			'home',
			'workspace-env',
			'keys',
			'authentication',
			'tunnels',
			'ai',
			'data-management'
		];

		expect(ids).toEqual(expectedOrder);

		for (const section of sections) {
			expect(section.label).toMatch(/^[A-Z]/);
			// Ensure navAriaLabel exists and is a non-empty string
			expect(section.navAriaLabel).toBeTruthy();
			expect(typeof section.navAriaLabel).toBe('string');
			expect(section.navAriaLabel.length).toBeGreaterThan(0);
			expect(section.component).toBeTruthy();
			expect(section.icon).toBeTruthy();
		}
	});

	it('creates state with default active section when initial section is missing', () => {
		const customState = createSettingsPageState({ initialSection: 'unknown-section' });
		// Default section is now 'themes' (first in the registry order)
		expect(customState.activeSection).toBe('themes');
		expect(customState.savedMessage).toBeNull();
		expect(customState.error).toBeNull();
	});

	it('sets active section and clears messaging state', () => {
		recordSaveMessage(state, 'Saved!');
		recordError(state, 'Should be cleared');

		// Use a valid section ID from the actual registry
		setActiveSection(state, 'data-management');

		expect(state.activeSection).toBe('data-management');
		expect(state.savedMessage).toBeNull();
		expect(state.error).toBeNull();
	});

	it('ignores unknown section ids when switching', () => {
		const initialActive = state.activeSection;
		setActiveSection(state, 'does-not-exist');
		expect(state.activeSection).toBe(initialActive);
	});

	it('records save messages and clears errors', () => {
		recordError(state, 'previous error');
		const message = recordSaveMessage(state, 'Settings saved successfully');

		expect(message).toBe('Settings saved successfully');
		expect(state.savedMessage).toBe('Settings saved successfully');
		expect(state.error).toBeNull();
	});

	it('records errors and clears saved message', () => {
		recordSaveMessage(state, 'previous message');
		const error = recordError(state, 'Failed to load settings');

		expect(error).toBe('Failed to load settings');
		expect(state.error).toBe('Failed to load settings');
		expect(state.savedMessage).toBeNull();
	});

	it('translates component load errors into actionable guidance', () => {
		// Use 'ai' section ID to match new architecture
		const message = translateSettingsError({ type: 'component-load', sectionId: 'ai' });
		expect(message.toLowerCase()).toContain('ai');
		expect(message).toContain('refresh');
	});

	it('translates missing preferences into recovery guidance', () => {
		const message = translateSettingsError({ type: 'missing-preferences' });
		expect(message).toContain('preferences');
		expect(message).toContain('reset');
	});

	it('translates unknown section errors with fallback message', () => {
		const message = translateSettingsError({ type: 'section-not-found', sectionId: 'deprecated' });
		expect(message).toContain('deprecated');
		expect(message).toContain('Contact support');
	});
});
