/**
 * Settings E2E Test Helpers
 *
 * Helper functions for testing the /settings page in Dispatch.
 * These utilities provide reusable components for interacting with
 * all settings categories and their various controls.
 *
 * @see e2e/test-plans/settings-page-test-plan.md for test scenarios
 */

import { expect } from '@playwright/test';

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Navigate to settings page (assumes user is already authenticated)
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function navigateToSettings(page) {
	await page.goto('http://127.0.0.1:7173/settings');
	// Wait for settings page to load
	await page.waitForSelector('[role="tablist"]', { state: 'visible', timeout: 5000 });
}

/**
 * Navigate to a specific settings tab
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} tabName - Tab name (Theme, Home Directory, Environment, etc.)
 * @returns {Promise<void>}
 */
export async function navigateToSettingsTab(page, tabName) {
	// Find and click the tab
	const tab = page.getByRole('tab', { name: tabName });
	await tab.click();

	// Verify tab is active
	await expect(tab).toHaveAttribute('aria-selected', 'true');

	// Verify corresponding tabpanel is visible
	await expect(page.getByRole('tabpanel', { name: tabName })).toBeVisible();
}

/**
 * Verify all settings tabs are visible
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function verifyAllTabsVisible(page) {
	const expectedTabs = [
		'Theme',
		'Home Directory',
		'Environment',
		'Authentication',
		'Connectivity',
		'Data & Storage',
		'Claude'
	];

	for (const tabName of expectedTabs) {
		await expect(page.getByRole('tab', { name: tabName })).toBeVisible();
	}
}

// ============================================================================
// Theme Helpers
// ============================================================================

/**
 * Activate a preset theme
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} themeName - Theme name (Dark, Light, Phosphor Green)
 * @returns {Promise<void>}
 */
export async function activateTheme(page, themeName) {
	// Navigate to Theme tab if not already there
	await navigateToSettingsTab(page, 'Theme');

	// Find and click the Activate button for the theme
	const themeCard = page.locator('.theme-card', { hasText: themeName });
	const activateButton = themeCard.getByRole('button', { name: 'Activate' });
	await activateButton.click();

	// Verify theme is now active
	await expect(themeCard.getByText('Active')).toBeVisible({ timeout: 2000 });
}

/**
 * Upload a custom theme file
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} themeFilePath - Absolute path to theme JSON file
 * @returns {Promise<void>}
 */
export async function uploadCustomTheme(page, themeFilePath) {
	// Navigate to Theme tab
	await navigateToSettingsTab(page, 'Theme');

	// Find file input for theme upload
	const fileInput = page.locator('input[type="file"][accept*="json"]');
	await fileInput.setInputFiles(themeFilePath);

	// Wait for upload success indicator
	await expect(page.getByText(/Theme uploaded successfully/i)).toBeVisible({ timeout: 5000 });
}

/**
 * Get currently active theme name
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string>} Active theme name
 */
export async function getActiveTheme(page) {
	await navigateToSettingsTab(page, 'Theme');

	const activeThemeCard = page.locator('.theme-card:has-text("Active")');
	const themeName = await activeThemeCard.locator('h4, .theme-name').textContent();
	return themeName.trim();
}

// ============================================================================
// Environment Variable Helpers
// ============================================================================

/**
 * Add a new environment variable
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} name - Variable name
 * @param {string} value - Variable value
 * @returns {Promise<void>}
 */
export async function addEnvironmentVariable(page, name, value) {
	await navigateToSettingsTab(page, 'Environment');

	// Click "+ Add Variable" button
	await page.getByRole('button', { name: /Add Variable/i }).click();

	// Fill in the new row (last row)
	const rows = page.locator('.env-var-row');
	const newRow = rows.last();

	await newRow.locator('input[placeholder*="NAME"], input[name*="name"]').fill(name);
	await newRow.locator('input[placeholder*="value"], input[name*="value"]').fill(value);
}

/**
 * Remove an environment variable by name
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} name - Variable name to remove
 * @returns {Promise<void>}
 */
export async function removeEnvironmentVariable(page, name) {
	await navigateToSettingsTab(page, 'Environment');

	// Find the row containing the variable
	const row = page.locator('.env-var-row', { hasText: name });

	// Click the remove button (X)
	await row.getByRole('button', { name: /remove|delete|✕/i }).click();
}

/**
 * Get all environment variables as key-value pairs
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<Object>} Object with variable names as keys
 */
export async function getAllEnvironmentVariables(page) {
	await navigateToSettingsTab(page, 'Environment');

	const rows = page.locator('.env-var-row');
	const count = await rows.count();
	const variables = {};

	for (let i = 0; i < count; i++) {
		const row = rows.nth(i);
		const name = await row.locator('input[placeholder*="NAME"]').inputValue();
		const value = await row.locator('input[placeholder*="value"]').inputValue();

		if (name) {
			variables[name] = value;
		}
	}

	return variables;
}

/**
 * Save environment variable changes
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function saveEnvironmentVariables(page) {
	await page.getByRole('button', { name: /Save Changes/i }).click();
	await waitForSaveSuccess(page);
}

// ============================================================================
// Authentication Helpers
// ============================================================================

/**
 * Generate a secure terminal key
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string>} Generated key value
 */
export async function generateTerminalKey(page) {
	await navigateToSettingsTab(page, 'Authentication');

	// Click Generate Secure Key button
	await page.getByRole('button', { name: /Generate Secure Key/i }).click();

	// Get the generated key from the input
	const keyInput = page.locator('input[type="password"][placeholder*="key"]');
	const key = await keyInput.inputValue();

	return key;
}

/**
 * Set OAuth provider configuration
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} provider - Provider name (Google, GitHub, Custom Provider)
 * @param {Object} config - OAuth configuration
 * @param {string} [config.clientId] - Client ID
 * @param {string} [config.clientSecret] - Client Secret
 * @param {string} [config.redirectUri] - Redirect URI
 * @param {string} [config.scope] - OAuth scope
 * @returns {Promise<void>}
 */
export async function setOAuthProvider(page, provider, config = {}) {
	await navigateToSettingsTab(page, 'Authentication');

	// Select provider from dropdown
	const providerDropdown = page.locator(
		'select[name*="provider"], select:has(option:text("Google"))'
	);
	await providerDropdown.selectOption({ label: provider });

	// Fill in configuration if provided
	if (config.clientId) {
		await page.locator('input[placeholder*="Client ID"]').fill(config.clientId);
	}
	if (config.clientSecret) {
		await page.locator('input[placeholder*="Client Secret"]').fill(config.clientSecret);
	}
	if (config.redirectUri) {
		await page.locator('input[placeholder*="Redirect URI"]').fill(config.redirectUri);
	}
	if (config.scope) {
		await page.locator('input[placeholder*="Scope"]').fill(config.scope);
	}
}

/**
 * Toggle terminal key visibility
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function toggleTerminalKeyVisibility(page) {
	await navigateToSettingsTab(page, 'Authentication');
	await page.getByRole('button', { name: /Show|Hide.*key/i }).click();
}

// ============================================================================
// Connectivity Helpers
// ============================================================================

/**
 * Enable LocalTunnel with optional subdomain
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} [subdomain] - Custom subdomain (optional)
 * @returns {Promise<string>} Public tunnel URL
 */
export async function enableLocalTunnel(page, subdomain) {
	await navigateToSettingsTab(page, 'Connectivity');

	// Fill subdomain if provided
	if (subdomain) {
		await page.locator('input[placeholder*="subdomain"]').fill(subdomain);
	}

	// Click Enable Tunnel button
	await page.getByRole('button', { name: /Enable Tunnel/i }).click();

	// Wait for tunnel to connect
	await expect(page.getByText(/Active|Connected/i)).toBeVisible({ timeout: 10000 });

	// Get the public URL
	const urlElement = page.locator('.tunnel-url, [class*="public-url"]');
	const publicUrl = await urlElement.textContent();

	return publicUrl.trim();
}

/**
 * Disable active LocalTunnel
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function disableLocalTunnel(page) {
	await navigateToSettingsTab(page, 'Connectivity');
	await page.getByRole('button', { name: /Disable Tunnel/i }).click();
	await expect(page.getByText(/Disabled|Stopped/i)).toBeVisible({ timeout: 5000 });
}

/**
 * Start VS Code Remote Tunnel
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} [tunnelName] - Custom tunnel name (optional)
 * @returns {Promise<void>}
 */
export async function startVSCodeTunnel(page, tunnelName) {
	await navigateToSettingsTab(page, 'Connectivity');

	// Fill tunnel name if provided
	if (tunnelName) {
		await page.locator('input[placeholder*="tunnel name"]').fill(tunnelName);
	}

	// Click Start Tunnel button
	await page.getByRole('button', { name: /Start Tunnel/i }).click();

	// Wait for authentication flow or running status
	await expect(page.getByText(/Running|Device login|Authentication/i)).toBeVisible({
		timeout: 10000
	});
}

// ============================================================================
// Data & Storage Helpers
// ============================================================================

/**
 * Export browser data to file
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function exportBrowserData(page) {
	await navigateToSettingsTab(page, 'Data & Storage');

	// Set up download listener
	const downloadPromise = page.waitForEvent('download');

	// Click Export Data button
	await page.getByRole('button', { name: /Export Data/i }).click();

	// Wait for download
	const download = await downloadPromise;
	return download;
}

/**
 * Import browser data from file
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} dataFilePath - Path to JSON backup file
 * @returns {Promise<void>}
 */
export async function importBrowserData(page, dataFilePath) {
	await navigateToSettingsTab(page, 'Data & Storage');

	// Find file input for import
	const fileInput = page.locator('input[type="file"][accept*="json"]');
	await fileInput.setInputFiles(dataFilePath);

	// Confirm import if dialog appears
	const confirmButton = page.getByRole('button', { name: /Confirm|Import/i });
	if (await confirmButton.isVisible({ timeout: 2000 })) {
		await confirmButton.click();
	}

	// Wait for import success
	await expect(page.getByText(/Import.*success/i)).toBeVisible({ timeout: 5000 });
}

/**
 * Clear browser data by category
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} category - Category to clear (Sessions, Settings, Cache, All)
 * @returns {Promise<void>}
 */
export async function clearBrowserData(page, category = 'All') {
	await navigateToSettingsTab(page, 'Data & Storage');

	// Find and click the appropriate clear button
	const clearButton = page.getByRole('button', { name: new RegExp(`Clear.*${category}`, 'i') });
	await clearButton.click();

	// Confirm in dialog
	const confirmButton = page.getByRole('button', { name: /Confirm|Yes|Clear/i });
	await confirmButton.click();

	// Wait for success message
	await expect(page.getByText(/Cleared.*success/i)).toBeVisible({ timeout: 5000 });
}

/**
 * Set server data retention policy
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} policy - Retention policy configuration
 * @param {number} [policy.sessionDays] - Session data retention in days
 * @param {number} [policy.logDays] - Log retention in days
 * @param {boolean} [policy.autoCleanup] - Enable automatic cleanup
 * @returns {Promise<void>}
 */
export async function setRetentionPolicy(page, policy = {}) {
	await navigateToSettingsTab(page, 'Data & Storage');

	// Set session retention days
	if (policy.sessionDays !== undefined) {
		const sessionInput = page.locator('input[type="number"][name*="session"]');
		await sessionInput.fill(String(policy.sessionDays));
	}

	// Set log retention days
	if (policy.logDays !== undefined) {
		const logInput = page.locator('input[type="number"][name*="log"]');
		await logInput.fill(String(policy.logDays));
	}

	// Toggle automatic cleanup
	if (policy.autoCleanup !== undefined) {
		const checkbox = page.locator('input[type="checkbox"][name*="cleanup"]');
		const isChecked = await checkbox.isChecked();
		if (isChecked !== policy.autoCleanup) {
			await checkbox.click();
		}
	}

	// Save policy
	await page.getByRole('button', { name: /Save Policy/i }).click();
	await waitForSaveSuccess(page);
}

// ============================================================================
// Claude Configuration Helpers
// ============================================================================

/**
 * Authenticate with Claude using OAuth
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function authenticateClaudeOAuth(page) {
	await navigateToSettingsTab(page, 'Claude');

	// Click Login with Claude button
	await page.getByRole('button', { name: /Login with Claude/i }).click();

	// Note: External OAuth flow would occur here
	// In tests, this might require mocking or manual intervention
	// Wait for connected status
	await expect(page.getByText(/Connected|Authenticated/i)).toBeVisible({ timeout: 10000 });
}

/**
 * Set Claude API key for authentication
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} apiKey - Claude API key
 * @returns {Promise<void>}
 */
export async function setClaudeApiKey(page, apiKey) {
	await navigateToSettingsTab(page, 'Claude');

	// Click Use API Key button or expand API key section
	const apiKeyButton = page.getByRole('button', { name: /Use API Key/i });
	if (await apiKeyButton.isVisible()) {
		await apiKeyButton.click();
	}

	// Fill API key
	await page.locator('input[type="password"][placeholder*="API"]').fill(apiKey);

	// Save or verify
	await page.getByRole('button', { name: /Save|Verify/i }).click();
	await waitForSaveSuccess(page);
}

/**
 * Configure Claude session defaults
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} config - Claude configuration
 * @param {string} [config.model] - Default model
 * @param {string} [config.fallbackModel] - Fallback model
 * @param {string} [config.customPrompt] - Custom system prompt
 * @param {string} [config.appendPrompt] - Append to system prompt
 * @param {boolean} [config.continueConversation] - Continue most recent conversation
 * @param {number} [config.maxTurns] - Max turns limit
 * @param {number} [config.maxThinkingTokens] - Max thinking tokens
 * @returns {Promise<void>}
 */
export async function setClaudeDefaults(page, config = {}) {
	await navigateToSettingsTab(page, 'Claude');

	// Set default model
	if (config.model) {
		const modelDropdown = page.locator('select[name*="model"]').first();
		await modelDropdown.selectOption({ label: config.model });
	}

	// Set fallback model
	if (config.fallbackModel) {
		const fallbackDropdown = page.locator('select[name*="fallback"]');
		await fallbackDropdown.selectOption({ label: config.fallbackModel });
	}

	// Set custom system prompt
	if (config.customPrompt) {
		await page.locator('textarea[placeholder*="Custom System Prompt"]').fill(config.customPrompt);
	}

	// Set append system prompt
	if (config.appendPrompt) {
		await page.locator('textarea[placeholder*="Append"]').fill(config.appendPrompt);
	}

	// Toggle continue conversation
	if (config.continueConversation !== undefined) {
		const checkbox = page.locator('input[type="checkbox"][name*="continue"]');
		const isChecked = await checkbox.isChecked();
		if (isChecked !== config.continueConversation) {
			await checkbox.click();
		}
	}

	// Set max turns
	if (config.maxTurns !== undefined) {
		await page
			.locator('input[type="number"][placeholder*="Max Turns"]')
			.fill(String(config.maxTurns));
	}

	// Set max thinking tokens
	if (config.maxThinkingTokens !== undefined) {
		await page
			.locator('input[type="number"][placeholder*="Thinking Tokens"]')
			.fill(String(config.maxThinkingTokens));
	}

	// Save settings
	await page.getByRole('button', { name: /Save Settings/i }).click();
	await waitForSaveSuccess(page);
}

// ============================================================================
// Validation & State Helpers
// ============================================================================

/**
 * Wait for save success message
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
export async function waitForSaveSuccess(page) {
	// Look for success toast, message, or indicator
	await expect(
		page.locator('.success-message, .toast-success, [class*="success"]').first()
	).toBeVisible({ timeout: 5000 });
}

/**
 * Get validation errors from the page
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<string[]>} Array of error messages
 */
export async function getValidationErrors(page) {
	// Find all error messages
	const errorElements = page.locator('.error-message, .validation-error, [class*="error"]');
	const count = await errorElements.count();
	const errors = [];

	for (let i = 0; i < count; i++) {
		const text = await errorElements.nth(i).textContent();
		if (text) {
			errors.push(text.trim());
		}
	}

	return errors;
}

/**
 * Verify settings persisted after page reload
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {Object} _expectedSettings - Settings to verify
 * @returns {Promise<void>}
 */
export async function verifySettingsPersisted(page, _expectedSettings) {
	// Reload the page
	await page.reload();
	await page.waitForLoadState('networkidle');

	// Navigate to settings
	await navigateToSettings(page);

	// Verify each setting based on category
	// This is a generic helper - specific verification depends on settings structure
	// Implement as needed based on test requirements
}

/**
 * Reset settings to defaults
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} category - Category to reset (or 'All')
 * @returns {Promise<void>}
 */
export async function resetSettingsToDefaults(page, category = 'All') {
	// Navigate to appropriate tab
	if (category !== 'All') {
		await navigateToSettingsTab(page, category);
	}

	// Find and click reset button
	const resetButton = page.getByRole('button', { name: /Reset.*Default/i });
	await resetButton.click();

	// Confirm reset
	const confirmButton = page.getByRole('button', { name: /Confirm|Yes|Reset/i });
	if (await confirmButton.isVisible({ timeout: 2000 })) {
		await confirmButton.click();
	}

	// Wait for success
	await expect(page.getByText(/Reset.*success/i)).toBeVisible({ timeout: 5000 });
}

// ============================================================================
// Utility Helpers
// ============================================================================

/**
 * Check if save button is enabled (indicates unsaved changes)
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<boolean>} True if save button is enabled
 */
export async function hasPendingChanges(page) {
	const saveButton = page.getByRole('button', { name: /Save/i }).first();
	return await saveButton.isEnabled();
}

/**
 * Enable debug logging for settings page interactions
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
export function enableDebugLogging(page) {
	page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
	page.on('pageerror', (err) => console.error('PAGE ERROR:', err));
	page.on('request', (req) => {
		if (req.url().includes('/settings') || req.url().includes('/api/')) {
			console.log('→', req.method(), req.url());
		}
	});
	page.on('response', (res) => {
		if (res.url().includes('/settings') || res.url().includes('/api/')) {
			console.log('←', res.status(), res.url());
		}
	});
}
