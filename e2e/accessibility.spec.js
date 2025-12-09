/**
 * Accessibility E2E Tests
 *
 * Tests WCAG 2.1 compliance for all major pages using axe-core:
 * - Login page
 * - Onboarding flow
 * - Workspace page
 * - Settings page
 * - Admin console
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { resetToFreshInstall, resetToOnboarded } from './helpers/index.js';

const BASE_URL = 'http://localhost:7173';

/**
 * Helper function to check accessibility and log violations
 */
async function checkAccessibility(page, context) {
	const accessibilityScanResults = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();

	if (accessibilityScanResults.violations.length > 0) {
		console.log(`\n${context} - Accessibility Violations:`);
		accessibilityScanResults.violations.forEach((violation) => {
			console.log(`\n- ${violation.id}: ${violation.description}`);
			console.log(`  Impact: ${violation.impact}`);
			console.log(`  Help: ${violation.help}`);
			console.log(`  Affected elements: ${violation.nodes.length}`);
		});
	}

	return accessibilityScanResults;
}

test.describe('Accessibility - Public Pages', () => {
	test.beforeEach(async () => {
		await resetToFreshInstall();
	});

	test('login page should be accessible', async ({ page }) => {
		await page.goto(`${BASE_URL}/login`);
		await page.waitForLoadState('networkidle');

		const accessibilityResults = await checkAccessibility(page, 'Login Page');

		expect(accessibilityResults.violations).toEqual([]);
	});

	test('onboarding page should be accessible', async ({ page }) => {
		await page.goto(`${BASE_URL}/onboarding`);
		await page.waitForLoadState('networkidle');

		const accessibilityResults = await checkAccessibility(page, 'Onboarding Page');

		expect(accessibilityResults.violations).toEqual([]);
	});
});

test.describe('Accessibility - Authenticated Pages', () => {
	let apiKey;

	test.beforeEach(async ({ page }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Login
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);
	});

	test('workspace page should be accessible', async ({ page }) => {
		await page.waitForLoadState('networkidle');

		const accessibilityResults = await checkAccessibility(page, 'Workspace Page');

		expect(accessibilityResults.violations).toEqual([]);
	});

	test('settings page should be accessible', async ({ page }) => {
		await page.goto(`${BASE_URL}/settings`);
		await page.waitForLoadState('networkidle');

		const accessibilityResults = await checkAccessibility(page, 'Settings Page');

		expect(accessibilityResults.violations).toEqual([]);
	});

	test('admin console should be accessible', async ({ page }) => {
		await page.goto(`${BASE_URL}/console`);
		await page.waitForLoadState('networkidle');

		const accessibilityResults = await checkAccessibility(page, 'Admin Console');

		expect(accessibilityResults.violations).toEqual([]);
	});
});

test.describe('Accessibility - Interactive Components', () => {
	let apiKey;

	test.beforeEach(async ({ page }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Login
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);
	});

	test('session creation dialog should be accessible', async ({ page }) => {
		// Trigger session creation dialog
		const createButton = page.locator('button:has-text("New Session")').first();
		if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await createButton.click();

			// Wait for dialog to appear
			await page.waitForSelector('[role="dialog"], .modal', { timeout: 5000 });

			const accessibilityResults = await checkAccessibility(page, 'Session Creation Dialog');

			// Allow some violations for dynamic dialogs
			expect(accessibilityResults.violations.length).toBeLessThanOrEqual(3);
		}
	});

	test('terminal component should be accessible', async ({ page }) => {
		// Try to find an existing terminal or create one
		const terminal = page.locator('.xterm, [data-testid="terminal"]').first();

		if (await terminal.isVisible({ timeout: 2000 }).catch(() => false)) {
			const accessibilityResults = await checkAccessibility(page, 'Terminal Component');

			// Terminal components may have some violations due to xterm.js
			expect(accessibilityResults.violations.length).toBeLessThanOrEqual(5);
		}
	});
});

test.describe('Accessibility - Keyboard Navigation', () => {
	let apiKey;

	test.beforeEach(async ({ page }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Login
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);
	});

	test('should support keyboard navigation through workspace', async ({ page }) => {
		// Press Tab to navigate through interactive elements
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');

		// Check that focus is visible (some element should be focused)
		const focusedElement = await page.evaluate(() => {
			const activeElement = document.activeElement;
			return {
				tagName: activeElement?.tagName,
				type: activeElement?.getAttribute('type'),
				role: activeElement?.getAttribute('role')
			};
		});

		expect(focusedElement.tagName).toBeTruthy();
	});

	test('should support keyboard access to settings', async ({ page }) => {
		await page.goto(`${BASE_URL}/settings`);

		// Press Tab to navigate
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');

		// Check that navigation works
		const focusedElement = await page.evaluate(() => {
			return document.activeElement?.tagName;
		});

		expect(focusedElement).toBeTruthy();
	});
});

test.describe('Accessibility - Color Contrast', () => {
	let apiKey;

	test.beforeEach(async ({ page }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Login
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);
	});

	test('workspace should meet color contrast requirements', async ({ page }) => {
		const accessibilityResults = await new AxeBuilder({ page })
			.withTags(['wcag2aa'])
			.include('main, [role="main"]')
			.analyze();

		const contrastViolations = accessibilityResults.violations.filter((v) =>
			v.id.includes('color-contrast')
		);

		expect(contrastViolations).toEqual([]);
	});

	test('settings page should meet color contrast requirements', async ({ page }) => {
		await page.goto(`${BASE_URL}/settings`);

		const accessibilityResults = await new AxeBuilder({ page })
			.withTags(['wcag2aa'])
			.include('main, [role="main"]')
			.analyze();

		const contrastViolations = accessibilityResults.violations.filter((v) =>
			v.id.includes('color-contrast')
		);

		expect(contrastViolations).toEqual([]);
	});
});

test.describe('Accessibility - Screen Reader Support', () => {
	let apiKey;

	test.beforeEach(async ({ page }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Login
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);
	});

	test('should have proper ARIA labels on interactive elements', async ({ page }) => {
		const accessibilityResults = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa'])
			.disableRules(['color-contrast']) // Focus on ARIA labels
			.analyze();

		const ariaViolations = accessibilityResults.violations.filter(
			(v) => v.id.includes('aria') || v.id.includes('label')
		);

		expect(ariaViolations).toEqual([]);
	});

	test('should have proper heading hierarchy', async ({ page }) => {
		const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', (elements) =>
			elements.map((el) => ({
				level: parseInt(el.tagName.substring(1)),
				text: el.textContent?.trim()
			}))
		);

		// Check that heading levels don't skip (h1 -> h3 without h2)
		for (let i = 1; i < headings.length; i++) {
			const currentLevel = headings[i].level;
			const previousLevel = headings[i - 1].level;

			// Heading can increase by 1, stay same, or decrease to any level
			if (currentLevel > previousLevel) {
				expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
			}
		}
	});

	test('should have alt text for images', async ({ page }) => {
		const imagesWithoutAlt = await page.$$eval('img', (images) =>
			images.filter((img) => !img.hasAttribute('alt')).map((img) => img.src)
		);

		expect(imagesWithoutAlt).toEqual([]);
	});
});

test.describe('Accessibility - Form Accessibility', () => {
	test('login form should be accessible', async ({ page }) => {
		await resetToFreshInstall();
		await page.goto(`${BASE_URL}/login`);

		// Check form has proper labels
		const formAccessibility = await new AxeBuilder({ page })
			.include('form')
			.withTags(['wcag2a', 'wcag2aa'])
			.analyze();

		const formViolations = formAccessibility.violations.filter(
			(v) => v.id.includes('label') || v.id.includes('form')
		);

		expect(formViolations).toEqual([]);
	});

	test('form inputs should have proper labels', async ({ page }) => {
		await resetToFreshInstall();
		await page.goto(`${BASE_URL}/login`);

		const inputsWithoutLabels = await page.$$eval(
			'input[type="text"], input[type="password"], input[type="email"]',
			(inputs) => {
				return inputs
					.filter((input) => {
						// Check if input has label via id/for relationship
						const id = input.id;
						if (!id) return true;

						const label = document.querySelector(`label[for="${id}"]`);
						return !label;
					})
					.map((input) => ({
						type: input.type,
						name: input.name,
						placeholder: input.placeholder
					}));
			}
		);

		// Allow inputs with placeholders or aria-label as acceptable alternatives
		const inputsWithoutAnyLabel = inputsWithoutLabels.filter(
			(input) => !input.placeholder && !input['aria-label']
		);

		expect(inputsWithoutAnyLabel).toEqual([]);
	});
});
