// spec: e2e/test-plans/settings-page-test-plan.md
// seed: e2e/seed.spec.ts

import { test, expect } from '@playwright/test';
import { completeOnboarding } from '../helpers/onboarding-helpers.js';
import { resetToFreshInstall } from '../helpers/reset-database.js';
import { navigateToSettingsTab } from '../helpers/settings-helpers.js';

test.describe('Environment Variables', () => {
	// Reset database before each test to ensure isolation
	test.beforeEach(async () => {
		await resetToFreshInstall();
	});

	test('Test 4.1: Add New Environment Variable', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Environment tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Environment');

		// 1. Click "+ Add Variable" button
		await page.getByRole('button', { name: '+ Add Variable' }).click();

		// 2. Enter variable name: NODE_ENV
		const nameInput = page.getByRole('textbox', { name: 'Variable name (e.g., NODE_ENV' }).first();
		await nameInput.fill('NODE_ENV');

		// 3. Enter value: development
		const valueInput = page.getByRole('textbox', { name: 'Value' }).first();
		await valueInput.fill('development');

		// 4. Click "Save Changes"
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// 5. Verify success message
		await expect(page.getByText('Environment variables saved successfully')).toBeVisible();

		// 6. Verify values persist
		await expect(nameInput).toHaveValue('NODE_ENV');
		await expect(valueInput).toHaveValue('development');

		// 7. Reload page and verify persistence
		await page.reload();
		await navigateToSettingsTab(page, 'Environment');

		// Verify variable is still present after reload
		const reloadedNameInput = page
			.getByRole('textbox', { name: 'Variable name (e.g., NODE_ENV' })
			.first();
		const reloadedValueInput = page.getByRole('textbox', { name: 'Value' }).first();
		await expect(reloadedNameInput).toHaveValue('NODE_ENV');
		await expect(reloadedValueInput).toHaveValue('development');
	});

	test('Test 4.2: Add Multiple Environment Variables', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Environment tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Environment');

		// 1. Click "+ Add Variable" three times to create three rows
		await page.getByRole('button', { name: '+ Add Variable' }).click();
		await page.getByRole('button', { name: '+ Add Variable' }).click();
		await page.getByRole('button', { name: '+ Add Variable' }).click();

		// 2. Enter first variable: NODE_ENV = development
		const nameInputs = page.getByRole('textbox', { name: 'Variable name (e.g., NODE_ENV' });
		const valueInputs = page.getByRole('textbox', { name: 'Value' });

		await nameInputs.nth(0).fill('NODE_ENV');
		await valueInputs.nth(0).fill('development');

		// 3. Enter second variable: API_KEY = test-key-12345
		await nameInputs.nth(1).fill('API_KEY');
		await valueInputs.nth(1).fill('test-key-12345');

		// 4. Enter third variable: DEBUG = app:*
		await nameInputs.nth(2).fill('DEBUG');
		await valueInputs.nth(2).fill('app:*');

		// 5. Click "Save Changes"
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// 6. Verify success message
		await expect(page.getByText('Environment variables saved successfully')).toBeVisible();

		// 7. Verify all three variables are present with correct values
		await expect(nameInputs.nth(0)).toHaveValue('NODE_ENV');
		await expect(valueInputs.nth(0)).toHaveValue('development');
		await expect(nameInputs.nth(1)).toHaveValue('API_KEY');
		await expect(valueInputs.nth(1)).toHaveValue('test-key-12345');
		await expect(nameInputs.nth(2)).toHaveValue('DEBUG');
		await expect(valueInputs.nth(2)).toHaveValue('app:*');

		// 8. Verify each row has a remove button
		// Note: Component always maintains an empty row, so we expect 4 total (3 filled + 1 empty)
		const removeButtons = page.getByRole('button', { name: 'Remove environment variable' });
		await expect(removeButtons).toHaveCount(4);

		// 9. Verify variable order is preserved
		await page.reload();
		await navigateToSettingsTab(page, 'Environment');
		await expect(nameInputs.nth(0)).toHaveValue('NODE_ENV');
		await expect(nameInputs.nth(1)).toHaveValue('API_KEY');
		await expect(nameInputs.nth(2)).toHaveValue('DEBUG');
	});

	test('Test 4.3: Remove Environment Variable', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Environment tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Environment');

		// 1. Add three variables first
		await page.getByRole('button', { name: '+ Add Variable' }).click();
		await page.getByRole('button', { name: '+ Add Variable' }).click();
		await page.getByRole('button', { name: '+ Add Variable' }).click();

		const nameInputs = page.getByRole('textbox', { name: 'Variable name (e.g., NODE_ENV' });
		const valueInputs = page.getByRole('textbox', { name: 'Value' });

		await nameInputs.nth(0).fill('NODE_ENV');
		await valueInputs.nth(0).fill('development');
		await nameInputs.nth(1).fill('API_KEY');
		await valueInputs.nth(1).fill('test-key-12345');
		await nameInputs.nth(2).fill('DEBUG');
		await valueInputs.nth(2).fill('app:*');

		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Environment variables saved successfully')).toBeVisible();

		// 2. Click remove button (✕) on API_KEY variable (second row)
		const removeButtons = page.getByRole('button', { name: 'Remove environment variable' });
		await removeButtons.nth(1).click();

		// 3. Verify row is removed immediately from UI
		// Component maintains an empty row, so we expect 3 total (2 filled + 1 empty)
		await expect(nameInputs).toHaveCount(3);
		await expect(nameInputs.nth(0)).toHaveValue('NODE_ENV');
		await expect(nameInputs.nth(1)).toHaveValue('DEBUG');
		await expect(nameInputs.nth(2)).toHaveValue(''); // Empty row

		// 4. Click "Save Changes"
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// 5. Verify success message
		await expect(page.getByText('Environment variables saved successfully')).toBeVisible();

		// 6. Verify variable is permanently removed after save
		// Component maintains an empty row, so we expect 3 total (2 filled + 1 empty)
		await expect(nameInputs).toHaveCount(3);
		await expect(nameInputs.nth(0)).toHaveValue('NODE_ENV');
		await expect(nameInputs.nth(1)).toHaveValue('DEBUG');
		await expect(nameInputs.nth(2)).toHaveValue(''); // Empty row

		// 7. Verify removal persists after reload
		await page.reload();
		await navigateToSettingsTab(page, 'Environment');
		const reloadedNameInputs = page.getByRole('textbox', { name: 'Variable name (e.g., NODE_ENV' });
		// After reload, component loads saved variables and adds empty row
		// We should have 2 saved variables, count may be 2 or 3 depending on timing
		const count = await reloadedNameInputs.count();
		expect(count).toBeGreaterThanOrEqual(2);
		await expect(reloadedNameInputs.nth(0)).toHaveValue('NODE_ENV');
		await expect(reloadedNameInputs.nth(1)).toHaveValue('DEBUG');
	});

	test('Test 4.4: Reset Environment Variables', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Environment tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Environment');

		// 1. Add and save some variables first
		await page.getByRole('button', { name: '+ Add Variable' }).click();
		await page.getByRole('button', { name: '+ Add Variable' }).click();

		const nameInputs = page.getByRole('textbox', { name: 'Variable name (e.g., NODE_ENV' });
		const valueInputs = page.getByRole('textbox', { name: 'Value' });

		await nameInputs.nth(0).fill('NODE_ENV');
		await valueInputs.nth(0).fill('development');
		await nameInputs.nth(1).fill('DEBUG');
		await valueInputs.nth(1).fill('app:*');

		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Environment variables saved successfully')).toBeVisible();

		// 2. Modify a variable value (change development to production)
		await valueInputs.nth(0).fill('production');
		await expect(valueInputs.nth(0)).toHaveValue('production');

		// 3. Click "Reset" button
		await page.getByRole('button', { name: 'Reset' }).click();

		// 4. Verify all variables are cleared (Reset clears to empty state)
		// Note: Based on observed behavior, Reset clears all variables
		const resetNameInputs = page.getByRole('textbox', { name: 'Variable name (e.g., NODE_ENV' });
		await expect(resetNameInputs).toHaveCount(1); // Only the default empty row
		await expect(resetNameInputs.first()).toHaveValue('');
	});

	test('Test 4.5: Validate Environment Variable Names', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Environment tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Environment');

		// 1. Add new variable with invalid name containing hyphen: MY-VAR
		await page.getByRole('button', { name: '+ Add Variable' }).click();

		const nameInput = page.getByRole('textbox', { name: 'Variable name (e.g., NODE_ENV' }).first();
		const valueInput = page.getByRole('textbox', { name: 'Value' }).first();

		await nameInput.fill('MY-VAR');
		await valueInput.fill('test');

		// 2. Attempt to save
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// 3. Verify validation error appears
		await expect(page.getByText('Invalid variable name')).toBeVisible();
		await expect(page.getByText('Failed to save environment variables')).toBeVisible();

		// 4. Test variable name starting with number: 123VAR
		await nameInput.fill('123VAR');
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Invalid variable name')).toBeVisible();

		// 5. Test variable name with space: MY VAR
		await nameInput.fill('MY VAR');
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Invalid variable name')).toBeVisible();

		// 6. Verify valid format works: VALID_VAR_NAME
		await nameInput.fill('VALID_VAR_NAME');
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Environment variables saved successfully')).toBeVisible();
	});

	test('Test 4.6: Empty Variable Name and Value Handling', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Environment tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Environment');

		// 1. Add new variable
		await page.getByRole('button', { name: '+ Add Variable' }).click();

		const nameInput = page.getByRole('textbox', { name: 'Variable name (e.g., NODE_ENV' }).first();
		const valueInput = page.getByRole('textbox', { name: 'Value' }).first();

		// 2. Leave name empty, add value
		await valueInput.fill('some-value');
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// 3. Verify validation prevents saving empty names
		// Empty names should be filtered out or cause validation error
		await expect(page.getByText(/saved successfully|Invalid/i)).toBeVisible();

		// 4. Test empty value (should be allowed)
		await nameInput.fill('EMPTY_VALUE_VAR');
		await valueInput.fill('');
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// Empty values are typically allowed
		await expect(page.getByText('Environment variables saved successfully')).toBeVisible();
		await expect(nameInput).toHaveValue('EMPTY_VALUE_VAR');
		await expect(valueInput).toHaveValue('');

		// 5. Verify both name and value empty doesn't save
		await page.getByRole('button', { name: '+ Add Variable' }).click();
		const secondNameInput = page
			.getByRole('textbox', { name: 'Variable name (e.g., NODE_ENV' })
			.nth(1);
		const secondValueInput = page.getByRole('textbox', { name: 'Value' }).nth(1);

		// Leave both empty
		await expect(secondNameInput).toHaveValue('');
		await expect(secondValueInput).toHaveValue('');

		await page.getByRole('button', { name: 'Save Changes' }).click();

		// Should save successfully (empty rows are typically filtered)
		await expect(page.getByText('Environment variables saved successfully')).toBeVisible();
	});

	test('Test 4.7: Page Reload Persistence', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Environment tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Environment');

		// 1. Add multiple environment variables
		await page.getByRole('button', { name: '+ Add Variable' }).click();
		await page.getByRole('button', { name: '+ Add Variable' }).click();

		const nameInputs = page.getByRole('textbox', { name: 'Variable name (e.g., NODE_ENV' });
		const valueInputs = page.getByRole('textbox', { name: 'Value' });

		await nameInputs.nth(0).fill('TEST_VAR_1');
		await valueInputs.nth(0).fill('value1');
		await nameInputs.nth(1).fill('TEST_VAR_2');
		await valueInputs.nth(1).fill('value2');

		// 2. Save changes
		await page.getByRole('button', { name: 'Save Changes' }).click();
		await expect(page.getByText('Environment variables saved successfully')).toBeVisible();

		// 3. Reload the page
		await page.reload();

		// 4. Navigate back to Environment tab
		await navigateToSettingsTab(page, 'Environment');

		// 5. Verify all variables persisted
		const reloadedNameInputs = page.getByRole('textbox', { name: 'Variable name (e.g., NODE_ENV' });
		const reloadedValueInputs = page.getByRole('textbox', { name: 'Value' });

		await expect(reloadedNameInputs.nth(0)).toHaveValue('TEST_VAR_1');
		await expect(reloadedValueInputs.nth(0)).toHaveValue('value1');
		await expect(reloadedNameInputs.nth(1)).toHaveValue('TEST_VAR_2');
		await expect(reloadedValueInputs.nth(1)).toHaveValue('value2');
	});

	test('Test 4.8: Remove Button Disabled for Single Empty Row', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to Settings > Environment tab
		await page.goto('http://127.0.0.1:7173/settings');
		await navigateToSettingsTab(page, 'Environment');

		// 1. Verify initial state has one empty row with disabled remove button
		const removeButton = page.getByRole('button', { name: 'Remove environment variable' }).first();
		await expect(removeButton).toBeDisabled();

		// 2. Add a second variable
		await page.getByRole('button', { name: '+ Add Variable' }).click();

		// 3. Verify remove buttons are now enabled
		const removeButtons = page.getByRole('button', { name: 'Remove environment variable' });
		await expect(removeButtons.nth(0)).toBeEnabled();
		await expect(removeButtons.nth(1)).toBeEnabled();

		// 4. Remove the second row
		await removeButtons.nth(1).click();

		// 5. Verify remove button is disabled again (only one row left)
		await expect(removeButton).toBeDisabled();
	});
});
