import { test, expect } from '@playwright/test';

test.describe('Session Creation Flow Analysis', () => {
  test.beforeEach(async ({ page }) => {
    // Set up auth key
    await page.goto('http://localhost:3030');
    await page.fill('input[type="password"]', 'testkey12345');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/projects');
  });

  test('detailed session creation flow - Claude session', async ({ page }) => {
    // Wait for page to stabilize
    await page.waitForTimeout(1000);
    
    console.log('Step 1: Click add session button');
    const addButton = page.locator('.add-session-btn');
    await expect(addButton).toBeVisible();
    await addButton.click();
    
    // Wait for modal
    await page.waitForTimeout(500);
    
    console.log('Step 2: Check modal visibility');
    const modal = page.locator('.modal-overlay').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    console.log('Step 3: Select Claude session type');
    const claudeBtn = page.locator('.type-btn').filter({ hasText: 'Claude Session' });
    await expect(claudeBtn).toBeVisible();
    const isActive = await claudeBtn.evaluate(el => el.classList.contains('active'));
    console.log('Claude button active:', isActive);
    
    console.log('Step 4: Fill in project name');
    const projectInput = page.locator('#project-name');
    await expect(projectInput).toBeVisible();
    await projectInput.fill('test-project-' + Date.now());
    
    console.log('Step 5: Check create button state');
    const createBtn = page.locator('.modal-actions .btn.primary');
    await expect(createBtn).toBeVisible();
    const isDisabled = await createBtn.isDisabled();
    console.log('Create button disabled:', isDisabled);
    
    console.log('Step 6: Click create button');
    await createBtn.click();
    
    // Monitor network requests
    const createRequest = page.waitForRequest(req => 
      req.url().includes('/api/workspaces') || 
      req.url().includes('/api/sessions'),
      { timeout: 10000 }
    );
    
    console.log('Step 7: Wait for API calls');
    try {
      const req = await createRequest;
      console.log('API request made:', req.url(), req.method());
    } catch (e) {
      console.log('No API request detected within timeout');
    }
    
    // Check if modal closes
    console.log('Step 8: Check if modal closes');
    await page.waitForTimeout(2000);
    const modalStillVisible = await modal.isVisible();
    console.log('Modal still visible:', modalStillVisible);
    
    // Check for error messages
    const errors = await page.locator('.error, .error-message, [role="alert"]').all();
    if (errors.length > 0) {
      for (const error of errors) {
        const text = await error.textContent();
        console.log('Error found:', text);
      }
    }
    
    // Check for new session
    console.log('Step 9: Check for new session');
    const sessions = await page.locator('.terminal-container').all();
    console.log('Number of sessions:', sessions.length);
  });

  test('detailed session creation flow - Terminal session', async ({ page }) => {
    console.log('Starting terminal session creation test');
    await page.waitForTimeout(1000);
    
    // Open modal
    await page.locator('.add-session-btn').click();
    await page.waitForTimeout(500);
    
    // Select terminal type
    const terminalBtn = page.locator('.type-btn').filter({ hasText: 'Terminal Session' });
    await terminalBtn.click();
    
    console.log('Terminal type selected');
    
    // Check directory browser
    const dirBrowser = page.locator('.directory-browser, [placeholder*="Navigate"]').first();
    const isBrowserVisible = await dirBrowser.isVisible();
    console.log('Directory browser visible:', isBrowserVisible);
    
    // Try to interact with directory browser
    if (isBrowserVisible) {
      await dirBrowser.click();
      await page.waitForTimeout(1000);
      
      // Check for directory options
      const dirOptions = await page.locator('.directory-item, .dir-item, option').all();
      console.log('Directory options found:', dirOptions.length);
      
      if (dirOptions.length > 0) {
        await dirOptions[0].click();
        console.log('Selected first directory option');
      }
    }
    
    // Check create button state
    const createBtn = page.locator('.modal-actions .btn.primary');
    const canCreate = await createBtn.isEnabled();
    console.log('Can create terminal session:', canCreate);
    
    if (canCreate) {
      await createBtn.click();
      console.log('Clicked create button');
      
      // Wait for response
      await page.waitForTimeout(2000);
      
      // Check result
      const modalClosed = !(await page.locator('.modal-overlay').first().isVisible());
      console.log('Modal closed:', modalClosed);
    }
  });

  test('examine modal components and interactions', async ({ page }) => {
    // Open modal
    await page.locator('.add-session-btn').click();
    await page.waitForTimeout(500);
    
    // Get all interactive elements
    const buttons = await page.locator('button:visible').all();
    console.log('Visible buttons:', buttons.length);
    
    for (const btn of buttons) {
      const text = await btn.textContent();
      const classes = await btn.getAttribute('class');
      console.log(`Button: "${text?.trim()}" - Classes: ${classes}`);
    }
    
    // Get all inputs
    const inputs = await page.locator('input:visible').all();
    console.log('Visible inputs:', inputs.length);
    
    for (const input of inputs) {
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      const id = await input.getAttribute('id');
      console.log(`Input: type="${type}" id="${id}" placeholder="${placeholder}"`);
    }
    
    // Check for tabs/modes
    const tabs = await page.locator('.mode-tab, .tab').all();
    console.log('Tabs found:', tabs.length);
    
    for (const tab of tabs) {
      const text = await tab.textContent();
      const isActive = await tab.evaluate(el => el.classList.contains('active'));
      console.log(`Tab: "${text?.trim()}" - Active: ${isActive}`);
    }
  });
});