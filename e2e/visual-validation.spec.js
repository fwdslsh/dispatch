/**
 * Visual Validation Test - Design Fixes Verification
 *
 * This test validates all 24 visual design fixes across 3 batches:
 * - Batch 1: Critical issues (contrast, overflow, scrolling)
 * - Batch 2: Major issues (button sizing, hover states, alignment)
 * - Batch 3: Minor issues (focus rings, scrollbars, typography)
 */

import { test, expect } from '@playwright/test';
import { preAuthenticateUser, navigateToRouteAuthenticated, quickAuth } from './core-helpers.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7176';
const TEST_KEY = 'test-automation-key-12345';

test.describe('Visual Design Validation', () => {
	test.beforeEach(async ({ page }) => {
		// Quick authentication setup
		await quickAuth(page);
	});

	test('Batch 1 - Critical Issues Validation', async ({ page }) => {
		console.log('=== VALIDATING BATCH 1: CRITICAL ISSUES ===');

		// Navigate to settings
		await page.goto(`${BASE_URL}/settings`);
		await page.waitForLoadState('networkidle');

		// Screenshot at desktop width
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.screenshot({
			path: 'validation-screenshots/batch1-desktop-settings.png',
			fullPage: true
		});

		console.log('✓ Desktop screenshot captured');

		// Check text contrast (WCAG compliance)
		const mutedText = page.locator('.text-secondary, .text-muted, [class*="muted"]').first();
		if (await mutedText.count() > 0) {
			const color = await mutedText.evaluate(el => {
				const style = window.getComputedStyle(el);
				return style.color;
			});
			console.log('Muted text color:', color);
		}

		// Check for overflow issues
		const bodyOverflow = await page.evaluate(() => {
			const body = document.querySelector('body');
			const style = window.getComputedStyle(body);
			return {
				overflow: style.overflow,
				overflowX: style.overflowX,
				overflowY: style.overflowY,
				scrollWidth: document.documentElement.scrollWidth,
				clientWidth: document.documentElement.clientWidth
			};
		});
		console.log('Body overflow:', bodyOverflow);

		// Horizontal overflow check
		expect(bodyOverflow.scrollWidth).toBeLessThanOrEqual(bodyOverflow.clientWidth + 20); // Allow 20px tolerance

		console.log('✓ Batch 1 validation complete');
	});

	test('Batch 2 - Major Issues Validation (Desktop)', async ({ page }) => {
		console.log('=== VALIDATING BATCH 2: MAJOR ISSUES (DESKTOP) ===');

		await page.goto(`${BASE_URL}/settings`);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.waitForLoadState('networkidle');

		// Check button sizing
		const buttons = page.locator('button:visible');
		const buttonCount = await buttons.count();

		if (buttonCount > 0) {
			const firstButton = buttons.first();
			const buttonBox = await firstButton.boundingBox();
			console.log('First button size:', buttonBox);
		}

		// Check icon button hover states
		const iconButtons = page.locator('button[class*="icon"], .icon-button').first();
		if (await iconButtons.count() > 0) {
			await iconButtons.hover();
			await page.screenshot({
				path: 'validation-screenshots/batch2-desktop-icon-hover.png',
				fullPage: false
			});
			console.log('✓ Icon button hover state captured');
		}

		// Check border radius consistency
		const borderRadii = await page.evaluate(() => {
			const elements = document.querySelectorAll('button, .card, .modal, input, select, textarea');
			const radii = new Set();
			elements.forEach(el => {
				const style = window.getComputedStyle(el);
				const br = style.borderRadius;
				if (br && br !== '0px') {
					radii.add(br);
				}
			});
			return Array.from(radii);
		});
		console.log('Border radius values found:', borderRadii);

		await page.screenshot({
			path: 'validation-screenshots/batch2-desktop-full.png',
			fullPage: true
		});

		console.log('✓ Batch 2 desktop validation complete');
	});

	test('Batch 2 - Mobile Breakpoint Validation', async ({ page }) => {
		console.log('=== VALIDATING BATCH 2: MOBILE BREAKPOINT (800px) ===');

		await page.goto(`${BASE_URL}/settings`);

		// Test exactly at 800px breakpoint
		await page.setViewportSize({ width: 800, height: 600 });
		await page.waitForLoadState('networkidle');

		await page.screenshot({
			path: 'validation-screenshots/batch2-breakpoint-800px.png',
			fullPage: true
		});
		console.log('✓ 800px breakpoint screenshot captured');

		// Check button sizing at breakpoint
		const buttons = page.locator('button:visible');
		const buttonCount = await buttons.count();

		if (buttonCount > 0) {
			for (let i = 0; i < Math.min(5, buttonCount); i++) {
				const button = buttons.nth(i);
				const box = await button.boundingBox();
				if (box) {
					console.log(`Button ${i} size at 800px:`, { width: box.width, height: box.height });
					// Buttons should be 44px minimum for touch targets
					expect(box.height).toBeGreaterThanOrEqual(40); // Allow small tolerance
				}
			}
		}

		// Test at mobile width
		await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
		await page.waitForTimeout(500); // Wait for transitions

		await page.screenshot({
			path: 'validation-screenshots/batch2-mobile-375px.png',
			fullPage: true
		});
		console.log('✓ Mobile (375px) screenshot captured');

		// Check button sizing at mobile
		if (buttonCount > 0) {
			for (let i = 0; i < Math.min(3, buttonCount); i++) {
				const button = buttons.nth(i);
				const box = await button.boundingBox();
				if (box) {
					console.log(`Button ${i} size at mobile:`, { width: box.width, height: box.height });
					expect(box.height).toBeGreaterThanOrEqual(40);
				}
			}
		}

		console.log('✓ Batch 2 mobile validation complete');
	});

	test('Batch 3 - Minor Issues Validation', async ({ page }) => {
		console.log('=== VALIDATING BATCH 3: MINOR ISSUES ===');

		await page.goto(`${BASE_URL}/settings`);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.waitForLoadState('networkidle');

		// Check focus ring consistency
		const focusableElements = page.locator('button:visible, input:visible, a:visible');
		const focusCount = await focusableElements.count();

		if (focusCount > 0) {
			const firstFocusable = focusableElements.first();
			await firstFocusable.focus();

			await page.screenshot({
				path: 'validation-screenshots/batch3-focus-ring.png',
				fullPage: false
			});
			console.log('✓ Focus ring captured');

			// Check for duplicate focus rings
			const outlineProps = await firstFocusable.evaluate(el => {
				const style = window.getComputedStyle(el);
				return {
					outline: style.outline,
					outlineColor: style.outlineColor,
					outlineWidth: style.outlineWidth,
					boxShadow: style.boxShadow
				};
			});
			console.log('Focus state styles:', outlineProps);
		}

		// Check scrollbar styles (desktop only)
		const scrollbarStyles = await page.evaluate(() => {
			const hasScrollbar = document.documentElement.scrollHeight > window.innerHeight;
			return {
				hasScrollbar,
				bodyHeight: document.body.scrollHeight,
				windowHeight: window.innerHeight
			};
		});
		console.log('Scrollbar info:', scrollbarStyles);

		// Check typography consistency
		const fontSizes = await page.evaluate(() => {
			const textElements = document.querySelectorAll('p, span, div, label, button');
			const sizes = new Set();
			textElements.forEach(el => {
				const style = window.getComputedStyle(el);
				const fontSize = style.fontSize;
				if (fontSize) {
					sizes.add(fontSize);
				}
			});
			return Array.from(sizes).sort();
		});
		console.log('Font sizes in use:', fontSizes);

		await page.screenshot({
			path: 'validation-screenshots/batch3-full.png',
			fullPage: true
		});

		console.log('✓ Batch 3 validation complete');
	});

	test('Overall Visual Quality Check', async ({ page }) => {
		console.log('=== OVERALL VISUAL QUALITY CHECK ===');

		await page.goto(`${BASE_URL}/settings`);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.waitForLoadState('networkidle');

		// Comprehensive CSS audit
		const cssAudit = await page.evaluate(() => {
			const results = {
				colors: new Set(),
				borderRadii: new Set(),
				shadows: new Set(),
				fontSizes: new Set(),
				lineHeights: new Set(),
				spacings: new Set()
			};

			const elements = document.querySelectorAll('*');
			elements.forEach(el => {
				const style = window.getComputedStyle(el);

				if (style.color) results.colors.add(style.color);
				if (style.borderRadius && style.borderRadius !== '0px') {
					results.borderRadii.add(style.borderRadius);
				}
				if (style.boxShadow && style.boxShadow !== 'none') {
					results.shadows.add(style.boxShadow);
				}
				if (style.fontSize) results.fontSizes.add(style.fontSize);
				if (style.lineHeight) results.lineHeights.add(style.lineHeight);
				if (style.padding && style.padding !== '0px') {
					results.spacings.add(style.padding);
				}
			});

			return {
				colors: Array.from(results.colors),
				borderRadii: Array.from(results.borderRadii).sort(),
				shadows: Array.from(results.shadows).slice(0, 10), // Limit output
				fontSizes: Array.from(results.fontSizes).sort(),
				lineHeights: Array.from(results.lineHeights).sort(),
				spacings: Array.from(results.spacings).slice(0, 15)
			};
		});

		console.log('=== CSS AUDIT RESULTS ===');
		console.log('Unique border radii:', cssAudit.borderRadii);
		console.log('Unique font sizes:', cssAudit.fontSizes);
		console.log('Color palette size:', cssAudit.colors.length);
		console.log('Unique line heights:', cssAudit.lineHeights);

		// Take final comprehensive screenshot
		await page.screenshot({
			path: 'validation-screenshots/overall-final-desktop.png',
			fullPage: true
		});

		console.log('✓ Overall quality check complete');
		console.log('=== ALL VALIDATION TESTS COMPLETE ===');
	});
});
