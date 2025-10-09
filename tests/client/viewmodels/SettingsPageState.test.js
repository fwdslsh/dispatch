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

		const expectedOrder = [
			'global',
			'authentication',
			'workspace-env',
			'home',
			'tunnel',
			'vscode-tunnel',
			'claude-auth',
			'claude-defaults',
			'storage',
			'themes',
			'preferences',
			'retention'
		];

		expect(ids).toEqual(expectedOrder);

		for (const section of sections) {
			expect(section.label).toMatch(/^[A-Z]/);
			expect(section.navAriaLabel).toContain(section.label);
			expect(section.component).toBeTruthy();
			expect(section.icon).toBeTruthy();
		}
	});

	it('creates state with default active section when initial section is missing', () => {
		const customState = createSettingsPageState({ initialSection: 'unknown-section' });
		expect(customState.activeSection).toBe('global');
		expect(customState.savedMessage).toBeNull();
		expect(customState.error).toBeNull();
	});

	it('sets active section and clears messaging state', () => {
		recordSaveMessage(state, 'Saved!');
		recordError(state, 'Should be cleared');

		setActiveSection(state, 'retention');

		expect(state.activeSection).toBe('retention');
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
		const message = translateSettingsError({ type: 'component-load', sectionId: 'claude-auth' });
		expect(message).toContain('Claude Auth');
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
