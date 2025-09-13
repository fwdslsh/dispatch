import { test, expect } from '@playwright/test';

test.describe('Activity Summary Simple Test', () => {
	test('should show and hide activity summary on icon click', async ({ page }) => {
		// Navigate directly to testing page
		await page.goto('/testing');

		// Wait for page to fully load
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000); // Give time for initial load

		// Check if there are any project items
		const projectItems = await page.locator('.project-item').count();
		console.log(`Found ${projectItems} projects`);

		if (projectItems === 0) {
			// No projects, skip test
			test.skip('No projects available for testing');
			return;
		}

		// Click the first project
		await page.locator('.project-item').first().click();

		// Wait a bit for sessions to load
		await page.waitForTimeout(1000);

		// Check if sessions are visible
		const sessionItems = await page.locator('.session-item').count();
		console.log(`Found ${sessionItems} sessions`);

		if (sessionItems === 0) {
			test.skip('No sessions available for testing');
			return;
		}

		// Click the first visible session
		await page.locator('.session-item').first().click();

		// Wait for Claude pane to be ready
		await page.waitForSelector('.claude-pane', { state: 'visible', timeout: 10000 });

		// Send a test message to generate activity
		const messageInput = page.locator('textarea.message-input');
		await messageInput.waitFor({ state: 'visible' });
		await messageInput.fill('Hello, this is a test');

		// Click send button
		const sendButton = page.locator('button[type="submit"]:has-text("Send")');
		await sendButton.click();

		// Wait for typing indicator
		await page.waitForSelector('.typing-indicator', { state: 'visible', timeout: 15000 });

		// Wait for activity icons to appear
		await page.waitForSelector('.live-event-icons .event-icon', {
			state: 'visible',
			timeout: 20000
		});

		// Get the first activity icon
		const firstIcon = page.locator('.live-event-icons .event-icon').first();

		// Verify icon is visible
		await expect(firstIcon).toBeVisible();

		// Click the icon
		await firstIcon.click();

		// Verify summary appears
		const eventSummary = page.locator('.event-summary').first();
		await expect(eventSummary).toBeVisible({ timeout: 5000 });

		// Verify summary has expected content elements
		await expect(page.locator('.event-summary-header').first()).toBeVisible();
		await expect(page.locator('.event-summary-content').first()).toBeVisible();

		// Get the summary content text
		const summaryContent = await page.locator('.event-summary-content').first().textContent();
		console.log('Summary content:', summaryContent);

		// Verify content is not empty
		expect(summaryContent).toBeTruthy();
		expect(summaryContent.length).toBeGreaterThan(0);

		// Click icon again to hide summary
		await firstIcon.click();

		// Verify summary is hidden
		await expect(eventSummary).not.toBeVisible({ timeout: 5000 });

		console.log('✅ Activity summary test passed!');
	});

	test('should display activity icons in typing indicator', async ({ page }) => {
		// Navigate to testing page
		await page.goto('/testing');
		await page.waitForLoadState('networkidle');

		// Quick setup - click first project and session
		const projectCount = await page.locator('.project-item').count();
		if (projectCount === 0) {
			test.skip('No projects available');
			return;
		}

		await page.locator('.project-item').first().click();
		await page.waitForTimeout(1000);

		const sessionCount = await page.locator('.session-item').count();
		if (sessionCount === 0) {
			test.skip('No sessions available');
			return;
		}

		await page.locator('.session-item').first().click();
		await page.waitForSelector('.claude-pane', { state: 'visible' });

		// Send message
		const input = page.locator('textarea.message-input');
		await input.fill('Test message for activity icons');
		await page.locator('button[type="submit"]').click();

		// Wait for typing indicator and activity icons
		await page.waitForSelector('.typing-indicator', { state: 'visible', timeout: 15000 });
		await page.waitForSelector('.live-event-icons', { state: 'visible', timeout: 15000 });

		// Verify activity icons container exists
		const iconsContainer = page.locator('.typing-indicator .live-event-icons');
		await expect(iconsContainer).toBeVisible();

		// Wait for at least one icon
		await page.waitForSelector('.typing-indicator .event-icon', {
			state: 'visible',
			timeout: 20000
		});

		// Count icons
		const iconCount = await page.locator('.typing-indicator .event-icon').count();
		console.log(`Found ${iconCount} activity icons`);
		expect(iconCount).toBeGreaterThan(0);
	});
});
