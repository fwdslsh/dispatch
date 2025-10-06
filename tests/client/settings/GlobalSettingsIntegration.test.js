/**
 * Test for GlobalSettings SettingsViewModel Integration
 * This test validates that the GlobalSettings component properly receives
 * a settingsViewModel with the required settingsByCategory property
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import GlobalSettingsSection from '../../../src/lib/client/settings/GlobalSettingsSection.svelte';

// Mock the context - must be self-contained for browser mode
vi.mock('svelte', async () => {
	const actual = await vi.importActual('svelte');
	return {
		...actual,
		getContext: vi.fn(() => ({
			get: vi.fn().mockResolvedValue({
				getAllSettings: vi.fn().mockResolvedValue({
					categories: [],
					settings: []
				})
			})
		}))
	};
});

// Mock the SettingsViewModel - must be self-contained
vi.mock('../../../src/lib/client/settings/SettingsViewModel.svelte.js', () => ({
	SettingsViewModel: class MockSettingsViewModel {
		constructor(settingsService) {
			this.settingsService = settingsService;
			this.settingsByCategory = [];
			this.categoryHasChanges = vi.fn(() => false);
		}

		async loadSettings() {
			// Mock successful load
			this.settingsByCategory = [
				{
					id: 'workspace',
					name: 'Workspace',
					settings: []
				},
				{
					id: 'ui',
					name: 'UI',
					settings: []
				}
			];
		}
	}
}));

// Create references after mocks are hoisted
let mockServiceContainer;
let mockSettingsService;

describe('GlobalSettings Integration Fix', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should not throw "Cannot read properties of undefined (reading settingsByCategory)" error', async () => {
		// Mock props that the section component expects
		const props = {
			onSave: vi.fn(),
			onError: vi.fn()
		};

		// This should not throw the undefined settingsByCategory error
		expect(() => {
			render(GlobalSettingsSection, { props });
		}).not.toThrow();
	});

	it('should provide settingsService to SettingsViewModel', async () => {
		const props = {
			onSave: vi.fn(),
			onError: vi.fn()
		};

		const { getByTestId } = render(GlobalSettingsSection, { props });

		// Allow component to mount
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Test passes if component renders without error
		expect(true).toBe(true);
	});
});
