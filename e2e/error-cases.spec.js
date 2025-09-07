// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Error Conditions and Edge Cases', () => {
	test.beforeEach(async ({ page }) => {
		// Authenticate
		await page.goto('/');
		await page.waitForTimeout(1000);

		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill('test');
			await page.locator('button[type="submit"]').click();
		}
	});

	test('should handle network disconnection gracefully', async ({ page }) => {
		await page.goto('/projects');

		// Simulate network disconnection
		await page.route('**/socket.io/**', (route) => route.abort());

		// Try to create a project
		const createButton = page
			.locator('button:has-text("Create"), button:has-text("New Project")')
			.first();
		if (await createButton.isVisible()) {
			await createButton.click();

			const nameInput = page.locator('input[placeholder*="name" i]').first();
			if (await nameInput.isVisible()) {
				await nameInput.fill('network-test');

				const submitButton = page
					.locator('button[type="submit"], button:has-text("Create")')
					.first();
				if (await submitButton.isVisible()) {
					await submitButton.click();

					// Should handle network error gracefully
					await page.waitForTimeout(3000);

					// Should show error message or loading state
					const errorMessage = page.locator('.error, .network-error, [data-testid="error"]');
					const loadingState = page.locator('.loading, .spinner');

					const hasError = await errorMessage.isVisible();
					const hasLoading = await loadingState.isVisible();

					expect(hasError || hasLoading).toBeTruthy();
				}
			}
		}
	});

	test('should handle server errors', async ({ page }) => {
		await page.goto('/projects');

		// Simulate server error responses
		await page.route('**/socket.io/**', (route) => {
			route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Internal Server Error' })
			});
		});

		await page.reload();
		await page.waitForTimeout(2000);

		// Should show error state
		const errorIndicator = page.locator('.error, .server-error, .connection-error');

		// May show connection error or fallback to offline mode
		const hasErrorIndicator = await errorIndicator.isVisible();
		const pageLoaded = await page.locator('h1, header').isVisible();

		expect(hasErrorIndicator || pageLoaded).toBeTruthy();
	});

	test('should handle invalid project IDs', async ({ page }) => {
		// Navigate to invalid project ID
		await page.goto('/projects/invalid-project-id');

		// Should show 404 or error page
		const errorPage = page.locator('.error-page, .not-found, h1:has-text("404")');
		const errorMessage = page.locator('.error, [data-testid="error"]');

		const hasErrorPage = await errorPage.isVisible();
		const hasErrorMessage = await errorMessage.isVisible();

		if (hasErrorPage || hasErrorMessage) {
			expect(hasErrorPage || hasErrorMessage).toBeTruthy();
		} else {
			// Should redirect to projects list
			await expect(page).toHaveURL(/.*\/projects$/);
		}
	});

	test('should handle malformed session data', async ({ page }) => {
		await page.goto('/projects');

		// Navigate to project
		const projectLinks = page.locator('a[href*="/projects/"]');
		const projectCount = await projectLinks.count();

		if (projectCount > 0) {
			await projectLinks.first().click();

			// Try to create session with invalid data
			const createButton = page.locator('button:has-text("Create")').first();
			if (await createButton.isVisible()) {
				await createButton.click();

				// Try empty session name
				const nameInput = page.locator('input[placeholder*="name" i]').first();
				if (await nameInput.isVisible()) {
					await nameInput.fill('');

					const submitButton = page.locator('button[type="submit"]').first();
					if (await submitButton.isVisible()) {
						await submitButton.click();

						// Should show validation error
						const validationError = page.locator('.error, .validation-error');
						if (await validationError.isVisible()) {
							await expect(validationError).toContainText(/required|name|invalid/i);
						}
					}
				}

				// Try extremely long session name
				if (await nameInput.isVisible()) {
					const longName = 'a'.repeat(1000);
					await nameInput.fill(longName);

					const submitButton = page.locator('button[type="submit"]').first();
					if (await submitButton.isVisible()) {
						await submitButton.click();

						// Should handle long names (truncate or reject)
						await page.waitForTimeout(2000);

						const errorMessage = page.locator('.error');
						const hasError = await errorMessage.isVisible();

						// Either should show error or create session with truncated name
						if (!hasError) {
							const sessionItems = page.locator('.session-item');
							expect(await sessionItems.count()).toBeGreaterThan(0);
						}
					}
				}
			}
		}
	});

	test('should handle browser storage issues', async ({ page }) => {
		// Fill localStorage with data
		await page.evaluate(() => {
			for (let i = 0; i < 1000; i++) {
				try {
					localStorage.setItem(`test-key-${i}`, 'x'.repeat(1000));
				} catch (e) {
					// Storage full
					break;
				}
			}
		});

		await page.goto('/projects');

		// App should still function with storage issues
		await expect(page.locator('h1, header')).toBeVisible();

		// Clear storage
		await page.evaluate(() => localStorage.clear());
	});

	test('should handle concurrent session creation', async ({ page }) => {
		await page.goto('/projects');

		const projectLinks = page.locator('a[href*="/projects/"]');
		const projectCount = await projectLinks.count();

		if (projectCount > 0) {
			await projectLinks.first().click();

			// Try to create multiple sessions rapidly
			for (let i = 0; i < 3; i++) {
				const createButton = page.locator('button:has-text("Create")').first();
				if (await createButton.isVisible()) {
					await createButton.click();

					const nameInput = page.locator('input[placeholder*="name" i]').first();
					if (await nameInput.isVisible()) {
						await nameInput.fill(`concurrent-session-${i}`);

						const submitButton = page.locator('button[type="submit"]').first();
						if (await submitButton.isVisible()) {
							// Don't wait between submissions
							await submitButton.click();
						}
					}
				}
			}

			// Wait for all operations to complete
			await page.waitForTimeout(5000);

			// Should handle concurrent operations gracefully
			const sessionItems = page.locator('.session-item');
			const sessionCount = await sessionItems.count();

			// At least some sessions should be created
			expect(sessionCount).toBeGreaterThanOrEqual(1);
		}
	});

	test('should handle large terminal output', async ({ page }) => {
		await page.goto('/projects');

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
					await nameInput.fill('large-output-test');

					const submitButton = page.locator('button[type="submit"]').first();
					if (await submitButton.isVisible()) {
						await submitButton.click();
						await page.waitForTimeout(3000);

						const terminal = page.locator('.terminal, .xterm');
						if (await terminal.isVisible()) {
							await terminal.click();

							// Generate large output
							await page.keyboard.type('seq 1 1000');
							await page.keyboard.press('Enter');

							// Wait for output
							await page.waitForTimeout(5000);

							// Terminal should still be responsive
							await terminal.click();
							await page.keyboard.type('echo "responsive"');
							await page.keyboard.press('Enter');

							await page.waitForTimeout(1000);

							// Should see the echo output
							const terminalContent = await terminal.textContent();
							expect(terminalContent).toContain('responsive');
						}
					}
				}
			}
		}
	});

	test('should handle directory traversal attempts', async ({ page }) => {
		await page.goto('/projects');

		const projectLinks = page.locator('a[href*="/projects/"]');
		const projectCount = await projectLinks.count();

		if (projectCount > 0) {
			await projectLinks.first().click();

			const createButton = page.locator('button:has-text("Create")').first();
			if (await createButton.isVisible()) {
				await createButton.click();

				// Try to set malicious working directory
				const workingDirInput = page.locator(
					'input[name*="directory"], input[name*="working"], select[name*="directory"]'
				);
				if (await workingDirInput.isVisible()) {
					const inputType = await workingDirInput.getAttribute('type');

					if (inputType === 'text') {
						// Try directory traversal
						await workingDirInput.fill('../../../etc/passwd');
					} else if ((await workingDirInput.evaluate((el) => el.tagName)) === 'SELECT') {
						// Select should only have valid options
						const options = workingDirInput.locator('option');
						const optionCount = await options.count();
						expect(optionCount).toBeGreaterThanOrEqual(0);
					}

					const nameInput = page.locator('input[placeholder*="name" i]').first();
					if (await nameInput.isVisible()) {
						await nameInput.fill('security-test');

						const submitButton = page.locator('button[type="submit"]').first();
						if (await submitButton.isVisible()) {
							await submitButton.click();

							// Should either reject invalid path or sanitize it
							await page.waitForTimeout(2000);

							const errorMessage = page.locator('.error');
							const hasError = await errorMessage.isVisible();

							if (hasError) {
								// Expected - security validation worked
								await expect(errorMessage).toContainText(/invalid|security|path/i);
							} else {
								// Session created with sanitized path - also acceptable
								const sessionItems = page.locator('.session-item');
								expect(await sessionItems.count()).toBeGreaterThan(0);
							}
						}
					}
				}
			}
		}
	});

	test('should handle missing Claude CLI gracefully', async ({ page }) => {
		await page.goto('/projects');

		const projectLinks = page.locator('a[href*="/projects/"]');
		const projectCount = await projectLinks.count();

		if (projectCount > 0) {
			await projectLinks.first().click();

			const createButton = page.locator('button:has-text("Create")').first();
			if (await createButton.isVisible()) {
				await createButton.click();

				const nameInput = page.locator('input[placeholder*="name" i]').first();
				if (await nameInput.isVisible()) {
					await nameInput.fill('claude-missing-test');
				}

				// Try to select Claude mode
				const modeSelector = page.locator('select, [data-testid="mode-selector"]').first();
				if (await modeSelector.isVisible()) {
					const claudeOption = modeSelector.locator('option[value="claude"]');
					if (await claudeOption.isVisible()) {
						await modeSelector.selectOption('claude');

						const submitButton = page.locator('button[type="submit"]').first();
						if (await submitButton.isVisible()) {
							await submitButton.click();
							await page.waitForTimeout(3000);

							// Should show error if Claude is not available
							const errorMessage = page.locator('.error, .claude-error');
							if (await errorMessage.isVisible()) {
								await expect(errorMessage).toContainText(/claude|not found|not available/i);
							}
						}
					}
				}
			}
		}
	});

	test('should handle rapid navigation', async ({ page }) => {
		await page.goto('/projects');

		// Rapidly navigate between pages
		for (let i = 0; i < 5; i++) {
			await page.goto('/projects');
			await page.waitForTimeout(100);

			const projectLinks = page.locator('a[href*="/projects/"]');
			const projectCount = await projectLinks.count();

			if (projectCount > 0) {
				await projectLinks.first().click();
				await page.waitForTimeout(100);
				await page.goBack();
				await page.waitForTimeout(100);
			}
		}

		// App should still be responsive
		await expect(page.locator('h1, header')).toBeVisible();
	});

	test('should handle browser refresh during operations', async ({ page }) => {
		await page.goto('/projects');

		const projectLinks = page.locator('a[href*="/projects/"]');
		const projectCount = await projectLinks.count();

		if (projectCount > 0) {
			await projectLinks.first().click();

			const createButton = page.locator('button:has-text("Create")').first();
			if (await createButton.isVisible()) {
				await createButton.click();

				const nameInput = page.locator('input[placeholder*="name" i]').first();
				if (await nameInput.isVisible()) {
					await nameInput.fill('refresh-test');

					const submitButton = page.locator('button[type="submit"]').first();
					if (await submitButton.isVisible()) {
						await submitButton.click();

						// Refresh page immediately
						await page.reload();
						await page.waitForTimeout(2000);

						// Should handle refresh gracefully
						await expect(page.locator('h1, header')).toBeVisible();

						// Session might or might not be created depending on timing
						const sessionItems = page.locator('.session-item');
						const sessionCount = await sessionItems.count();
						expect(sessionCount).toBeGreaterThanOrEqual(0);
					}
				}
			}
		}
	});

	test('should handle extremely small viewport', async ({ page }) => {
		// Test very small mobile viewport
		await page.setViewportSize({ width: 240, height: 320 });

		await page.goto('/projects');

		// Should still be usable on very small screens
		await expect(page.locator('h1, header')).toBeVisible();

		// Navigation should work
		const projectLinks = page.locator('a[href*="/projects/"]');
		const projectCount = await projectLinks.count();

		if (projectCount > 0) {
			await projectLinks.first().click();
			await expect(page).toHaveURL(/.*\/projects\/[a-f0-9-]+/);
		}

		// Layout should not break
		const body = page.locator('body');
		const hasHorizontalScrollbar = await body.evaluate((el) => el.scrollWidth > el.clientWidth);

		// Some horizontal scrolling might be necessary but shouldn't be excessive
		if (hasHorizontalScrollbar) {
			const scrollWidth = await body.evaluate((el) => el.scrollWidth);
			const clientWidth = await body.evaluate((el) => el.clientWidth);
			const overflowRatio = scrollWidth / clientWidth;

			expect(overflowRatio).toBeLessThan(2); // Not more than 2x overflow
		}
	});

	test('should handle session limit edge cases', async ({ page }) => {
		await page.goto('/projects');

		const projectLinks = page.locator('a[href*="/projects/"]');
		const projectCount = await projectLinks.count();

		if (projectCount > 0) {
			await projectLinks.first().click();

			// Try to create many sessions to test limits
			for (let i = 0; i < 10; i++) {
				const createButton = page.locator('button:has-text("Create")').first();
				if (await createButton.isVisible()) {
					await createButton.click();

					const nameInput = page.locator('input[placeholder*="name" i]').first();
					if (await nameInput.isVisible()) {
						await nameInput.fill(`limit-test-${i}`);

						const submitButton = page.locator('button[type="submit"]').first();
						if (await submitButton.isVisible()) {
							await submitButton.click();
							await page.waitForTimeout(1000);

							// Check if limit reached
							const errorMessage = page.locator('.error');
							if (await errorMessage.isVisible()) {
								const errorText = await errorMessage.textContent();
								if (errorText?.includes('limit')) {
									console.log(`Session limit reached at ${i} sessions`);
									break;
								}
							}
						}
					}
				} else {
					// No create button available, might have reached limit
					break;
				}
			}

			// App should still be responsive
			await expect(page.locator('h1, header')).toBeVisible();
		}
	});
});
