import { test, expect } from '@playwright/test';

const TEST_KEY = 'testkey12345';

test('Login and project creation flow', async ({ page }) => {
  // 1. Test login
  console.log('Testing login...');
  await page.goto('/');
  
  // Should see login page
  await expect(page.locator('h1')).toContainText('dispatch');
  await expect(page.locator('input[type="password"]')).toBeVisible();
  
  // Login with correct key
  await page.fill('input[type="password"]', TEST_KEY);
  await page.click('button[type="submit"]');
  
  // Should redirect to projects page
  await page.waitForURL('**/projects', { timeout: 5000 });
  console.log('✓ Login successful');
  
  // 2. Test project creation
  console.log('Testing project creation...');
  const projectName = `Test-${Date.now()}`;
  
  // Fill in project details
  await page.fill('input[placeholder="Enter project name"]', projectName);
  await page.fill('input[placeholder="Enter project description"]', 'Automated test project');
  
  // Create project
  await page.click('button:has-text("Create Project")');
  
  // Wait a moment for the project to be created
  await page.waitForTimeout(4000);
  
  // Check if we navigated to the project page (expected behavior)
  const currentUrl = page.url();
  console.log('URL after project creation:', currentUrl);
  
  // Should already be on the project page
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 5000 });
  console.log('✓ Project created and navigated to project page');
  
  // Wait for the project page to load and connect to socket
  await page.waitForTimeout(5000);
  
  // Should see session panel
  await expect(page.locator('.sessions-panel')).toBeVisible();
  console.log('✓ Project opened');
  
  // 4. Test session creation
  console.log('Testing session creation...');
  await page.click('button:has-text("New Session")');
  
  // Wait for session to be created
  await page.waitForTimeout(3000);
  
  // Check if terminal is visible
  const terminal = page.locator('.terminal-container');
  await expect(terminal).toBeVisible({ timeout: 10000 });
  console.log('✓ Session created');
  
  console.log('\n✅ All basic tests passed!');
});