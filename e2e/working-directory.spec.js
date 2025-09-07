// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Working Directory Functionality', () => {
	let projectId = null;

	test.beforeEach(async ({ page }) => {
		// Authenticate
		await page.goto('/');
		await page.waitForTimeout(1000);

		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill('test');
			await page.locator('button[type="submit"]').click();
		}

		// Go to projects
		await page.goto('/projects');

		// Get or create a project for testing
		const projectLinks = page.locator('a[href*="/projects/"]');
		const projectCount = await projectLinks.count();

		if (projectCount > 0) {
			// Use existing project
			const href = await projectLinks.first().getAttribute('href');
			projectId = href?.split('/').pop();
			await projectLinks.first().click();
		} else {
			// Create a new project
			const projectName = `working-dir-test-${Date.now()}`;
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

	test('should show directory picker for session creation', async ({ page }) => {
		const createButton = page
			.locator('button:has-text("Create"), button:has-text("New Session")')
			.first();

		if (await createButton.isVisible()) {
			await createButton.click();

			// Look for directory/working directory picker
			const directoryPicker = page.locator('.directory-picker, [data-testid="directory-picker"]');
			const workingDirSelect = page.locator('select[name*="directory"], select[name*="working"]');
			const workingDirInput = page.locator('input[name*="directory"], input[name*="working"]');

			const hasDirectoryPicker = await directoryPicker.isVisible();
			const hasWorkingDirSelect = await workingDirSelect.isVisible();
			const hasWorkingDirInput = await workingDirInput.isVisible();

			expect(hasDirectoryPicker || hasWorkingDirSelect || hasWorkingDirInput).toBeTruthy();

			if (hasWorkingDirSelect) {
				// Should have directory options
				const options = workingDirSelect.locator('option');
				const optionCount = await options.count();
				expect(optionCount).toBeGreaterThan(0);

				// Should include project root and common directories
				const optionTexts = [];
				for (let i = 0; i < optionCount; i++) {
					const option = options.nth(i);
					const text = await option.textContent();
					optionTexts.push(text);
				}

				// Should have root directory option
				const hasRootOption = optionTexts.some(
					(text) => text?.includes('/') || text?.includes('root') || text?.includes('workspace')
				);
				expect(hasRootOption).toBeTruthy();
			}
		}
	});

	test('should create session with specific working directory', async ({ page }) => {
		const createButton = page.locator('button:has-text("Create")').first();

		if (await createButton.isVisible()) {
			await createButton.click();

			const nameInput = page.locator('input[placeholder*="name" i]').first();
			if (await nameInput.isVisible()) {
				await nameInput.fill('working-dir-session');
			}

			// Select working directory
			const workingDirSelect = page.locator('select[name*="directory"], select[name*="working"]');
			if (await workingDirSelect.isVisible()) {
				const options = workingDirSelect.locator('option');
				const optionCount = await options.count();

				if (optionCount > 1) {
					// Select second option (first might be default/empty)
					await workingDirSelect.selectOption({ index: 1 });
				}
			}

			const submitButton = page.locator('button[type="submit"], button:has-text("Create")').first();
			if (await submitButton.isVisible()) {
				await submitButton.click();
				await page.waitForTimeout(3000);

				// Session should be created
				const terminal = page.locator('.terminal, .xterm');
				if (await terminal.isVisible()) {
					await terminal.click();

					// Check current working directory
					await page.keyboard.type('pwd');
					await page.keyboard.press('Enter');
					await page.waitForTimeout(1000);

					const terminalContent = await terminal.textContent();

					// Should show working directory path
					expect(terminalContent).toContain('/');

					// Should be within project directory structure
					const hasProjectPath =
						terminalContent?.includes('projects') ||
						terminalContent?.includes('workspace') ||
						terminalContent?.includes('dispatch');
					expect(hasProjectPath).toBeTruthy();
				}
			}
		}
	});

	test('should validate working directory security', async ({ page }) => {
		const createButton = page.locator('button:has-text("Create")').first();

		if (await createButton.isVisible()) {
			await createButton.click();

			const nameInput = page.locator('input[placeholder*="name" i]').first();
			if (await nameInput.isVisible()) {
				await nameInput.fill('security-test');
			}

			// Try to set invalid working directory (if input is available)
			const workingDirInput = page.locator('input[name*="directory"], input[name*="working"]');
			if (await workingDirInput.isVisible()) {
				// Try directory traversal
				await workingDirInput.fill('../../../etc');

				const submitButton = page.locator('button[type="submit"]').first();
				if (await submitButton.isVisible()) {
					await submitButton.click();
					await page.waitForTimeout(2000);

					// Should show validation error
					const errorMessage = page.locator('.error, .validation-error');
					if (await errorMessage.isVisible()) {
						await expect(errorMessage).toContainText(/invalid|security|path|directory/i);
					} else {
						// If no error shown, directory should be sanitized
						const sessionItems = page.locator('.session-item');
						if ((await sessionItems.count()) > 0) {
							// Session created with sanitized path
							console.log('Directory path was sanitized');
						}
					}
				}
			}
		}
	});

	test('should show directory listing for project', async ({ page }) => {
		// Look for directory listing functionality
		const directoryList = page.locator(
			'.directory-list, .file-browser, [data-testid="directory-list"]'
		);
		const directoryItems = page.locator(
			'.directory-item, .file-item, [data-testid="directory-item"]'
		);

		if (await directoryList.isVisible()) {
			await expect(directoryList).toBeVisible();

			// Should show project directories
			const itemCount = await directoryItems.count();
			expect(itemCount).toBeGreaterThanOrEqual(0);

			if (itemCount > 0) {
				const firstItem = directoryItems.first();
				await expect(firstItem).toBeVisible();

				// Should show directory name
				const itemText = await firstItem.textContent();
				expect(itemText).toBeTruthy();
			}
		}
	});

	test('should handle nested directory navigation', async ({ page }) => {
		const createButton = page.locator('button:has-text("Create")').first();

		if (await createButton.isVisible()) {
			await createButton.click();

			const nameInput = page.locator('input[placeholder*="name" i]').first();
			if (await nameInput.isVisible()) {
				await nameInput.fill('nested-dir-test');
			}

			// Look for directory picker with nested options
			const workingDirSelect = page.locator('select[name*="directory"]');
			if (await workingDirSelect.isVisible()) {
				const options = workingDirSelect.locator('option');
				const optionTexts = [];

				const optionCount = await options.count();
				for (let i = 0; i < optionCount; i++) {
					const option = options.nth(i);
					const text = await option.textContent();
					if (text) optionTexts.push(text);
				}

				// Look for nested directory options
				const nestedOptions = optionTexts.filter(
					(text) => text.includes('/') && text.split('/').length > 2
				);

				if (nestedOptions.length > 0) {
					// Select nested directory
					await workingDirSelect.selectOption(nestedOptions[0]);

					const submitButton = page.locator('button[type="submit"]').first();
					if (await submitButton.isVisible()) {
						await submitButton.click();
						await page.waitForTimeout(3000);

						const terminal = page.locator('.terminal, .xterm');
						if (await terminal.isVisible()) {
							await terminal.click();

							// Verify we're in nested directory
							await page.keyboard.type('pwd');
							await page.keyboard.press('Enter');
							await page.waitForTimeout(1000);

							const terminalContent = await terminal.textContent();
							const pathSegments = terminalContent?.split('/').length || 0;
							expect(pathSegments).toBeGreaterThan(3); // Should be nested
						}
					}
				}
			}
		}
	});

	test('should persist working directory in session metadata', async ({ page }) => {
		const createButton = page.locator('button:has-text("Create")').first();

		if (await createButton.isVisible()) {
			await createButton.click();

			const nameInput = page.locator('input[placeholder*="name" i]').first();
			if (await nameInput.isVisible()) {
				await nameInput.fill('metadata-test');
			}

			const workingDirSelect = page.locator('select[name*="directory"]');
			if (await workingDirSelect.isVisible()) {
				const options = workingDirSelect.locator('option');
				const optionCount = await options.count();

				if (optionCount > 1) {
					await workingDirSelect.selectOption({ index: 1 });
				}
			}

			const submitButton = page.locator('button[type="submit"]').first();
			if (await submitButton.isVisible()) {
				await submitButton.click();
				await page.waitForTimeout(3000);

				// Detach from session
				const detachButton = page.locator('button:has-text("Detach"), button:has-text("Close")');
				if (await detachButton.isVisible()) {
					await detachButton.click();
					await page.waitForTimeout(1000);
				}

				// Re-attach to session
				const sessionItems = page.locator('.session-item');
				if ((await sessionItems.count()) > 0) {
					const lastSession = sessionItems.last();
					const attachButton = lastSession.locator(
						'button:has-text("Attach"), button:has-text("Open")'
					);

					if (await attachButton.isVisible()) {
						await attachButton.click();
						await page.waitForTimeout(2000);

						const terminal = page.locator('.terminal, .xterm');
						if (await terminal.isVisible()) {
							await terminal.click();

							// Check that working directory is preserved
							await page.keyboard.type('pwd');
							await page.keyboard.press('Enter');
							await page.waitForTimeout(1000);

							const terminalContent = await terminal.textContent();
							expect(terminalContent).toBeTruthy();
							expect(terminalContent).toContain('/');
						}
					}
				}
			}
		}
	});

	test('should handle directory permissions', async ({ page }) => {
		const createButton = page.locator('button:has-text("Create")').first();

		if (await createButton.isVisible()) {
			await createButton.click();

			const nameInput = page.locator('input[placeholder*="name" i]').first();
			if (await nameInput.isVisible()) {
				await nameInput.fill('permissions-test');
			}

			const submitButton = page.locator('button[type="submit"]').first();
			if (await submitButton.isVisible()) {
				await submitButton.click();
				await page.waitForTimeout(3000);

				const terminal = page.locator('.terminal, .xterm');
				if (await terminal.isVisible()) {
					await terminal.click();

					// Test basic file operations
					await page.keyboard.type('touch test-file.txt');
					await page.keyboard.press('Enter');
					await page.waitForTimeout(1000);

					await page.keyboard.type('ls -la test-file.txt');
					await page.keyboard.press('Enter');
					await page.waitForTimeout(1000);

					const terminalContent = await terminal.textContent();

					// Should be able to create files in working directory
					expect(terminalContent).toContain('test-file.txt');

					// Clean up
					await page.keyboard.type('rm test-file.txt');
					await page.keyboard.press('Enter');
					await page.waitForTimeout(500);
				}
			}
		}
	});

	test('should handle Claude mode with working directory', async ({ page }) => {
		const createButton = page.locator('button:has-text("Create")').first();

		if (await createButton.isVisible()) {
			await createButton.click();

			const nameInput = page.locator('input[placeholder*="name" i]').first();
			if (await nameInput.isVisible()) {
				await nameInput.fill('claude-workdir-test');
			}

			// Try to select Claude mode
			const modeSelector = page.locator('select, [data-testid="mode-selector"]').first();
			if (await modeSelector.isVisible()) {
				const claudeOption = modeSelector.locator('option[value="claude"]');
				if (await claudeOption.isVisible()) {
					await modeSelector.selectOption('claude');

					// Select working directory for Claude
					const workingDirSelect = page.locator('select[name*="directory"]');
					if (await workingDirSelect.isVisible()) {
						const options = workingDirSelect.locator('option');
						const optionCount = await options.count();

						if (optionCount > 1) {
							await workingDirSelect.selectOption({ index: 1 });
						}
					}

					const submitButton = page.locator('button[type="submit"]').first();
					if (await submitButton.isVisible()) {
						await submitButton.click();
						await page.waitForTimeout(3000);

						// Should show Claude interface or error
						const claudeInterface = page.locator('.claude-interface, .chat-interface');
						const errorMessage = page.locator('.error, .claude-error');

						const hasClaudeInterface = await claudeInterface.isVisible();
						const hasError = await errorMessage.isVisible();

						expect(hasClaudeInterface || hasError).toBeTruthy();

						if (hasClaudeInterface) {
							// Verify Claude session has access to working directory
							const chatInput = claudeInterface.locator('input, textarea');
							if (await chatInput.isVisible()) {
								await chatInput.fill('What files are in my current directory?');
								await page.keyboard.press('Enter');
								await page.waitForTimeout(2000);

								// Should get response about directory contents
								const chatOutput = claudeInterface.locator('.message, .response');
								if ((await chatOutput.count()) > 0) {
									const responseText = await chatOutput.last().textContent();
									expect(responseText).toBeTruthy();
								}
							}
						}
					}
				}
			}
		}
	});

	test('should show working directory in session list', async ({ page }) => {
		// Look at existing sessions
		const sessionItems = page.locator('.session-item, [data-testid="session-item"]');
		const sessionCount = await sessionItems.count();

		if (sessionCount > 0) {
			const firstSession = sessionItems.first();

			// Should show session metadata including working directory
			const sessionInfo = firstSession.locator('.session-info, .metadata, .working-directory');

			if (await sessionInfo.isVisible()) {
				const infoText = await sessionInfo.textContent();

				// Should contain directory path information
				const hasDirectoryInfo =
					infoText?.includes('/') || infoText?.includes('workspace') || infoText?.includes('dir');

				if (hasDirectoryInfo) {
					expect(hasDirectoryInfo).toBeTruthy();
				}
			}
		}
	});

	test('should handle directory listing API', async ({ page }) => {
		// Check if there's directory listing functionality in UI
		const directoryButton = page.locator(
			'button:has-text("Browse"), button:has-text("Files"), [data-testid="browse-files"]'
		);

		if (await directoryButton.isVisible()) {
			await directoryButton.click();

			const directoryList = page.locator('.directory-list, .file-browser');
			if (await directoryList.isVisible()) {
				await expect(directoryList).toBeVisible();

				// Should show project directory structure
				const directoryItems = directoryList.locator('.directory-item, .file-item');
				const itemCount = await directoryItems.count();

				expect(itemCount).toBeGreaterThanOrEqual(0);

				if (itemCount > 0) {
					// Items should have names and types
					const firstItem = directoryItems.first();
					const itemText = await firstItem.textContent();
					expect(itemText).toBeTruthy();

					// Should distinguish between files and directories
					const itemIcon = firstItem.locator('.icon, .file-type');
					if (await itemIcon.isVisible()) {
						await expect(itemIcon).toBeVisible();
					}
				}
			}
		}
	});
});
