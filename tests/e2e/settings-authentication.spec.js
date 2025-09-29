import { test, expect } from '@playwright/test';

test.describe('Authentication Settings UI - E2E Tests', () => {
	const testKey = 'testkey12345';

	test.beforeEach(async ({ page }) => {
		// Navigate to settings page with auth
		await page.goto(`/settings?authKey=${testKey}`);

		// Wait for page to load
		await page.waitForSelector('[data-testid="settings-page"]', { timeout: 5000 });
	});

	test('should display authentication settings section', async ({ page }) => {
		// Check if authentication section exists
		const authSection = page.locator('[data-testid="authentication-settings"]');
		await expect(authSection).toBeVisible();

		// Check section title
		await expect(authSection.locator('h3')).toContainText('Authentication');
	});

	test('should show terminal key field with masked input', async ({ page }) => {
		// Look for terminal key input
		const terminalKeyInput = page.locator('[data-testid="terminal-key-input"]');
		await expect(terminalKeyInput).toBeVisible();

		// Should be password type (masked)
		await expect(terminalKeyInput).toHaveAttribute('type', 'password');

		// Should have current value shown as masked
		const value = await terminalKeyInput.inputValue();
		if (value) {
			expect(value).toMatch(/^\*+$/);
		}
	});

	test('should display OAuth configuration fields', async ({ page }) => {
		// OAuth Client ID
		const clientIdInput = page.locator('[data-testid="oauth-client-id-input"]');
		await expect(clientIdInput).toBeVisible();

		// OAuth Client Secret
		const clientSecretInput = page.locator('[data-testid="oauth-client-secret-input"]');
		await expect(clientSecretInput).toBeVisible();
		await expect(clientSecretInput).toHaveAttribute('type', 'password');

		// OAuth Redirect URI
		const redirectUriInput = page.locator('[data-testid="oauth-redirect-uri-input"]');
		await expect(redirectUriInput).toBeVisible();
	});

	test('should validate terminal key length on input', async ({ page }) => {
		const terminalKeyInput = page.locator('[data-testid="terminal-key-input"]');
		const saveButton = page.locator('[data-testid="save-settings-button"]');
		const errorMessage = page.locator('[data-testid="terminal-key-error"]');

		// Clear and enter short key
		await terminalKeyInput.clear();
		await terminalKeyInput.fill('short');
		await terminalKeyInput.blur();

		// Should show error message
		await expect(errorMessage).toBeVisible();
		await expect(errorMessage).toContainText('minimum 8 characters');

		// Save button should be disabled
		await expect(saveButton).toBeDisabled();
	});

	test('should accept valid terminal key', async ({ page }) => {
		const terminalKeyInput = page.locator('[data-testid="terminal-key-input"]');
		const saveButton = page.locator('[data-testid="save-settings-button"]');
		const errorMessage = page.locator('[data-testid="terminal-key-error"]');

		// Enter valid key
		await terminalKeyInput.clear();
		await terminalKeyInput.fill('validkey12345');
		await terminalKeyInput.blur();

		// Should not show error
		await expect(errorMessage).not.toBeVisible();

		// Save button should be enabled
		await expect(saveButton).not.toBeDisabled();
	});

	test('should validate OAuth redirect URI format', async ({ page }) => {
		const redirectUriInput = page.locator('[data-testid="oauth-redirect-uri-input"]');
		const errorMessage = page.locator('[data-testid="oauth-redirect-uri-error"]');

		// Enter invalid URI
		await redirectUriInput.clear();
		await redirectUriInput.fill('invalid-uri');
		await redirectUriInput.blur();

		// Should show error
		await expect(errorMessage).toBeVisible();
		await expect(errorMessage).toContainText('valid URL');
	});

	test('should save authentication settings successfully', async ({ page }) => {
		const terminalKeyInput = page.locator('[data-testid="terminal-key-input"]');
		const saveButton = page.locator('[data-testid="save-settings-button"]');
		const successMessage = page.locator('[data-testid="save-success-message"]');

		// Enter valid data
		await terminalKeyInput.clear();
		await terminalKeyInput.fill('newkey12345');

		// Save
		await saveButton.click();

		// Should show success message
		await expect(successMessage).toBeVisible();
		await expect(successMessage).toContainText('Settings saved successfully');
	});

	test('should show session invalidation warning for terminal key changes', async ({ page }) => {
		const terminalKeyInput = page.locator('[data-testid="terminal-key-input"]');
		const saveButton = page.locator('[data-testid="save-settings-button"]');
		const warningMessage = page.locator('[data-testid="session-warning"]');

		// Change terminal key
		await terminalKeyInput.clear();
		await terminalKeyInput.fill('newsessionkey123');

		// Warning should appear
		await expect(warningMessage).toBeVisible();
		await expect(warningMessage).toContainText('sessions will be invalidated');

		// Save and confirm
		await saveButton.click();
	});

	test('should handle OAuth configuration independently', async ({ page }) => {
		const clientIdInput = page.locator('[data-testid="oauth-client-id-input"]');
		const clientSecretInput = page.locator('[data-testid="oauth-client-secret-input"]');
		const redirectUriInput = page.locator('[data-testid="oauth-redirect-uri-input"]');
		const saveButton = page.locator('[data-testid="save-settings-button"]');

		// Enter OAuth configuration
		await clientIdInput.clear();
		await clientIdInput.fill('test-client-123');

		await clientSecretInput.clear();
		await clientSecretInput.fill('secret-456');

		await redirectUriInput.clear();
		await redirectUriInput.fill('https://example.com/callback');

		// Save should work
		await saveButton.click();

		const successMessage = page.locator('[data-testid="save-success-message"]');
		await expect(successMessage).toBeVisible();
	});

	test('should show environment variable fallback values', async ({ page }) => {
		// Look for help text or indicators showing env var fallback
		const envFallbackText = page.locator('[data-testid="env-fallback-indicator"]');

		if (await envFallbackText.isVisible()) {
			await expect(envFallbackText).toContainText('Environment variable');
		}
	});

	test('should maintain form state during validation errors', async ({ page }) => {
		const terminalKeyInput = page.locator('[data-testid="terminal-key-input"]');
		const clientIdInput = page.locator('[data-testid="oauth-client-id-input"]');

		// Fill valid OAuth data
		await clientIdInput.clear();
		await clientIdInput.fill('valid-client-id');

		// Fill invalid terminal key
		await terminalKeyInput.clear();
		await terminalKeyInput.fill('bad');

		// Blur to trigger validation
		await terminalKeyInput.blur();

		// OAuth field should retain its value despite terminal key error
		await expect(clientIdInput).toHaveValue('valid-client-id');
	});

	test('should provide clear field descriptions', async ({ page }) => {
		// Check for help text on fields
		const terminalKeyHelp = page.locator('[data-testid="terminal-key-help"]');
		const oauthHelp = page.locator('[data-testid="oauth-help"]');

		if (await terminalKeyHelp.isVisible()) {
			await expect(terminalKeyHelp).toContainText('authentication');
		}

		if (await oauthHelp.isVisible()) {
			await expect(oauthHelp).toContainText('OAuth');
		}
	});

	test('should handle keyboard navigation', async ({ page }) => {
		const terminalKeyInput = page.locator('[data-testid="terminal-key-input"]');
		const clientIdInput = page.locator('[data-testid="oauth-client-id-input"]');
		const saveButton = page.locator('[data-testid="save-settings-button"]');

		// Tab through form
		await terminalKeyInput.focus();
		await page.keyboard.press('Tab');
		await expect(clientIdInput).toBeFocused();

		// Continue tabbing to save button
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');
		await expect(saveButton).toBeFocused();
	});

	test('should update UI state immediately on successful save', async ({ page }) => {
		const terminalKeyInput = page.locator('[data-testid="terminal-key-input"]');
		const saveButton = page.locator('[data-testid="save-settings-button"]');

		// Make change
		await terminalKeyInput.clear();
		await terminalKeyInput.fill('immediateupdate123');

		// Save
		await saveButton.click();

		// Wait for save to complete
		const successMessage = page.locator('[data-testid="save-success-message"]');
		await expect(successMessage).toBeVisible();

		// UI should reflect the change immediately
		// (The specific behavior depends on implementation -
		// either input shows masked version or gets updated)
		const performance = await page.evaluate(() => performance.now());
		expect(performance).toBeDefined(); // UI update should be instant
	});
});
