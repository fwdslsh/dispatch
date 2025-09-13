/**
 * Test for mobile swipe navigation functionality
 * This test verifies that users can swipe left/right to switch between sessions on mobile
 */

import { test, expect } from '@playwright/test';

test.describe('Mobile Swipe Navigation', () => {
	test.beforeEach(async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		// Navigate to the app
		await page.goto('/');

		// Auto-login for testing
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-key', 'testkey12345');
		});

		await page.goto('/projects');
	});

	test('should show swipe indicators when multiple sessions exist', async ({ page }) => {
		// Create multiple test sessions
		await page.evaluate(async () => {
			// Mock creating sessions
			const sessions = [
				{ id: 'session-1', type: 'claude', workspacePath: '/workspace/test1' },
				{ id: 'session-2', type: 'pty', workspacePath: '/workspace/test2' },
				{ id: 'session-3', type: 'claude', workspacePath: '/workspace/test3' }
			];

			// Would normally create via API, but for test we can mock
			window.testSessions = sessions;
		});

		// Check for swipe indicators
		const leftSwipeHint = page.locator('.swipe-hint--left');
		const rightSwipeHint = page.locator('.swipe-hint--right');

		// Initially, should only see right hint (at first session)
		await expect(leftSwipeHint).not.toBeVisible();
		await expect(rightSwipeHint).toBeVisible();
	});

	test('should navigate to next session on left swipe', async ({ page }) => {
		// Create test sessions
		await page.evaluate(async () => {
			window.testSessions = [
				{ id: 'session-1', type: 'claude' },
				{ id: 'session-2', type: 'pty' }
			];
		});

		// Perform swipe gesture
		const swipeZone = page.locator('.swipe-zone').first();
		if (await swipeZone.isVisible()) {
			const box = await swipeZone.boundingBox();
			if (box) {
				// Simulate left swipe
				await page.mouse.move(box.x + box.width - 50, box.y + box.height / 2);
				await page.mouse.down();
				await page.mouse.move(box.x + 50, box.y + box.height / 2, { steps: 10 });
				await page.mouse.up();
			}
		}

		// Verify session counter updated
		const sessionCounter = page.locator('.session-counter');
		await expect(sessionCounter).toContainText('2 / 2');
	});

	test('should navigate to previous session on right swipe', async ({ page }) => {
		// Start at second session
		await page.evaluate(() => {
			window.testSessions = [
				{ id: 'session-1', type: 'claude' },
				{ id: 'session-2', type: 'pty' }
			];
			window.currentMobileSession = 1;
		});

		// Perform right swipe
		const swipeZone = page.locator('.swipe-zone').first();
		if (await swipeZone.isVisible()) {
			const box = await swipeZone.boundingBox();
			if (box) {
				// Simulate right swipe
				await page.mouse.move(box.x + 50, box.y + box.height / 2);
				await page.mouse.down();
				await page.mouse.move(box.x + box.width - 50, box.y + box.height / 2, { steps: 10 });
				await page.mouse.up();
			}
		}

		// Verify session counter updated
		const sessionCounter = page.locator('.session-counter');
		await expect(sessionCounter).toContainText('1 / 2');
	});

	test('should show swipe zone on mobile', async ({ page }) => {
		// Swipe zone should be visible on mobile
		const swipeZone = page.locator('.swipe-zone');

		// Create at least one session to show the swipe zone
		await page.evaluate(() => {
			window.testSessions = [{ id: 'session-1', type: 'claude' }];
		});

		// The swipe zone should exist when a session is displayed
		await expect(swipeZone).toBeVisible();

		// Check for swipe indicator dots
		const swipeIndicator = page.locator('.swipe-zone-indicator');
		await expect(swipeIndicator).toBeVisible();
		await expect(swipeIndicator).toContainText('••••');
	});

	test('should not interfere with terminal scrolling', async ({ page }) => {
		// Create a terminal session
		await page.evaluate(() => {
			window.testSessions = [{ id: 'terminal-1', type: 'pty' }];
		});

		// Try to scroll within terminal viewport (should work normally)
		const terminalViewport = page.locator('.terminal-viewport');
		if (await terminalViewport.isVisible()) {
			const box = await terminalViewport.boundingBox();
			if (box) {
				// Vertical scroll should work
				await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
				await page.mouse.wheel(0, 100);

				// This should not trigger a swipe
				const sessionCounter = page.locator('.session-counter');
				await expect(sessionCounter).toContainText('1 / 1');
			}
		}
	});

	test('should provide visual feedback during swipe', async ({ page }) => {
		// Create sessions
		await page.evaluate(() => {
			window.testSessions = [
				{ id: 'session-1', type: 'claude' },
				{ id: 'session-2', type: 'pty' }
			];
		});

		const sessionGrid = page.locator('.session-grid');
		const swipeZone = page.locator('.swipe-zone').first();

		if (await swipeZone.isVisible()) {
			const box = await swipeZone.boundingBox();
			if (box) {
				// Start swipe but don't complete
				await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
				await page.mouse.down();
				await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2, { steps: 5 });

				// Check for transform style (visual feedback)
				const style = await sessionGrid.getAttribute('style');
				expect(style).toContain('transform');

				// Complete swipe
				await page.mouse.up();
			}
		}
	});
});

test.describe('Desktop (No Swipe)', () => {
	test('should not show swipe indicators on desktop', async ({ page }) => {
		// Set desktop viewport
		await page.setViewportSize({ width: 1280, height: 720 });

		await page.goto('/');
		await page.evaluate(() => {
			localStorage.setItem('dispatch-auth-key', 'testkey12345');
		});
		await page.goto('/projects');

		// Swipe indicators should not be visible on desktop
		const swipeIndicators = page.locator('.swipe-indicators');
		await expect(swipeIndicators).not.toBeVisible();

		// Swipe zone should not be visible on desktop
		const swipeZone = page.locator('.swipe-zone');
		await expect(swipeZone).not.toBeVisible();
	});
});
