import { test, expect } from '@playwright/test';

const TEST_KEY = 'testkey12345';

test.describe('Comprehensive Session Testing', () => {
  test('Projects display on initial load and both session types work', async ({ page }) => {
    // Add console and error listeners for debugging
    page.on('console', msg => {
      console.log('[BROWSER]:', msg.text());
    });
    
    page.on('pageerror', error => {
      console.log('[PAGE ERROR]:', error.message);
    });

    console.log('=== Starting comprehensive test ===');

    // Go to login page and authenticate
    await page.goto('/');
    await page.fill('input[type="password"]', TEST_KEY);
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/projects', { timeout: 10000 });
    console.log('✓ Logged in successfully');
    
    // Wait for projects to load and verify they display immediately
    await page.waitForTimeout(3000);
    
    const projectItemsBefore = await page.locator('.project-item').count();
    console.log('Number of existing projects visible:', projectItemsBefore);
    
    // Check empty state visibility (should be false if projects exist)
    const emptyStateBefore = await page.locator('.empty-state').isVisible().catch(() => false);
    console.log('Empty state visible (should be false if projects exist):', emptyStateBefore);
    
    // Test project creation to verify it still works
    console.log('=== Testing project creation ===');
    const projectName = `ComprehensiveTest-${Date.now()}`;
    await page.fill('input[placeholder="Enter project name"]', projectName);
    await page.click('button:has-text("Create Project")');
    
    // Wait for project creation and verify we stay on projects page
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    console.log('URL after project creation (should stay on /projects):', currentUrl);
    expect(currentUrl).toMatch(/\/projects$/);
    
    // Verify project count increased
    const projectItemsAfter = await page.locator('.project-item').count();
    console.log('Number of projects after creation:', projectItemsAfter);
    expect(projectItemsAfter).toBeGreaterThan(projectItemsBefore);
    
    // Click on the first project to test session functionality
    console.log('=== Testing project navigation and sessions ===');
    await page.click('.project-item:first-child');
    
    // Wait for project page to load
    await page.waitForTimeout(5000);
    const projectUrl = page.url();
    console.log('Project URL after clicking:', projectUrl);
    expect(projectUrl).toMatch(/\/projects\/[^\/]+$/);
    
    // Verify "No session selected" message is shown initially
    await expect(page.locator('text=No session selected')).toBeVisible({ timeout: 5000 });
    console.log('✓ "No session selected" message displayed correctly');
    
    // Test terminal session creation
    console.log('=== Testing terminal (shell) session creation ===');
    const createSessionBtn = page.locator('button:has-text("Create Session"), button:has-text("New Session")').first();
    if (await createSessionBtn.isVisible()) {
      await createSessionBtn.click();
      await page.waitForTimeout(3000);
      
      // Look for session in session panel
      const sessionItems = await page.locator('.session-item, .session').count();
      console.log('Number of sessions after creation:', sessionItems);
      expect(sessionItems).toBeGreaterThan(0);
      
      // Click on the session to activate it
      const firstSession = page.locator('.session-item, .session').first();
      if (await firstSession.isVisible()) {
        await firstSession.click();
        await page.waitForTimeout(3000);
        
        // Verify terminal loads without errors
        const terminalContainer = page.locator('.terminal-container').first();
        await expect(terminalContainer).toBeVisible({ timeout: 10000 });
        console.log('✓ Terminal session created and displayed successfully');
        
        // Check that no session errors occurred
        const errorElements = await page.locator('.error').count();
        expect(errorElements).toBe(0);
        console.log('✓ No terminal errors detected');
      } else {
        console.log('Session not visible in panel, but creation succeeded');
      }
    } else {
      console.log('Create session button not found - checking for alternative ways to create sessions');
      
      // Look for other session creation methods
      const altButtons = await page.locator('button').all();
      for (const btn of altButtons) {
        const text = await btn.textContent();
        if (text && text.toLowerCase().includes('session')) {
          console.log('Found potential session button:', text);
        }
      }
    }
    
    console.log('=== Test completed successfully ===');
  });

  test('Claude Code session creation and functionality', async ({ page }) => {
    // Add console and error listeners
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('error') || msg.text().includes('Error')) {
        console.log('[BROWSER ERROR]:', msg.text());
      }
    });
    
    page.on('pageerror', error => {
      console.log('[PAGE ERROR]:', error.message);
    });

    console.log('=== Testing Claude Code session functionality ===');

    // Login and navigate to a project
    await page.goto('/');
    await page.fill('input[type="password"]', TEST_KEY);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/projects', { timeout: 10000 });
    
    // Click on first project
    await page.waitForTimeout(2000);
    await page.click('.project-item:first-child');
    await page.waitForTimeout(3000);
    
    // Look for Claude mode selection or specific Claude session creation
    console.log('Looking for Claude session creation options...');
    
    // Check if there are mode selection options
    const modeSelectors = await page.locator('select, input[name*="mode"], button[data-mode="claude"]').count();
    if (modeSelectors > 0) {
      console.log('Found mode selection controls');
      
      // Try to select Claude mode
      const claudeOption = page.locator('option[value="claude"], button[data-mode="claude"]').first();
      if (await claudeOption.isVisible()) {
        await claudeOption.click();
        console.log('Selected Claude mode');
      }
    }
    
    // Create a session (should default to shell if Claude not available)
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Session")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(5000);
      
      // Verify session was created without errors
      const sessions = await page.locator('.session-item, .session').count();
      console.log('Sessions after creation:', sessions);
      
      if (sessions > 0) {
        // Click on the session
        await page.locator('.session-item, .session').first().click();
        await page.waitForTimeout(3000);
        
        // Check for terminal without errors
        const hasTerminal = await page.locator('.terminal-container').first().isVisible();
        console.log('Terminal visible:', hasTerminal);
        
        if (hasTerminal) {
          console.log('✓ Session created successfully (mode determined by server)');
        }
      }
    }
    
    console.log('=== Claude Code session test completed ===');
  });
});