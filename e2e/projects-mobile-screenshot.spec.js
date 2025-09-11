// @ts-check
import { test } from '@playwright/test';

test.describe('Projects page mobile snapshot', () => {
  test('capture mobile screenshot of /projects', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/projects');
    // Allow layout to settle
    await page.waitForTimeout(500);
    const out = testInfo.outputPath('projects-mobile.png');
    await page.screenshot({ path: out, fullPage: false });
  });
});
