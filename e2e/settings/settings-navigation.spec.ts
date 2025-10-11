// spec: e2e/test-plans/settings-page-test-plan.md
// seed: e2e/seed.spec.ts

import { test, expect } from '@playwright/test';
import { completeOnboarding } from '../helpers/onboarding-helpers.js';
import { resetToFreshInstall } from '../helpers/reset-database.js';

test.describe('Settings Navigation & Access', () => {
	// Reset database before each test to ensure isolation
	test.beforeEach(async () => {
		await resetToFreshInstall();
	});

	test('Test 1.1: Unauthenticated Access Redirect', async ({ page }) => {
		// 1. Navigate to /settings without authentication
		await page.goto('http://127.0.0.1:7173/settings');

		// 2. Verify redirect occurred (to onboarding since onboarding is not complete)
		await expect(page.getByText('📁 Workspace Setup')).toBeVisible();
	});

	test('Test 1.2: Authenticated Access', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// 1. Navigate to settings directly (with authentication)
		await page.goto('http://127.0.0.1:7173/settings');

		// Wait for settings page to load completely
		await page.waitForLoadState('networkidle');

		// 2. Verify page loads successfully
		await expect(page).toHaveURL('http://127.0.0.1:7173/settings');

		// 3. Verify all 7 tabs are visible (wait for the tab list to load)
		await page.waitForSelector('[role="tablist"]', { state: 'visible', timeout: 10000 });
		await expect(page.getByRole('tab', { name: 'Theme' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Home Directory' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Environment' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Authentication' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Connectivity' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Data & Storage' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Claude' })).toBeVisible();
	});

	test('Test 1.3: Tab Navigation', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// Navigate to settings
		await page.goto('http://127.0.0.1:7173/settings');
		await page.waitForLoadState('networkidle');
		await page.waitForSelector('[role="tablist"]', { state: 'visible' });

		// 1. Click Home Directory tab
		await page.getByRole('tab', { name: 'Home Directory' }).click();
		await expect(page.getByRole('tab', { name: 'Home Directory' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tabpanel', { name: 'Home Directory' })).toBeVisible();

		// 2. Click Environment tab
		await page.getByRole('tab', { name: 'Environment' }).click();
		await expect(page.getByRole('tab', { name: 'Environment' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tabpanel', { name: 'Environment' })).toBeVisible();

		// 3. Click Authentication tab
		await page.getByRole('tab', { name: 'Authentication' }).click();
		await expect(page.getByRole('tab', { name: 'Authentication' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tabpanel', { name: 'Authentication' })).toBeVisible();

		// 4. Click Connectivity tab
		await page.getByRole('tab', { name: 'Connectivity' }).click();
		await expect(page.getByRole('tab', { name: 'Connectivity' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tabpanel', { name: 'Connectivity' })).toBeVisible();

		// 5. Click Data & Storage tab
		await page.getByRole('tab', { name: 'Data & Storage' }).click();
		await expect(page.getByRole('tab', { name: 'Data & Storage' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tabpanel', { name: 'Data & Storage' })).toBeVisible();

		// 6. Click Claude tab
		await page.getByRole('tab', { name: 'Claude' }).click();
		await expect(page.getByRole('tab', { name: 'Claude' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tabpanel', { name: 'Claude' })).toBeVisible();

		// 7. Return to Theme tab to verify navigation back
		await page.getByRole('tab', { name: 'Theme' }).click();
		await expect(page.getByRole('tab', { name: 'Theme' })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByRole('tabpanel', { name: 'Theme' })).toBeVisible();
	});

	test('Test 1.4: Default Tab Selection', async ({ page }) => {
		// Complete onboarding to get authentication
		await completeOnboarding(page, { clickContinue: true });

		// 1. Navigate to settings
		await page.goto('http://127.0.0.1:7173/settings');
		await page.waitForLoadState('networkidle');
		await page.waitForSelector('[role="tablist"]', { state: 'visible' });

		// 2. Verify the first tab (Theme) is selected by default
		const themeTab = page.getByRole('tab', { name: 'Theme' });
		await expect(themeTab).toHaveAttribute('aria-selected', 'true');

		// 3. Verify Theme content is displayed
		await expect(page.getByRole('tabpanel', { name: 'Theme' })).toBeVisible();
	});
});
