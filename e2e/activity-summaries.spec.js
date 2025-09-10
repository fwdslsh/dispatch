import { test, expect } from '@playwright/test';

test.describe('Activity Summaries on Testing Page', () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to testing page
		await page.goto('/testing');
		
		// Wait for page to load
		await page.waitForLoadState('networkidle');
	});

	test('should display activity icons during Claude interaction', async ({ page }) => {
		// Select a project first
		await page.waitForSelector('.project-item', { timeout: 10000 });
		const firstProject = page.locator('.project-item').first();
		await firstProject.click();
		
		// Wait for sessions to load
		await page.waitForSelector('.session-item', { timeout: 10000 });
		
		// Select a session
		const firstSession = page.locator('.session-item').first();
		await firstSession.click();
		
		// Wait for Claude pane to be visible
		await page.waitForSelector('.claude-pane', { timeout: 10000 });
		
		// Type a message that will trigger tool use
		const messageInput = page.locator('textarea.message-input');
		await messageInput.fill('Can you list the files in the current directory?');
		
		// Send the message
		await page.locator('button[type="submit"]').click();
		
		// Wait for typing indicator to appear
		await page.waitForSelector('.typing-indicator', { timeout: 10000 });
		
		// Wait for activity icons to appear
		await page.waitForSelector('.live-event-icons .event-icon', { timeout: 15000 });
		
		// Verify at least one activity icon is visible
		const activityIcons = page.locator('.live-event-icons .event-icon');
		await expect(activityIcons).toHaveCount(1, { timeout: 15000 });
	});

	test('should show activity summary when icon is clicked', async ({ page }) => {
		// Select a project
		await page.waitForSelector('.project-item', { timeout: 10000 });
		const firstProject = page.locator('.project-item').first();
		await firstProject.click();
		
		// Wait for sessions to load
		await page.waitForSelector('.session-item', { timeout: 10000 });
		
		// Select a session with existing messages
		const firstSession = page.locator('.session-item').first();
		await firstSession.click();
		
		// Wait for Claude pane to be visible
		await page.waitForSelector('.claude-pane', { timeout: 10000 });
		
		// Send a simple message to generate activity
		const messageInput = page.locator('textarea.message-input');
		await messageInput.fill('Hello, can you help me?');
		await page.locator('button[type="submit"]').click();
		
		// Wait for typing indicator
		await page.waitForSelector('.typing-indicator', { timeout: 10000 });
		
		// Wait for activity icons
		await page.waitForSelector('.live-event-icons .event-icon', { timeout: 15000 });
		
		// Click on the first activity icon
		const firstIcon = page.locator('.live-event-icons .event-icon').first();
		await firstIcon.click();
		
		// Verify the event summary appears
		await expect(page.locator('.event-summary')).toBeVisible({ timeout: 5000 });
		
		// Verify summary contains expected elements
		await expect(page.locator('.event-summary-header')).toBeVisible();
		await expect(page.locator('.event-summary-icon')).toBeVisible();
		await expect(page.locator('.event-summary-label')).toBeVisible();
		await expect(page.locator('.event-summary-time')).toBeVisible();
		await expect(page.locator('.event-summary-content')).toBeVisible();
	});

	test('should toggle activity summary on icon click', async ({ page }) => {
		// Quick navigation to a session
		await page.waitForSelector('.project-item', { timeout: 10000 });
		await page.locator('.project-item').first().click();
		await page.waitForSelector('.session-item', { timeout: 10000 });
		await page.locator('.session-item').first().click();
		await page.waitForSelector('.claude-pane', { timeout: 10000 });
		
		// Send a message
		const messageInput = page.locator('textarea.message-input');
		await messageInput.fill('Test message');
		await page.locator('button[type="submit"]').click();
		
		// Wait for activity icons
		await page.waitForSelector('.live-event-icons .event-icon', { timeout: 15000 });
		
		const firstIcon = page.locator('.live-event-icons .event-icon').first();
		
		// Click to show summary
		await firstIcon.click();
		await expect(page.locator('.event-summary')).toBeVisible({ timeout: 5000 });
		
		// Click again to hide summary
		await firstIcon.click();
		await expect(page.locator('.event-summary')).not.toBeVisible({ timeout: 5000 });
	});

	test('should display activity icons in completed messages', async ({ page }) => {
		// Navigate to a session with history
		await page.waitForSelector('.project-item', { timeout: 10000 });
		const projects = page.locator('.project-item');
		const projectCount = await projects.count();
		
		// Try to find a project with sessions
		for (let i = 0; i < projectCount && i < 3; i++) {
			await projects.nth(i).click();
			await page.waitForTimeout(500); // Brief wait for sessions to load
			
			const sessions = page.locator('.session-item');
			const sessionCount = await sessions.count();
			
			if (sessionCount > 0) {
				// Click the first session
				await sessions.first().click();
				break;
			}
		}
		
		// Wait for messages to load
		await page.waitForSelector('.claude-pane', { timeout: 10000 });
		
		// Check if there are completed messages with activity icons
		const completedMessageIcons = page.locator('.message--assistant .activity-icons-container');
		
		// If there are completed messages with activities
		const iconCount = await completedMessageIcons.count();
		if (iconCount > 0) {
			// Verify the activity icons container structure
			const firstContainer = completedMessageIcons.first();
			await expect(firstContainer.locator('.activity-icons-header')).toBeVisible();
			await expect(firstContainer.locator('.activity-icons-label')).toContainText('Activity Trail');
			await expect(firstContainer.locator('.activity-icons-count')).toBeVisible();
			
			// Click an icon in the completed message
			const staticIcon = firstContainer.locator('.event-icon.static').first();
			if (await staticIcon.count() > 0) {
				await staticIcon.click();
				
				// Verify summary appears for completed message icon
				await expect(firstContainer.locator('.event-summary.static')).toBeVisible({ timeout: 5000 });
			}
		}
	});

	test('should only show one activity summary at a time', async ({ page }) => {
		// Quick navigation
		await page.waitForSelector('.project-item', { timeout: 10000 });
		await page.locator('.project-item').first().click();
		await page.waitForSelector('.session-item', { timeout: 10000 });
		await page.locator('.session-item').first().click();
		await page.waitForSelector('.claude-pane', { timeout: 10000 });
		
		// Send a message that might generate multiple activity icons
		const messageInput = page.locator('textarea.message-input');
		await messageInput.fill('Can you help me understand this code?');
		await page.locator('button[type="submit"]').click();
		
		// Wait for multiple activity icons
		await page.waitForSelector('.live-event-icons .event-icon', { timeout: 15000 });
		
		// Wait a bit for more icons to potentially appear
		await page.waitForTimeout(2000);
		
		const icons = page.locator('.live-event-icons .event-icon');
		const iconCount = await icons.count();
		
		if (iconCount >= 2) {
			// Click first icon
			await icons.first().click();
			await expect(page.locator('.event-summary')).toBeVisible({ timeout: 5000 });
			
			// Click second icon
			await icons.nth(1).click();
			
			// Should still only have one summary visible
			const summaries = page.locator('.event-summary');
			await expect(summaries).toHaveCount(1);
			
			// The second icon should be selected
			await expect(icons.nth(1)).toHaveClass(/selected/);
			await expect(icons.first()).not.toHaveClass(/selected/);
		}
	});

	test('should have proper slide-in animation for activity icons', async ({ page }) => {
		// Quick navigation
		await page.waitForSelector('.project-item', { timeout: 10000 });
		await page.locator('.project-item').first().click();
		await page.waitForSelector('.session-item', { timeout: 10000 });
		await page.locator('.session-item').first().click();
		await page.waitForSelector('.claude-pane', { timeout: 10000 });
		
		// Send a message
		const messageInput = page.locator('textarea.message-input');
		await messageInput.fill('Hello Claude');
		await page.locator('button[type="submit"]').click();
		
		// Wait for activity icons container
		await page.waitForSelector('.live-event-icons', { timeout: 15000 });
		
		// Check that icons have animation styles
		const firstIcon = page.locator('.live-event-icons .event-icon').first();
		await expect(firstIcon).toBeVisible({ timeout: 5000 });
		
		// Verify the icon has proper styles (animation should make it visible)
		const opacity = await firstIcon.evaluate(el => 
			window.getComputedStyle(el).opacity
		);
		expect(parseFloat(opacity)).toBeGreaterThan(0);
	});
});

test.describe('Activity Summary Content', () => {
	test('should display formatted event details in summary', async ({ page }) => {
		// Navigate to testing page
		await page.goto('/testing');
		await page.waitForLoadState('networkidle');
		
		// Quick session selection
		await page.waitForSelector('.project-item', { timeout: 10000 });
		await page.locator('.project-item').first().click();
		await page.waitForSelector('.session-item', { timeout: 10000 });
		await page.locator('.session-item').first().click();
		await page.waitForSelector('.claude-pane', { timeout: 10000 });
		
		// Send a message
		const messageInput = page.locator('textarea.message-input');
		await messageInput.fill('Test');
		await page.locator('button[type="submit"]').click();
		
		// Wait for and click an activity icon
		await page.waitForSelector('.live-event-icons .event-icon', { timeout: 15000 });
		await page.locator('.live-event-icons .event-icon').first().click();
		
		// Check summary content structure
		const summaryContent = page.locator('.event-summary-content');
		await expect(summaryContent).toBeVisible({ timeout: 5000 });
		
		// Content should have some text
		const contentText = await summaryContent.textContent();
		expect(contentText).toBeTruthy();
		expect(contentText.length).toBeGreaterThan(0);
	});
});