import { test, expect } from '@playwright/test';
import { resetToFreshInstall } from '../helpers/reset-database.js';
import { completeOnboarding } from '../helpers/onboarding-helpers.js';
import { navigateToSettings, navigateToSettingsTab } from '../helpers/settings-helpers.js';

test.describe('Settings • API Keys', () => {
  test.beforeEach(async () => {
    await resetToFreshInstall();
  });

  test('Create, disable, and delete an API key', async ({ page }) => {
    // Complete onboarding to authenticate and land in app
    await completeOnboarding(page, { clickContinue: true });

    // Go to Settings > Keys
    await navigateToSettings(page);
    await navigateToSettingsTab(page, 'Keys');

    // Wait for manager
    const manager = page.getByTestId('api-key-manager');
    await expect(manager).toBeVisible();

    // Count current keys (may be 0 or 1 depending on flow)
    const rows = manager.locator('.keys-table tbody tr');
    const beforeCount = await rows.count().catch(() => 0);

    // Create a new key
    await page.getByRole('button', { name: 'Create New API Key' }).click();
    await page.getByLabel('Label').fill('E2E Test Key');
    await page.getByRole('button', { name: 'Generate Key' }).click();

    // Wait for generated key view and close
    await expect(page.getByText('API Key Created Successfully')).toBeVisible();
    const createdKeyCode = page.locator('.key-code');
    await expect(createdKeyCode).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    // Verify table increased by 1 and shows new label
    await expect(rows).toHaveCount(beforeCount + 1);
    await expect(manager.getByText('E2E Test Key')).toBeVisible();
    await expect(manager.getByText('Active')).toBeVisible();

    // Disable the new key
    const newRow = manager.locator('tr', { hasText: 'E2E Test Key' });
    await newRow.getByRole('button', { name: 'Disable' }).click();
    await expect(newRow.getByText('Disabled')).toBeVisible();

    // Delete the new key
    await newRow.getByRole('button', { name: 'Delete key' }).click();
    await expect(page.getByText('Delete API Key')).toBeVisible();
    await page.getByRole('button', { name: 'Delete Key' }).click();

    // Verify the key is gone
    await expect(manager.getByText('E2E Test Key')).toHaveCount(0);
  });
});

