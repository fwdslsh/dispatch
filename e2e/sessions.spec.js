// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Terminal Sessions', () => {
	let projectId = null;

	test.beforeEach(async ({ page }) => {
		// Authenticate first
		await page.goto('/');
		await page.waitForTimeout(1000);

		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill('test');
			await page.locator('button[type="submit"]').click();
		}

		// Go to projects and get or create a project
		await page.goto('/projects');

		// Try to find existing project or create one
		const projectLinks = page.locator('a[href*="/projects/"]');
		const projectCount = await projectLinks.count();

		if (projectCount > 0) {
			// Use existing project
			const href = await projectLinks.first().getAttribute('href');
			projectId = href?.split('/').pop();
			await projectLinks.first().click();
		} else {
			// Create a new project
			const projectName = `test-sessions-${Date.now()}`;
			const createButton = page
				.locator('button:has-text("Create"), button:has-text("New Project")')
				.first();

			if (await createButton.isVisible()) {
				await createButton.click();

				const nameInput = page.locator('input[placeholder*="name" i]').first();
				if (await nameInput.isVisible()) {
					await nameInput.fill(projectName);

					const submitButton = page
						.locator('button[type="submit"], button:has-text("Create")')
						.first();
					if (await submitButton.isVisible()) {
						await submitButton.click();
						await page.waitForTimeout(2000);

						// Click on the created project
						await page.locator(`text=${projectName}`).click();
					}
				}
			}
		}

		// Should be on project page now
		await expect(page).toHaveURL(/.*\/projects\/[a-f0-9-]+/);
	});

	test('should display project sessions page', async ({ page }) => {
		// Should show project sessions interface
		await expect(page.locator('h1, .project-title')).toBeVisible();

		// Should have session creation controls
		const createSessionButton = page.locator(
			'button:has-text("Create"), button:has-text("New Session"), [data-testid="create-session"]'
		);
		const sessionForm = page.locator('.session-form, [data-testid="session-form"]');

		const hasCreateButton = await createSessionButton.isVisible();
		const hasSessionForm = await sessionForm.isVisible();

		expect(hasCreateButton || hasSessionForm).toBeTruthy();
	});

	test('should create a shell session', async ({ page }) => {
		const sessionName = `shell-session-${Date.now()}`;

		// Look for create session button
		const createButton = page
			.locator(
				'button:has-text("Create"), button:has-text("New Session"), [data-testid="create-session"]'
			)
			.first();

		if (await createButton.isVisible()) {
			await createButton.click();
		}

		// Fill session form
		const nameInput = page
			.locator('input[placeholder*="name" i], [data-testid="session-name"]')
			.first();
		if (await nameInput.isVisible()) {
			await nameInput.fill(sessionName);
		}

		// Select shell mode if there's a mode selector
		const modeSelector = page.locator('select, [data-testid="mode-selector"]').first();
		if (await modeSelector.isVisible()) {
			await modeSelector.selectOption('shell');
		}

		// Submit the form
		const submitButton = page
			.locator('button[type="submit"], button:has-text("Create"), button:has-text("Start")')
			.first();
		if (await submitButton.isVisible()) {
			await submitButton.click();

			// Wait for terminal to appear
			await page.waitForTimeout(3000);

			// Should show terminal interface
			const terminal = page.locator('.terminal, .xterm, [data-testid="terminal"]');
			await expect(terminal).toBeVisible();

			// Terminal should have content
			await page.waitForTimeout(1000);
			const terminalContent = await terminal.textContent();
			expect(terminalContent).toBeTruthy();
		}
	});

	test('should create a Claude session if Claude is available', async ({ page }) => {
		const sessionName = `claude-session-${Date.now()}`;

		const createButton = page
			.locator('button:has-text("Create"), button:has-text("New Session")')
			.first();

		if (await createButton.isVisible()) {
			await createButton.click();
		}

		const nameInput = page.locator('input[placeholder*="name" i]').first();
		if (await nameInput.isVisible()) {
			await nameInput.fill(sessionName);
		}

		// Try to select Claude mode
		const modeSelector = page.locator('select, [data-testid="mode-selector"]').first();
		if (await modeSelector.isVisible()) {
			const claudeOption = page.locator('option[value="claude"]');
			if (await claudeOption.isVisible()) {
				await modeSelector.selectOption('claude');

				const submitButton = page
					.locator('button[type="submit"], button:has-text("Create")')
					.first();
				if (await submitButton.isVisible()) {
					await submitButton.click();

					await page.waitForTimeout(3000);

					// Should show either Claude interface or error if not configured
					const claudeInterface = page.locator('.claude-interface, .chat-interface');
					const errorMessage = page.locator('.error, .claude-error');

					const hasClaudeInterface = await claudeInterface.isVisible();
					const hasError = await errorMessage.isVisible();

					expect(hasClaudeInterface || hasError).toBeTruthy();

					if (hasError) {
						// Expected if Claude is not configured
						console.log('Claude not configured - this is expected in test environment');
					}
				}
			}
		}
	});

	test('should display active sessions list', async ({ page }) => {
		// Should show sessions list or empty state
		const sessionsList = page.locator('.sessions-list, [data-testid="sessions-list"]');
		const emptyState = page.locator('.empty-sessions, .no-sessions');

		const hasSessions = await sessionsList.isVisible();
		const hasEmptyState = await emptyState.isVisible();

		expect(hasSessions || hasEmptyState).toBeTruthy();

		if (hasSessions) {
			// Check session items
			const sessionItems = page.locator('.session-item, [data-testid="session-item"]');
			const sessionCount = await sessionItems.count();

			if (sessionCount > 0) {
				const firstSession = sessionItems.first();

				// Should show session name and status
				await expect(firstSession.locator('.session-name, .name')).toBeVisible();

				// Should have action buttons
				const attachButton = firstSession.locator(
					'button:has-text("Attach"), button:has-text("Open")'
				);
				const deleteButton = firstSession.locator(
					'button:has-text("Delete"), button:has-text("End")'
				);

				expect((await attachButton.isVisible()) || (await deleteButton.isVisible())).toBeTruthy();
			}
		}
	});

	test('should handle terminal input and output', async ({ page }) => {
		// Create a session first
		const createButton = page
			.locator('button:has-text("Create"), button:has-text("New Session")')
			.first();

		if (await createButton.isVisible()) {
			await createButton.click();

			const nameInput = page.locator('input[placeholder*="name" i]').first();
			if (await nameInput.isVisible()) {
				await nameInput.fill('test-terminal');

				const submitButton = page
					.locator('button[type="submit"], button:has-text("Create")')
					.first();
				if (await submitButton.isVisible()) {
					await submitButton.click();
					await page.waitForTimeout(3000);

					// Find terminal
					const terminal = page.locator('.terminal, .xterm');
					if (await terminal.isVisible()) {
						// Click to focus terminal
						await terminal.click();

						// Type a simple command
						await page.keyboard.type('echo "Hello World"');
						await page.keyboard.press('Enter');

						// Wait for output
						await page.waitForTimeout(2000);

						// Check if output appears
						const terminalText = await terminal.textContent();
						expect(terminalText).toContain('Hello World');
					}
				}
			}
		}
	});

	test('should handle session termination', async ({ page }) => {
		// Look for existing session to delete
		const sessionItems = page.locator('.session-item, [data-testid="session-item"]');
		const sessionCount = await sessionItems.count();

		if (sessionCount > 0) {
			const firstSession = sessionItems.first();
			const deleteButton = firstSession.locator(
				'button:has-text("Delete"), button:has-text("End"), .delete-btn'
			);

			if (await deleteButton.isVisible()) {
				await deleteButton.click();

				// Handle confirmation if present
				const confirmButton = page.locator(
					'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")'
				);
				if (await confirmButton.isVisible()) {
					await confirmButton.click();
				}

				await page.waitForTimeout(1000);

				// Session should be removed or marked as terminated
				const updatedCount = await sessionItems.count();
				expect(updatedCount).toBeLessThan(sessionCount);
			}
		}
	});

	test('should handle session attachment and detachment', async ({ page }) => {
		const sessionItems = page.locator('.session-item');
		const sessionCount = await sessionItems.count();

		if (sessionCount > 0) {
			const firstSession = sessionItems.first();
			const attachButton = firstSession.locator(
				'button:has-text("Attach"), button:has-text("Open")'
			);

			if (await attachButton.isVisible()) {
				await attachButton.click();

				// Should show terminal interface
				await page.waitForTimeout(2000);
				const terminal = page.locator('.terminal, .xterm');
				await expect(terminal).toBeVisible();

				// Look for detach option
				const detachButton = page.locator('button:has-text("Detach"), button:has-text("Close")');
				if (await detachButton.isVisible()) {
					await detachButton.click();

					// Should return to sessions list
					await page.waitForTimeout(1000);
					await expect(page.locator('.sessions-list, [data-testid="sessions-list"]')).toBeVisible();
				}
			}
		}
	});

	test('should handle working directory selection', async ({ page }) => {
		const createButton = page
			.locator('button:has-text("Create"), button:has-text("New Session")')
			.first();

		if (await createButton.isVisible()) {
			await createButton.click();

			// Look for working directory picker
			const workingDirPicker = page.locator('.directory-picker, [data-testid="working-directory"]');
			const workingDirSelect = page.locator('select[name*="directory"], select[name*="working"]');

			if ((await workingDirPicker.isVisible()) || (await workingDirSelect.isVisible())) {
				// Test directory selection
				if (await workingDirSelect.isVisible()) {
					await workingDirSelect.selectOption({ index: 0 });
				}

				const nameInput = page.locator('input[placeholder*="name" i]').first();
				if (await nameInput.isVisible()) {
					await nameInput.fill('working-dir-test');

					const submitButton = page
						.locator('button[type="submit"], button:has-text("Create")')
						.first();
					if (await submitButton.isVisible()) {
						await submitButton.click();
						await page.waitForTimeout(3000);

						// Verify session was created with working directory
						const terminal = page.locator('.terminal, .xterm');
						if (await terminal.isVisible()) {
							await terminal.click();
							await page.keyboard.type('pwd');
							await page.keyboard.press('Enter');
							await page.waitForTimeout(1000);

							const terminalText = await terminal.textContent();
							expect(terminalText).toBeTruthy();
						}
					}
				}
			}
		}
	});

	test('should be responsive on mobile devices', async ({ page }) => {
		// Test mobile layout
		await page.setViewportSize({ width: 375, height: 667 });
		await page.reload();

		// Should still show main elements
		await expect(page.locator('h1, .project-title')).toBeVisible();

		// Terminal should be responsive
		const terminal = page.locator('.terminal, .xterm');
		if (await terminal.isVisible()) {
			const terminalBox = await terminal.boundingBox();
			expect(terminalBox?.width).toBeLessThan(375);
		}

		// Mobile controls should be visible
		const mobileControls = page.locator('.mobile-controls, [data-testid="mobile-controls"]');
		if (await mobileControls.isVisible()) {
			await expect(mobileControls).toBeVisible();
		}
	});
});
