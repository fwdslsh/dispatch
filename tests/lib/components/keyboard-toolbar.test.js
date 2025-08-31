// tests/lib/components/keyboard-toolbar.test.js
import { test, expect } from '@playwright/test';

test.describe('KeyboardToolbar Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a test page that includes the KeyboardToolbar component
    await page.goto('/');
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test.describe('Keyboard Detection', () => {
    test('detects virtual keyboard visibility using visualViewport API', async ({ page }) => {
      // Mock the visualViewport API
      await page.addInitScript(() => {
        // Mock visualViewport for testing
        let mockHeight = window.innerHeight;
        const mockViewport = {
          height: mockHeight,
          addEventListener: (event, callback) => {
            window._mockViewportCallback = callback;
          },
          removeEventListener: () => {},
        };
        
        Object.defineProperty(window, 'visualViewport', {
          value: mockViewport,
          writable: true
        });
        
        // Helper to simulate keyboard showing/hiding
        window._simulateKeyboard = (visible) => {
          mockViewport.height = visible ? mockHeight * 0.6 : mockHeight;
          if (window._mockViewportCallback) {
            window._mockViewportCallback();
          }
        };
      });

      // Focus on a text input to potentially trigger virtual keyboard
      await page.locator('input, textarea').first().focus();
      
      // Simulate keyboard showing
      await page.evaluate(() => window._simulateKeyboard(true));
      
      // Check that keyboard toolbar becomes visible
      const toolbar = page.locator('[data-testid="keyboard-toolbar"]');
      await expect(toolbar).toBeVisible();
      
      // Simulate keyboard hiding
      await page.evaluate(() => window._simulateKeyboard(false));
      
      // Check that keyboard toolbar becomes hidden
      await expect(toolbar).toBeHidden();
    });

    test('falls back to resize events when visualViewport is not available', async ({ page }) => {
      // Remove visualViewport API
      await page.addInitScript(() => {
        delete window.visualViewport;
      });

      // Focus on input and simulate window resize (keyboard showing)
      await page.locator('input, textarea').first().focus();
      
      const initialHeight = await page.evaluate(() => window.innerHeight);
      
      // Simulate mobile keyboard showing (reduces viewport height)
      await page.setViewportSize({ width: 375, height: Math.floor(initialHeight * 0.6) });
      
      // Check that keyboard toolbar becomes visible
      const toolbar = page.locator('[data-testid="keyboard-toolbar"]');
      await expect(toolbar).toBeVisible();
    });
  });

  test.describe('Toolbar Positioning', () => {
    test('positions toolbar above virtual keyboard with safe-area-inset-bottom', async ({ page }) => {
      // Mock safe area insets
      await page.addInitScript(() => {
        // Add CSS custom properties for safe area
        document.documentElement.style.setProperty('--sat', '20px'); // safe-area-inset-top
        document.documentElement.style.setProperty('--sab', '34px'); // safe-area-inset-bottom
      });

      // Simulate keyboard showing
      await page.evaluate(() => {
        if (window._simulateKeyboard) window._simulateKeyboard(true);
      });

      const toolbar = page.locator('[data-testid="keyboard-toolbar"]');
      await expect(toolbar).toBeVisible();

      // Check toolbar positioning
      const toolbarBox = await toolbar.boundingBox();
      const viewportHeight = await page.evaluate(() => window.visualViewport?.height || window.innerHeight);
      
      expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(viewportHeight);
      
      // Verify safe area handling
      const styles = await toolbar.evaluate(el => getComputedStyle(el));
      expect(styles.bottom).toContain('calc(');
    });

    test('adjusts position when keyboard height changes', async ({ page }) => {
      const toolbar = page.locator('[data-testid="keyboard-toolbar"]');
      
      // Simulate keyboard showing with different heights
      await page.evaluate(() => {
        if (window._simulateKeyboard) window._simulateKeyboard(true);
      });
      
      const position1 = await toolbar.boundingBox();
      
      // Simulate keyboard height change
      await page.evaluate(() => {
        if (window.visualViewport) {
          window.visualViewport.height = window.innerHeight * 0.5;
          if (window._mockViewportCallback) window._mockViewportCallback();
        }
      });
      
      // Wait for position update
      await page.waitForTimeout(100);
      
      const position2 = await toolbar.boundingBox();
      expect(position2.y).not.toBe(position1.y);
    });
  });

  test.describe('Button Configuration', () => {
    test('displays default toolbar buttons', async ({ page }) => {
      // Trigger toolbar visibility
      await page.evaluate(() => {
        if (window._simulateKeyboard) window._simulateKeyboard(true);
      });

      const toolbar = page.locator('[data-testid="keyboard-toolbar"]');
      await expect(toolbar).toBeVisible();

      // Check for default buttons
      await expect(toolbar.locator('[data-key="Tab"]')).toBeVisible();
      await expect(toolbar.locator('[data-key="Escape"]')).toBeVisible();
      await expect(toolbar.locator('[data-key="Control"]')).toBeVisible();
      await expect(toolbar.locator('[data-key="Alt"]')).toBeVisible();
      await expect(toolbar.locator('[data-key="ArrowUp"]')).toBeVisible();
      await expect(toolbar.locator('[data-key="ArrowDown"]')).toBeVisible();
      await expect(toolbar.locator('[data-key="ArrowLeft"]')).toBeVisible();
      await expect(toolbar.locator('[data-key="ArrowRight"]')).toBeVisible();
    });

    test('respects custom button configuration from localStorage', async ({ page }) => {
      // Set custom configuration in localStorage
      await page.addInitScript(() => {
        localStorage.setItem('keyboardToolbarConfig', JSON.stringify({
          buttons: [
            { key: 'Tab', label: 'Tab' },
            { key: 'Escape', label: 'Esc' },
            { key: 'F1', label: 'F1' }
          ]
        }));
      });

      // Reload to apply config
      await page.reload();
      
      // Trigger toolbar visibility
      await page.evaluate(() => {
        if (window._simulateKeyboard) window._simulateKeyboard(true);
      });

      const toolbar = page.locator('[data-testid="keyboard-toolbar"]');
      
      // Check that custom buttons are present
      await expect(toolbar.locator('[data-key="F1"]')).toBeVisible();
      
      // Check that non-configured buttons are not present
      await expect(toolbar.locator('[data-key="Control"]')).toBeHidden();
    });
  });

  test.describe('Button Actions', () => {
    test('sends correct key events when buttons are pressed', async ({ page }) => {
      // Set up event listeners to capture key events
      await page.addInitScript(() => {
        window.capturedKeys = [];
        document.addEventListener('keydown', (e) => {
          window.capturedKeys.push({
            key: e.key,
            code: e.code,
            ctrlKey: e.ctrlKey,
            altKey: e.altKey,
            metaKey: e.metaKey
          });
        });
      });

      // Trigger toolbar visibility
      await page.evaluate(() => {
        if (window._simulateKeyboard) window._simulateKeyboard(true);
      });

      const toolbar = page.locator('[data-testid="keyboard-toolbar"]');
      
      // Test Tab key
      await toolbar.locator('[data-key="Tab"]').click();
      
      const capturedKeys = await page.evaluate(() => window.capturedKeys);
      expect(capturedKeys).toContainEqual(
        expect.objectContaining({
          key: 'Tab',
          code: 'Tab'
        })
      );
    });

    test('handles modifier key combinations correctly', async ({ page }) => {
      await page.addInitScript(() => {
        window.capturedKeys = [];
        document.addEventListener('keydown', (e) => {
          window.capturedKeys.push({
            key: e.key,
            ctrlKey: e.ctrlKey,
            altKey: e.altKey
          });
        });
      });

      // Trigger toolbar visibility
      await page.evaluate(() => {
        if (window._simulateKeyboard) window._simulateKeyboard(true);
      });

      const toolbar = page.locator('[data-testid="keyboard-toolbar"]');
      
      // Test Ctrl+C combination (if available)
      const ctrlCButton = toolbar.locator('[data-key="ctrl+c"]');
      if (await ctrlCButton.isVisible()) {
        await ctrlCButton.click();
        
        const capturedKeys = await page.evaluate(() => window.capturedKeys);
        expect(capturedKeys).toContainEqual(
          expect.objectContaining({
            key: 'c',
            ctrlKey: true
          })
        );
      }
    });
  });

  test.describe('Integration with Terminal', () => {
    test('toolbar events are properly forwarded to terminal input', async ({ page }) => {
      // Mock terminal input handling
      await page.addInitScript(() => {
        window.terminalInputReceived = [];
        // Mock the terminal input method
        window.mockTerminalWrite = (data) => {
          window.terminalInputReceived.push(data);
        };
      });

      // Trigger toolbar visibility
      await page.evaluate(() => {
        if (window._simulateKeyboard) window._simulateKeyboard(true);
      });

      const toolbar = page.locator('[data-testid="keyboard-toolbar"]');
      
      // Click a button that should send data to terminal
      await toolbar.locator('[data-key="Tab"]').click();
      
      // Verify terminal received the input
      const terminalInput = await page.evaluate(() => window.terminalInputReceived);
      expect(terminalInput.length).toBeGreaterThan(0);
    });
  });
});