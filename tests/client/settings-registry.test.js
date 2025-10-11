/**
 * @file Unit tests for settings registry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	registerSettingsSection,
	getSettingsSections,
	getSettingsByCategory,
	getCategories,
	unregisterSettingsSection,
	clearSettingsRegistry
} from '../../src/lib/client/settings/registry/settings-registry.js';

// Mock components for testing
const MockComponent = { name: 'MockComponent' };
const MockIcon = { name: 'MockIcon' };

describe('Settings Registry', () => {
	beforeEach(() => {
		// Clear registry before each test
		clearSettingsRegistry();
	});

	describe('registerSettingsSection', () => {
		it('should register a valid settings section', () => {
			registerSettingsSection({
				id: 'test-section',
				label: 'Test Section',
				component: MockComponent,
				icon: MockIcon,
				navAriaLabel: 'Test section'
			});

			const sections = getSettingsSections();
			expect(sections).toHaveLength(1);
			expect(sections[0].id).toBe('test-section');
			expect(sections[0].label).toBe('Test Section');
		});

		it('should apply default order and category', () => {
			registerSettingsSection({
				id: 'test-section',
				label: 'Test Section',
				component: MockComponent,
				icon: MockIcon,
				navAriaLabel: 'Test section'
			});

			const sections = getSettingsSections();
			expect(sections[0].order).toBe(100);
			expect(sections[0].category).toBe('core');
		});

		it('should respect custom order and category', () => {
			registerSettingsSection({
				id: 'test-section',
				label: 'Test Section',
				component: MockComponent,
				icon: MockIcon,
				navAriaLabel: 'Test section',
				order: 50,
				category: 'sessions'
			});

			const sections = getSettingsSections();
			expect(sections[0].order).toBe(50);
			expect(sections[0].category).toBe('sessions');
		});

		it('should warn and skip invalid sections', () => {
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			registerSettingsSection({
				id: 'test-section',
				label: 'Test Section'
				// Missing required 'component' field
			});

			expect(consoleWarnSpy).toHaveBeenCalled();
			expect(getSettingsSections()).toHaveLength(0);

			consoleWarnSpy.mockRestore();
		});
	});

	describe('getSettingsSections', () => {
		it('should return sections sorted by order', () => {
			registerSettingsSection({
				id: 'section-3',
				label: 'Section 3',
				component: MockComponent,
				icon: MockIcon,
				order: 30
			});

			registerSettingsSection({
				id: 'section-1',
				label: 'Section 1',
				component: MockComponent,
				icon: MockIcon,
				order: 10
			});

			registerSettingsSection({
				id: 'section-2',
				label: 'Section 2',
				component: MockComponent,
				icon: MockIcon,
				order: 20
			});

			const sections = getSettingsSections();
			expect(sections).toHaveLength(3);
			expect(sections[0].id).toBe('section-1');
			expect(sections[1].id).toBe('section-2');
			expect(sections[2].id).toBe('section-3');
		});

		it('should return empty array when no sections registered', () => {
			expect(getSettingsSections()).toEqual([]);
		});
	});

	describe('getSettingsByCategory', () => {
		it('should return sections filtered by category', () => {
			registerSettingsSection({
				id: 'core-section',
				label: 'Core Section',
				component: MockComponent,
				icon: MockIcon,
				category: 'core'
			});

			registerSettingsSection({
				id: 'auth-section',
				label: 'Auth Section',
				component: MockComponent,
				icon: MockIcon,
				category: 'auth'
			});

			registerSettingsSection({
				id: 'core-section-2',
				label: 'Core Section 2',
				component: MockComponent,
				icon: MockIcon,
				category: 'core'
			});

			const coreSections = getSettingsByCategory('core');
			expect(coreSections).toHaveLength(2);
			expect(coreSections.every(s => s.category === 'core')).toBe(true);

			const authSections = getSettingsByCategory('auth');
			expect(authSections).toHaveLength(1);
			expect(authSections[0].category).toBe('auth');
		});

		it('should return empty array for non-existent category', () => {
			expect(getSettingsByCategory('non-existent')).toEqual([]);
		});

		it('should return sections sorted by order within category', () => {
			registerSettingsSection({
				id: 'core-3',
				label: 'Core 3',
				component: MockComponent,
				icon: MockIcon,
				category: 'core',
				order: 30
			});

			registerSettingsSection({
				id: 'core-1',
				label: 'Core 1',
				component: MockComponent,
				icon: MockIcon,
				category: 'core',
				order: 10
			});

			const coreSections = getSettingsByCategory('core');
			expect(coreSections[0].id).toBe('core-1');
			expect(coreSections[1].id).toBe('core-3');
		});
	});

	describe('getCategories', () => {
		it('should return all registered categories', () => {
			registerSettingsSection({
				id: 'core-section',
				label: 'Core Section',
				component: MockComponent,
				icon: MockIcon,
				category: 'core'
			});

			registerSettingsSection({
				id: 'auth-section',
				label: 'Auth Section',
				component: MockComponent,
				icon: MockIcon,
				category: 'auth'
			});

			registerSettingsSection({
				id: 'sessions-section',
				label: 'Sessions Section',
				component: MockComponent,
				icon: MockIcon,
				category: 'sessions'
			});

			const categories = getCategories();
			expect(categories).toHaveLength(3);
			expect(categories).toContain('core');
			expect(categories).toContain('auth');
			expect(categories).toContain('sessions');
		});

		it('should return empty array when no sections registered', () => {
			expect(getCategories()).toEqual([]);
		});
	});

	describe('unregisterSettingsSection', () => {
		it('should remove a registered section', () => {
			registerSettingsSection({
				id: 'test-section',
				label: 'Test Section',
				component: MockComponent,
				icon: MockIcon
			});

			expect(getSettingsSections()).toHaveLength(1);

			unregisterSettingsSection('test-section');

			expect(getSettingsSections()).toHaveLength(0);
		});

		it('should remove section from category list', () => {
			registerSettingsSection({
				id: 'core-section-1',
				label: 'Core 1',
				component: MockComponent,
				icon: MockIcon,
				category: 'core'
			});

			registerSettingsSection({
				id: 'core-section-2',
				label: 'Core 2',
				component: MockComponent,
				icon: MockIcon,
				category: 'core'
			});

			expect(getSettingsByCategory('core')).toHaveLength(2);

			unregisterSettingsSection('core-section-1');

			const coreSections = getSettingsByCategory('core');
			expect(coreSections).toHaveLength(1);
			expect(coreSections[0].id).toBe('core-section-2');
		});

		it('should handle unregistering non-existent section gracefully', () => {
			expect(() => unregisterSettingsSection('non-existent')).not.toThrow();
		});
	});

	describe('clearSettingsRegistry', () => {
		it('should remove all registered sections', () => {
			registerSettingsSection({
				id: 'section-1',
				label: 'Section 1',
				component: MockComponent,
				icon: MockIcon
			});

			registerSettingsSection({
				id: 'section-2',
				label: 'Section 2',
				component: MockComponent,
				icon: MockIcon,
				category: 'auth'
			});

			expect(getSettingsSections()).toHaveLength(2);
			expect(getCategories()).toHaveLength(2);

			clearSettingsRegistry();

			expect(getSettingsSections()).toEqual([]);
			expect(getCategories()).toEqual([]);
		});
	});

	describe('re-registration', () => {
		it('should allow re-registering a section with updated properties', () => {
			registerSettingsSection({
				id: 'test-section',
				label: 'Original Label',
				component: MockComponent,
				icon: MockIcon,
				category: 'core',
				order: 50
			});

			// Re-register with different properties
			registerSettingsSection({
				id: 'test-section',
				label: 'Updated Label',
				component: MockComponent,
				icon: MockIcon,
				category: 'auth',
				order: 30
			});

			const sections = getSettingsSections();
			expect(sections).toHaveLength(1);
			expect(sections[0].label).toBe('Updated Label');
			expect(sections[0].category).toBe('auth');
			expect(sections[0].order).toBe(30);

			// Should only appear once in auth category
			const authSections = getSettingsByCategory('auth');
			expect(authSections).toHaveLength(1);

			// Should not appear in core category
			const coreSections = getSettingsByCategory('core');
			expect(coreSections).toHaveLength(0);
		});
	});
});
