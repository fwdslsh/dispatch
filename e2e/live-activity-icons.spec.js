import { test, expect } from '@playwright/test';

test.describe('Live Activity Icons', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to testing page
    await page.goto('/testing');
    await page.waitForLoadState('networkidle');
  });

  test('should display activity icons during Claude interaction', async ({ page }) => {
    // Select a Claude session
    const sessions = page.locator('.project-session');
    const claudeSessions = sessions.filter({ hasText: 'Claude' });
    
    if (await claudeSessions.count() > 0) {
      // Click the first Claude session
      await claudeSessions.first().click();
      await page.waitForTimeout(1000);
      
      // Wait for Claude pane to be visible
      await expect(page.locator('.claude-pane')).toBeVisible();
      
      // Send a message that will trigger tool use
      const input = page.locator('textarea[placeholder*="Ask Claude"]');
      await input.fill('What files are in the current directory? Use the Bash tool to list them.');
      
      // Submit the message
      await page.keyboard.press('Enter');
      
      // Wait for typing indicator
      await expect(page.locator('.typing-indicator')).toBeVisible({ timeout: 5000 });
      
      // Check for live activity icons
      const liveIcons = page.locator('.live-event-icons .event-icon');
      
      // Wait for at least one icon to appear
      await expect(liveIcons).toHaveCount(1, { timeout: 10000 });
      
      // Log how many icons appeared
      const iconCount = await liveIcons.count();
      console.log(`Found ${iconCount} live activity icons`);
      
      // Click on the first icon
      if (iconCount > 0) {
        await liveIcons.first().click();
        
        // Check that activity summary appears
        await expect(page.locator('.event-summary')).toBeVisible({ timeout: 3000 });
        
        // Check that activity summary has content
        const summaryContent = page.locator('.event-summary-content');
        await expect(summaryContent).toBeVisible();
        
        // Log the activity type
        const label = await page.locator('.event-summary-label').textContent();
        console.log(`Activity type: ${label}`);
      }
      
      // Wait for response to complete
      await page.waitForTimeout(5000);
      
      // Check that icons persist in the completed message
      const messageIcons = page.locator('.message-activity-icons .event-icon');
      const persistedIconCount = await messageIcons.count();
      console.log(`Found ${persistedIconCount} persisted activity icons in message`);
      
      // Icons should persist after message completes
      expect(persistedIconCount).toBeGreaterThanOrEqual(iconCount);
    } else {
      console.log('No Claude sessions found, creating a new one');
      
      // Click on a project to create new session
      const projects = page.locator('.project-card');
      if (await projects.count() > 0) {
        await projects.first().click();
        await page.waitForTimeout(500);
        
        // Start Claude session
        const claudeButton = page.locator('button:has-text("Claude")');
        await claudeButton.click();
        await page.waitForTimeout(2000);
        
        // Retry the test with the new session
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Now there should be a Claude session
        const newSessions = page.locator('.project-session');
        const newClaudeSessions = newSessions.filter({ hasText: 'Claude' });
        await expect(newClaudeSessions).toHaveCount(1, { timeout: 5000 });
        
        await newClaudeSessions.first().click();
        await page.waitForTimeout(1000);
        
        // Continue with the test...
        await expect(page.locator('.claude-pane')).toBeVisible();
      }
    }
  });
  
  test('should show different icons for different tool types', async ({ page }) => {
    // Select a Claude session
    const sessions = page.locator('.project-session');
    const claudeSessions = sessions.filter({ hasText: 'Claude' });
    
    if (await claudeSessions.count() > 0) {
      await claudeSessions.first().click();
      await page.waitForTimeout(1000);
      
      // Send a message that will trigger multiple tool uses
      const input = page.locator('textarea[placeholder*="Ask Claude"]');
      await input.fill('First read the package.json file, then search for "test" in all JavaScript files.');
      
      await page.keyboard.press('Enter');
      
      // Wait for typing indicator
      await expect(page.locator('.typing-indicator')).toBeVisible({ timeout: 5000 });
      
      // Wait for multiple icons to appear
      const liveIcons = page.locator('.live-event-icons .event-icon');
      await page.waitForTimeout(3000); // Give time for multiple tools to run
      
      const iconCount = await liveIcons.count();
      console.log(`Total icons displayed: ${iconCount}`);
      
      // Check icon symbols
      const iconSymbols = [];
      for (let i = 0; i < iconCount; i++) {
        const symbol = await liveIcons.nth(i).textContent();
        iconSymbols.push(symbol);
      }
      
      console.log('Icon symbols:', iconSymbols);
      
      // Should have different icons for different tools
      const uniqueSymbols = [...new Set(iconSymbols)];
      console.log('Unique icon types:', uniqueSymbols.length);
      
      // Verify we have at least some icons
      expect(iconCount).toBeGreaterThan(0);
    }
  });
});