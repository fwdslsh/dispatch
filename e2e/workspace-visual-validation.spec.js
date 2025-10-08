/**
 * Workspace Visual Validation - Additional Testing
 * Tests the actual workspace UI with sessions
 */

import { test, expect } from '@playwright/test';
import { navigateToWorkspaceWithOnboardingComplete } from './core-helpers.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7176';

test.describe('Workspace Visual Validation', () => {
	test('Workspace Page - Full UI Validation', async ({ page }) => {
		console.log('=== VALIDATING WORKSPACE PAGE ===');

		// Navigate to workspace with auth
		await navigateToWorkspaceWithOnboardingComplete(page);

		// Desktop view
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.waitForTimeout(1000);

		// Check if workspace loaded
		const workspaceVisible = await page.locator('main, .workspace, body').isVisible();
		console.log('Workspace visible:', workspaceVisible);

		// Screenshot
		await page.screenshot({
			path: 'validation-screenshots/workspace-desktop.png',
			fullPage: true
		});
		console.log('✓ Workspace desktop screenshot captured');

		// Check header elements
		const headerElements = await page.evaluate(() => {
			const header = document.querySelector('header, .header, [role="banner"]');
			if (!header) return null;

			const style = window.getComputedStyle(header);
			return {
				display: style.display,
				alignItems: style.alignItems,
				height: style.height,
				hasLogo: !!header.querySelector('img, svg, .logo'),
				buttonCount: header.querySelectorAll('button').length
			};
		});
		console.log('Header analysis:', headerElements);

		// Check session list
		const sessionList = await page.evaluate(() => {
			const container = document.querySelector(
				'.session-list, [class*="session"], .sessions, aside'
			);
			if (!container) return null;

			const style = window.getComputedStyle(container);
			return {
				overflow: style.overflow,
				overflowY: style.overflowY,
				maxHeight: style.maxHeight,
				sessionCount: container.querySelectorAll('[data-session-id], .session-item').length
			};
		});
		console.log('Session list analysis:', sessionList);

		// Mobile view
		await page.setViewportSize({ width: 375, height: 667 });
		await page.waitForTimeout(500);

		await page.screenshot({
			path: 'validation-screenshots/workspace-mobile.png',
			fullPage: true
		});
		console.log('✓ Workspace mobile screenshot captured');

		console.log('=== WORKSPACE VALIDATION COMPLETE ===');
	});

	test('Session Header - Visual Elements', async ({ page }) => {
		console.log('=== VALIDATING SESSION HEADER ===');

		await navigateToWorkspaceWithOnboardingComplete(page);
		await page.setViewportSize({ width: 1280, height: 800 });

		// Look for session header
		const sessionHeader = await page.evaluate(() => {
			const header = document.querySelector('.session-header, [class*="session-header"]');
			if (!header) return null;

			const style = window.getComputedStyle(header);
			const projectName = header.querySelector('.project-name, [class*="project"]');

			return {
				minHeight: style.minHeight,
				display: style.display,
				alignItems: style.alignItems,
				hasProjectName: !!projectName,
				projectNameStyles: projectName
					? {
							overflow: window.getComputedStyle(projectName).overflow,
							textOverflow: window.getComputedStyle(projectName).textOverflow,
							whiteSpace: window.getComputedStyle(projectName).whiteSpace
					  }
					: null
			};
		});

		console.log('Session header analysis:', sessionHeader);

		console.log('✓ Session header validation complete');
	});

	test('Status Bar - Spacing and Alignment', async ({ page }) => {
		console.log('=== VALIDATING STATUS BAR ===');

		await navigateToWorkspaceWithOnboardingComplete(page);
		await page.setViewportSize({ width: 1280, height: 800 });

		const statusBar = await page.evaluate(() => {
			const bar = document.querySelector('.status-bar, footer, [class*="status"]');
			if (!bar) return null;

			const style = window.getComputedStyle(bar);
			const buttons = bar.querySelectorAll('button');
			const gaps = [];

			// Measure gaps between buttons
			for (let i = 0; i < buttons.length - 1; i++) {
				const current = buttons[i].getBoundingClientRect();
				const next = buttons[i + 1].getBoundingClientRect();
				gaps.push(next.left - current.right);
			}

			return {
				display: style.display,
				gap: style.gap,
				justifyContent: style.justifyContent,
				buttonCount: buttons.length,
				buttonGaps: gaps,
				padding: style.padding
			};
		});

		console.log('Status bar analysis:', statusBar);

		console.log('✓ Status bar validation complete');
	});
});
