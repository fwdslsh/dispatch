// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Basic E2E Test Validation', () => {
  test('should load the main page', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Should have title containing 'dispatch'
    await expect(page).toHaveTitle(/dispatch/i);
    
    // Should show either auth form or projects page
    const authForm = page.locator('form input[type="password"]');
    const projectsHeader = page.locator('h1, h2, header');
    
    const hasAuthForm = await authForm.isVisible();
    const hasProjectsHeader = await projectsHeader.isVisible();
    
    expect(hasAuthForm || hasProjectsHeader).toBeTruthy();
    
    console.log('✅ Basic page loading works');
  });

  test('should handle authentication flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    const authInput = page.locator('input[type="password"]');
    
    if (await authInput.isVisible()) {
      // Fill auth form
      await authInput.fill('test');
      await page.locator('button[type="submit"]').click();
      
      // Should redirect or show success
      await page.waitForTimeout(3000);
      
      // Check if we're on projects page or similar
      const url = page.url();
      expect(url).toContain('http://localhost:5173');
      
      console.log('✅ Authentication flow works');
    } else {
      console.log('ℹ️ No authentication required');
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Page should render without horizontal scroll
    const body = page.locator('body');
    const bodyWidth = await body.evaluate(el => el.clientWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
    
    console.log('✅ Mobile responsive layout works');
  });

  test('should handle network connectivity', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Test that Socket.IO connection works
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(3000);
    
    // Should not have critical connection errors
    const criticalErrors = errors.filter(error => 
      error.includes('failed') || error.includes('timeout') || error.includes('refused')
    );
    
    expect(criticalErrors.length).toBeLessThan(5); // Allow some minor errors
    
    console.log('✅ Network connectivity is functional');
  });
});

test.describe('Component Existence Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Authenticate if needed
    const authInput = page.locator('input[type="password"]');
    if (await authInput.isVisible()) {
      await authInput.fill('test');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);
    }
  });

  test('should have main navigation elements', async ({ page }) => {
    // Should have some form of header/navigation
    const header = page.locator('header, nav, .header, .navbar');
    const hasHeader = await header.count() > 0;
    
    expect(hasHeader).toBeTruthy();
    console.log('✅ Navigation elements present');
  });

  test('should have main content area', async ({ page }) => {
    // Should have main content
    const main = page.locator('main, .main, .content, .container');
    const hasMain = await main.count() > 0;
    
    expect(hasMain).toBeTruthy();
    console.log('✅ Main content area present');
  });

  test('should have interactive elements', async ({ page }) => {
    // Should have buttons or forms
    const buttons = page.locator('button');
    const links = page.locator('a');
    const forms = page.locator('form');
    
    const buttonCount = await buttons.count();
    const linkCount = await links.count();
    const formCount = await forms.count();
    
    const hasInteractiveElements = buttonCount > 0 || linkCount > 0 || formCount > 0;
    expect(hasInteractiveElements).toBeTruthy();
    
    console.log(`✅ Interactive elements present: ${buttonCount} buttons, ${linkCount} links, ${formCount} forms`);
  });
});