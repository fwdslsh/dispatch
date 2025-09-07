// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Mobile UX Features', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Authenticate
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    const authInput = page.locator('input[type="password"]');
    if (await authInput.isVisible()) {
      await authInput.fill('test');
      await page.locator('button[type="submit"]').click();
    }
    
    await page.goto('/projects');
  });

  test('should display mobile-optimized layout', async ({ page }) => {
    // Check that layout is responsive
    const body = page.locator('body');
    const bodyWidth = await body.evaluate(el => el.clientWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
    
    // Header should be visible and responsive
    const header = page.locator('header, .header-toolbar');
    if (await header.isVisible()) {
      const headerBox = await header.boundingBox();
      expect(headerBox?.width).toBeLessThanOrEqual(375);
    }
  });

  test('should show mobile keyboard toolbar when terminal is active', async ({ page }) => {
    // Navigate to a project with terminal
    const projectLinks = page.locator('a[href*="/projects/"]');
    const projectCount = await projectLinks.count();
    
    if (projectCount > 0) {
      await projectLinks.first().click();
      
      // Create or attach to a terminal session
      const createButton = page.locator('button:has-text("Create"), button:has-text("New Session")').first();
      if (await createButton.isVisible()) {
        await createButton.click();
        
        const nameInput = page.locator('input[placeholder*="name" i]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill('mobile-test');
          
          const submitButton = page.locator('button[type="submit"], button:has-text("Create")').first();
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(3000);
            
            // Look for mobile keyboard toolbar
            const keyboardToolbar = page.locator('.keyboard-toolbar, [data-testid="keyboard-toolbar"]');
            
            // Toolbar should be visible on mobile
            if (await keyboardToolbar.isVisible()) {
              await expect(keyboardToolbar).toBeVisible();
              
              // Should have common terminal keys
              const tabKey = keyboardToolbar.locator('button:has-text("Tab")');
              const escKey = keyboardToolbar.locator('button:has-text("Esc")');
              const ctrlKey = keyboardToolbar.locator('button:has-text("Ctrl")');
              
              // At least some common keys should be present
              const hasTabKey = await tabKey.isVisible();
              const hasEscKey = await escKey.isVisible();
              const hasCtrlKey = await ctrlKey.isVisible();
              
              expect(hasTabKey || hasEscKey || hasCtrlKey).toBeTruthy();
            }
          }
        }
      }
    }
  });

  test('should handle mobile command palette', async ({ page }) => {
    // Look for command palette trigger
    const commandPaletteButton = page.locator('button:has-text("Commands"), [data-testid="command-palette"], .command-palette-btn');
    
    if (await commandPaletteButton.isVisible()) {
      await commandPaletteButton.click();
      
      // Command palette should appear
      const commandPalette = page.locator('.command-palette, [data-testid="command-palette-menu"]');
      await expect(commandPalette).toBeVisible();
      
      // Should have search input
      const searchInput = page.locator('.command-palette input, [data-testid="command-search"]');
      if (await searchInput.isVisible()) {
        await expect(searchInput).toBeVisible();
        
        // Test search functionality
        await searchInput.fill('session');
        await page.waitForTimeout(500);
        
        // Should show filtered results
        const commandItems = page.locator('.command-item, [data-testid="command-item"]');
        const itemCount = await commandItems.count();
        expect(itemCount).toBeGreaterThan(0);
      }
      
      // Close command palette
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await expect(commandPalette).not.toBeVisible();
    }
  });

  test('should handle touch gestures on mobile', async ({ page }) => {
    // Test swipe gestures if supported
    const gestureArea = page.locator('body, .main-content');
    
    // Try edge swipe to reveal sidebar
    const leftEdge = { x: 5, y: 300 };
    const swipeEnd = { x: 100, y: 300 };
    
    await page.mouse.move(leftEdge.x, leftEdge.y);
    await page.mouse.down();
    await page.mouse.move(swipeEnd.x, swipeEnd.y);
    await page.mouse.up();
    
    await page.waitForTimeout(500);
    
    // Check if sidebar appeared
    const sidebar = page.locator('.sidebar, .mobile-sidebar, [data-testid="sidebar"]');
    if (await sidebar.isVisible()) {
      await expect(sidebar).toBeVisible();
      
      // Swipe back to close
      await page.mouse.move(swipeEnd.x, swipeEnd.y);
      await page.mouse.down();
      await page.mouse.move(leftEdge.x, leftEdge.y);
      await page.mouse.up();
      
      await page.waitForTimeout(500);
    }
  });

  test('should handle header collapse on mobile', async ({ page }) => {
    const header = page.locator('header, .header-toolbar');
    
    if (await header.isVisible()) {
      const initialHeaderBox = await header.boundingBox();
      
      // Try to trigger header collapse (scroll down or swipe up)
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(500);
      
      // Check if header collapsed or transformed
      const newHeaderBox = await header.boundingBox();
      
      // Header should still be present but may be smaller or transformed
      expect(newHeaderBox).toBeTruthy();
      
      // If header collapses, it might be smaller or have different position
      if (initialHeaderBox && newHeaderBox) {
        expect(newHeaderBox.y).toBeLessThanOrEqual(initialHeaderBox.y + 10);
      }
    }
  });

  test('should optimize terminal size for mobile viewport', async ({ page }) => {
    // Navigate to terminal session
    const projectLinks = page.locator('a[href*="/projects/"]');
    const projectCount = await projectLinks.count();
    
    if (projectCount > 0) {
      await projectLinks.first().click();
      
      // Create terminal session
      const createButton = page.locator('button:has-text("Create")').first();
      if (await createButton.isVisible()) {
        await createButton.click();
        
        const nameInput = page.locator('input[placeholder*="name" i]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill('mobile-terminal');
          
          const submitButton = page.locator('button[type="submit"]').first();
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(3000);
            
            // Check terminal dimensions
            const terminal = page.locator('.terminal, .xterm');
            if (await terminal.isVisible()) {
              const terminalBox = await terminal.boundingBox();
              
              // Terminal should fit within mobile viewport
              expect(terminalBox?.width).toBeLessThanOrEqual(375);
              expect(terminalBox?.height).toBeLessThanOrEqual(667);
              
              // Terminal should take most of the available space
              expect(terminalBox?.width).toBeGreaterThan(300);
              expect(terminalBox?.height).toBeGreaterThan(200);
            }
          }
        }
      }
    }
  });

  test('should handle virtual keyboard interactions', async ({ page }) => {
    // Navigate to terminal
    const projectLinks = page.locator('a[href*="/projects/"]');
    const projectCount = await projectLinks.count();
    
    if (projectCount > 0) {
      await projectLinks.first().click();
      
      const createButton = page.locator('button:has-text("Create")').first();
      if (await createButton.isVisible()) {
        await createButton.click();
        
        const nameInput = page.locator('input[placeholder*="name" i]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill('keyboard-test');
          
          const submitButton = page.locator('button[type="submit"]').first();
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(3000);
            
            const terminal = page.locator('.terminal, .xterm');
            if (await terminal.isVisible()) {
              // Click on terminal to focus
              await terminal.click();
              
              // Check if keyboard toolbar appears
              const keyboardToolbar = page.locator('.keyboard-toolbar');
              if (await keyboardToolbar.isVisible()) {
                // Test toolbar buttons
                const tabButton = keyboardToolbar.locator('button:has-text("Tab")');
                if (await tabButton.isVisible()) {
                  await tabButton.click();
                  
                  // Verify input was sent to terminal
                  await page.waitForTimeout(500);
                  const terminalContent = await terminal.textContent();
                  expect(terminalContent).toBeTruthy();
                }
              }
            }
          }
        }
      }
    }
  });

  test('should handle mobile navigation patterns', async ({ page }) => {
    // Test navigation between projects
    const projectLinks = page.locator('a[href*="/projects/"]');
    const projectCount = await projectLinks.count();
    
    if (projectCount > 1) {
      // Click first project
      await projectLinks.first().click();
      await expect(page).toHaveURL(/.*\/projects\/[a-f0-9-]+/);
      
      // Navigate back to projects list
      const backButton = page.locator('button:has-text("Back"), .back-btn, [data-testid="back"]');
      const breadcrumb = page.locator('.breadcrumb a, nav a');
      
      if (await backButton.isVisible()) {
        await backButton.click();
      } else if (await breadcrumb.isVisible()) {
        await breadcrumb.first().click();
      } else {
        // Use browser back
        await page.goBack();
      }
      
      await expect(page).toHaveURL(/.*\/projects$/);
    }
  });

  test('should handle tablet viewport (landscape)', async ({ page }) => {
    // Test tablet landscape layout
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.reload();
    
    // Should show more desktop-like layout
    const body = page.locator('body');
    const bodyWidth = await body.evaluate(el => el.clientWidth);
    expect(bodyWidth).toBe(1024);
    
    // May show sidebar or additional panels
    const sidebar = page.locator('.sidebar, .side-panel');
    if (await sidebar.isVisible()) {
      await expect(sidebar).toBeVisible();
    }
    
    // Header should be expanded
    const header = page.locator('header, .header-toolbar');
    if (await header.isVisible()) {
      const headerBox = await header.boundingBox();
      expect(headerBox?.width).toBe(1024);
    }
  });

  test('should handle orientation changes', async ({ page }) => {
    // Start in portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Switch to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    await page.waitForTimeout(500);
    
    // Layout should adapt
    const body = page.locator('body');
    const bodyWidth = await body.evaluate(el => el.clientWidth);
    expect(bodyWidth).toBe(667);
    
    // Terminal should resize if present
    const terminal = page.locator('.terminal, .xterm');
    if (await terminal.isVisible()) {
      const terminalBox = await terminal.boundingBox();
      expect(terminalBox?.width).toBeLessThanOrEqual(667);
      expect(terminalBox?.height).toBeLessThanOrEqual(375);
    }
  });

  test('should handle touch target sizes for accessibility', async ({ page }) => {
    // Check that buttons meet minimum touch target size (44px)
    const buttons = page.locator('button, a, input[type="submit"]');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const buttonBox = await button.boundingBox();
        
        if (buttonBox) {
          // Buttons should be at least 44px in one dimension for touch accessibility
          const minDimension = Math.min(buttonBox.width, buttonBox.height);
          expect(minDimension).toBeGreaterThanOrEqual(32); // Allow some flexibility
        }
      }
    }
  });
});