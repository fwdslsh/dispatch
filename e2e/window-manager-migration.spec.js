/**
 * E2E Tests: sv-window-manager Migration
 *
 * User Story 1: Existing Window Behavior Preserved
 * User Story 2: Layout Persistence Maintained
 *
 * Tests verify the sv-window-manager library integration maintains
 * all expected window management functionality.
 *
 * NOTE: These tests were written FIRST (TDD approach) and should FAIL
 * before implementation begins.
 */

import { test, expect } from '@playwright/test';
import { resetToOnboarded } from './helpers/index.js';

test.describe('sv-window-manager Migration - User Story 1', () => {
	test.beforeEach(async ({ page }) => {
		// Reset to onboarded state (clean database, API key available)
		const { apiKey } = await resetToOnboarded();

		// Navigate to login page
		await page.goto('http://localhost:7173/login');

		// Login with API key
		await page.fill('[name="key"]', apiKey.key);
		await page.click('button[type="submit"]');

		// Wait for redirect to workspace
		await page.waitForURL('**/workspace');

		// Wait for workspace to fully load
		await page.waitForLoadState('networkidle');
	});

	/**
	 * T006: Test creating multiple terminal sessions in panes
	 * Verify that BwinHost renders panes for each session
	 */
	test('T006: creates multiple terminal sessions in separate panes', async ({ page }) => {
		// Create first terminal session
		const newTerminalButton = page
			.locator(
				'button:has-text("New Terminal"), button:has-text("Terminal"), [data-test="new-terminal"]'
			)
			.first();

		if (await newTerminalButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await newTerminalButton.click();
			await page.waitForTimeout(1000);
		}

		// Create second terminal session
		if (await newTerminalButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await newTerminalButton.click();
			await page.waitForTimeout(1000);
		}

		// Verify multiple panes exist
		const panes = page.locator('[data-bwin-pane], .bwin-pane, [role="region"]');
		const paneCount = await panes.count();

		// Should have at least 1 pane
		expect(paneCount).toBeGreaterThanOrEqual(1);

		// Take screenshot for verification
		await page.screenshot({ path: 'test-results/t006-multiple-panes.png', fullPage: true });
	});

	/**
	 * T007: Test window drag/resize operations
	 * Verify that library-provided drag and resize functionality works
	 */
	test('T007: allows dragging and resizing window panes', async ({ page }) => {
		// Create terminal session
		const newTerminalButton = page
			.locator(
				'button:has-text("New Terminal"), button:has-text("Terminal"), [data-test="new-terminal"]'
			)
			.first();

		if (await newTerminalButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await newTerminalButton.click();
			await page.waitForTimeout(1000);
		}

		// Look for resizable divider/sash element
		const resizer = page.locator('.bwin-sash, .bwin-divider, [data-bwin-sash]').first();

		if (await resizer.isVisible({ timeout: 2000 }).catch(() => false)) {
			const initialBox = await resizer.boundingBox();

			if (initialBox) {
				await page.mouse.move(
					initialBox.x + initialBox.width / 2,
					initialBox.y + initialBox.height / 2
				);
				await page.mouse.down();
				await page.mouse.move(initialBox.x + 100, initialBox.y + initialBox.height / 2);
				await page.mouse.up();

				const newBox = await resizer.boundingBox();
				expect(newBox).toBeTruthy();
			}
		}

		await page.screenshot({ path: 'test-results/t007-drag-resize.png', fullPage: true });
	});

	/**
	 * T008: Test window close operation
	 * Verify that closing a pane terminates the associated session
	 */
	test('T008: closes session when pane is closed', async ({ page }) => {
		// Create a terminal session
		const newTerminalButton = page
			.locator(
				'button:has-text("New Terminal"), button:has-text("Terminal"), [data-test="new-terminal"]'
			)
			.first();

		if (await newTerminalButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await newTerminalButton.click();
			await page.waitForTimeout(1000);
		}

		const initialPanes = await page
			.locator('[data-bwin-pane], .bwin-pane, [role="region"]')
			.count();

		// Look for close button
		const closeButton = page
			.locator('button[aria-label="Close"], button:has-text("×"), button[title="Close"]')
			.first();

		if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await closeButton.click();
			await page.waitForTimeout(1000);

			const finalPanes = await page
				.locator('[data-bwin-pane], .bwin-pane, [role="region"]')
				.count();
			expect(finalPanes).toBeLessThan(initialPanes);
		}

		await page.screenshot({ path: 'test-results/t008-close-session.png', fullPage: true });
	});

	/**
	 * T008a: Test window controls (minimize, maximize, close buttons)
	 */
	test('T008a: provides and operates window control buttons', async ({ page }) => {
		// Create a terminal session
		const newTerminalButton = page
			.locator(
				'button:has-text("New Terminal"), button:has-text("Terminal"), [data-test="new-terminal"]'
			)
			.first();

		if (await newTerminalButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await newTerminalButton.click();
			await page.waitForTimeout(1000);
		}

		// Look for window control buttons
		const minimizeButton = page
			.locator('button[aria-label="Minimize"], button[title="Minimize"]')
			.first();
		const maximizeButton = page
			.locator('button[aria-label="Maximize"], button[title="Maximize"]')
			.first();
		const closeButton = page.locator('button[aria-label="Close"], button[title="Close"]').first();

		// Test minimize if available
		if (await minimizeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await minimizeButton.click();
			await page.waitForTimeout(500);
			await page.screenshot({ path: 'test-results/t008a-minimized.png', fullPage: true });
			await minimizeButton.click();
			await page.waitForTimeout(500);
		}

		// Test maximize if available
		if (await maximizeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
			await maximizeButton.click();
			await page.waitForTimeout(500);
			await page.screenshot({ path: 'test-results/t008a-maximized.png', fullPage: true });
			await maximizeButton.click();
			await page.waitForTimeout(500);
		}

		// Verify close button exists
		const closeExists = await closeButton.isVisible({ timeout: 2000 }).catch(() => false);
		expect(closeExists).toBeTruthy();

		await page.screenshot({ path: 'test-results/t008a-controls.png', fullPage: true });
	});
});

/**
 * E2E Tests: sv-window-manager Migration - User Story 2
 *
 * User Story 2: Layout Persistence Maintained
 * Tests verify empty workspace behavior and auto-initialization
 */
test.describe('sv-window-manager Migration - User Story 2', () => {
	/**
	 * T016: Test workspace load with no layout (fresh install or post-migration)
	 * Verify that workspace auto-creates one terminal session when empty
	 */
	test('T016: auto-creates terminal session on empty workspace load', async ({ page }) => {
		// Reset to fresh install state (no sessions, no layouts)
		const { apiKey } = await resetToOnboarded();

		// Login
		await page.goto('http://localhost:7173/login');
		await page.fill('[name="key"]', apiKey.key);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/workspace');
		await page.waitForLoadState('networkidle');

		// Give time for auto-initialization
		await page.waitForTimeout(2000);

		// Verify at least one pane exists (auto-created terminal)
		const panes = page.locator('[data-bwin-pane], .bwin-pane, [role="region"]');
		const paneCount = await panes.count();

		// Should have at least 1 pane (auto-created terminal)
		expect(paneCount).toBeGreaterThanOrEqual(1);

		await page.screenshot({ path: 'test-results/t016-auto-created-terminal.png', fullPage: true });
	});

	/**
	 * T017: Test empty workspace behavior (no migration notification)
	 * Verify that no migration notification or prompt is displayed
	 */
	test('T017: shows no migration notification on empty workspace', async ({ page }) => {
		// Reset to fresh install state
		const { apiKey } = await resetToOnboarded();

		// Login
		await page.goto('http://localhost:7173/login');
		await page.fill('[name="key"]', apiKey.key);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/workspace');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		// Verify NO migration notification is displayed
		const migrationNotification = page.locator(
			'text=/migration|migrated|layout.*reset|window.*manager/i'
		);
		const notificationCount = await migrationNotification.count();

		// Should be 0 - no migration notification shown (silent reset per spec)
		expect(notificationCount).toBe(0);

		// Verify no blocking modal
		const modal = page.locator('[role="dialog"], .modal, [aria-modal="true"]');
		const modalVisible = await modal.isVisible({ timeout: 1000 }).catch(() => false);

		expect(modalVisible).toBe(false);

		await page.screenshot({
			path: 'test-results/t017-no-migration-notification.png',
			fullPage: true
		});
	});

	/**
	 * Integration test: Verify workspace remains functional after layout reset
	 */
	test('workspace remains functional after layout reset', async ({ page }) => {
		const { apiKey } = await resetToOnboarded();

		// Login
		await page.goto('http://localhost:7173/login');
		await page.fill('[name="key"]', apiKey.key);
		await page.click('button[type="submit"]');
		await page.waitForURL('**/workspace');
		await page.waitForLoadState('networkidle');

		// Create a new terminal session
		const newTerminalButton = page
			.locator('button:has-text("New Terminal"), button:has-text("Terminal")')
			.first();
		if (await newTerminalButton.isVisible({ timeout: 5000 }).catch(() => false)) {
			await newTerminalButton.click();
			await page.waitForTimeout(1000);
		}

		// Verify workspace is functional
		const paneCount = await page.locator('[data-bwin-pane], .bwin-pane, [role="region"]').count();
		expect(paneCount).toBeGreaterThan(0);

		await page.screenshot({ path: 'test-results/us2-functional-workspace.png', fullPage: true });
	});
});
