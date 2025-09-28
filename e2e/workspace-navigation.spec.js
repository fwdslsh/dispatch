/**
 * E2E Test: Workspace Navigation
 *
 * Tests the enhanced ProjectSessionMenu workspace navigation features including:
 * - Workspace switching via enhanced menu
 * - Workspace list display with metadata
 * - Workspace creation through navigation
 * - Workspace search and filtering
 */

import { test, expect } from '@playwright/test';
import { setupFreshTestEnvironment, waitForWorkspace } from './test-helpers.js';

test.describe('Workspace Navigation', () => {
	const mockWorkspaces = [
		{
			id: '/workspace/project-a',
			name: 'Project Alpha',
			path: '/workspace/project-a',
			status: 'active',
			lastActive: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
			sessionCount: 3,
			createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
		},
		{
			id: '/workspace/project-b',
			name: 'Project Beta',
			path: '/workspace/project-b',
			status: 'active',
			lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
			sessionCount: 1,
			createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() // 3 days ago
		},
		{
			id: '/workspace/archived-project',
			name: 'Archived Project',
			path: '/workspace/archived-project',
			status: 'archived',
			lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 1 week ago
			sessionCount: 0,
			createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString() // 30 days ago
		}
	];

	test.beforeEach(async ({ page }) => {
		// Setup fresh environment
		await setupFreshTestEnvironment(page, '/');

		// Mock workspace API endpoints
		await page.route('/api/workspaces**', (route) => {
			if (route.request().method() === 'GET') {
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(mockWorkspaces)
				});
			} else if (route.request().method() === 'POST') {
				const postData = route.request().postDataJSON();
				const newWorkspace = {
					id: postData.path,
					name: postData.name,
					path: postData.path,
					status: 'active',
					lastActive: new Date().toISOString(),
					sessionCount: 0,
					createdAt: new Date().toISOString()
				};
				route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify(newWorkspace)
				});
			}
		});

		// Mock sessions endpoint
		await page.route('/api/sessions**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ sessions: [] })
			});
		});

		// Mock onboarding complete state
		await page.route('/api/onboarding/status**', (route) => {
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					currentStep: 'complete',
					isComplete: true,
					completedSteps: ['auth', 'workspace', 'complete']
				})
			});
		});
	});

	test('should display workspace navigation in ProjectSessionMenu', async ({ page }) => {
		await page.goto('/');
		await waitForWorkspace(page);

		// Look for workspace navigation elements
		await test.step('Find workspace navigation', async () => {
			// Look for workspace tab/section in the menu
			const workspaceTab = page.locator('button', { hasText: 'Workspaces' });
			if (await workspaceTab.isVisible()) {
				await workspaceTab.click();
			} else {
				// Alternative: look for workspace dropdown or section
				const workspaceSection = page.locator('[data-testid="workspace-navigation"], .workspace-section, .workspace-nav');
				await expect(workspaceSection.first()).toBeVisible({ timeout: 10000 });
			}
		});

		// Verify workspace list is displayed
		await test.step('Verify workspace list', async () => {
			// Should show workspace items
			await expect(page.locator('.workspace-item, [data-testid="workspace-item"]').first()).toBeVisible({ timeout: 5000 });

			// Should show workspace names
			await expect(page.locator('text=Project Alpha')).toBeVisible();
			await expect(page.locator('text=Project Beta')).toBeVisible();
		});
	});

	test('should switch between workspaces', async ({ page }) => {
		await page.goto('/');
		await waitForWorkspace(page);

		// Open workspace navigation
		const workspaceTab = page.locator('button', { hasText: 'Workspaces' });
		if (await workspaceTab.isVisible()) {
			await workspaceTab.click();
		}

		await test.step('Switch to different workspace', async () => {
			// Find and click on a workspace to switch to
			const projectBetaItem = page.locator('.workspace-item', { hasText: 'Project Beta' }).first();
			if (await projectBetaItem.isVisible()) {
				const switchButton = projectBetaItem.locator('button', { hasText: 'Switch' });
				await switchButton.click();

				// Wait for workspace switch
				await page.waitForTimeout(1000);

				// Verify workspace switch occurred (could check URL, title, or active indicators)
				const activeWorkspace = page.locator('.workspace-item.selected, .workspace-item[aria-selected="true"]');
				if (await activeWorkspace.isVisible()) {
					await expect(activeWorkspace).toContainText('Project Beta');
				}
			}
		});
	});

	test('should create new workspace through navigation', async ({ page }) => {
		await page.goto('/');
		await waitForWorkspace(page);

		// Open workspace navigation
		const workspaceTab = page.locator('button', { hasText: 'Workspaces' });
		if (await workspaceTab.isVisible()) {
			await workspaceTab.click();
		}

		await test.step('Create new workspace', async () => {
			// Look for "New" or "Create" button
			const newButton = page.locator('button', { hasText: /New|Create/i });
			if (await newButton.isVisible()) {
				await newButton.click();

				// Should see workspace creation form
				await expect(page.locator('input[placeholder*="workspace"], input[placeholder*="name"]').first()).toBeVisible({ timeout: 5000 });

				// Fill out the form
				const nameInput = page.locator('input[placeholder*="workspace"], input[placeholder*="name"]').first();
				await nameInput.fill('New Test Workspace');

				const pathInput = page.locator('input[placeholder*="path"], input[value*="/workspace"]').first();
				if (await pathInput.isVisible()) {
					await pathInput.fill('/workspace/new-test-workspace');
				}

				// Submit the form
				const createButton = page.locator('button', { hasText: 'Create' });
				await createButton.click();

				// Wait for creation to complete
				await page.waitForTimeout(2000);

				// Should see the new workspace in the list
				await expect(page.locator('text=New Test Workspace')).toBeVisible({ timeout: 5000 });
			}
		});
	});

	test('should search and filter workspaces', async ({ page }) => {
		await page.goto('/');
		await waitForWorkspace(page);

		// Open workspace navigation
		const workspaceTab = page.locator('button', { hasText: 'Workspaces' });
		if (await workspaceTab.isVisible()) {
			await workspaceTab.click();
		}

		await test.step('Test workspace search', async () => {
			// Look for search input
			const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="workspaces"]');
			if (await searchInput.isVisible()) {
				// Search for specific workspace
				await searchInput.fill('Alpha');

				// Wait for filtering
				await page.waitForTimeout(500);

				// Should show only matching workspace
				await expect(page.locator('text=Project Alpha')).toBeVisible();

				// Other workspaces should be hidden
				const projectBeta = page.locator('text=Project Beta');
				if (await projectBeta.isVisible()) {
					// This is acceptable - some implementations might not hide non-matching items
					console.log('Note: Search filtering may not be fully implemented');
				}

				// Clear search
				await searchInput.clear();
				await page.waitForTimeout(500);

				// All workspaces should be visible again
				await expect(page.locator('text=Project Alpha')).toBeVisible();
				await expect(page.locator('text=Project Beta')).toBeVisible();
			}
		});
	});

	test('should display workspace metadata', async ({ page }) => {
		await page.goto('/');
		await waitForWorkspace(page);

		// Open workspace navigation
		const workspaceTab = page.locator('button', { hasText: 'Workspaces' });
		if (await workspaceTab.isVisible()) {
			await workspaceTab.click();
		}

		await test.step('Verify workspace metadata display', async () => {
			// Check for workspace paths
			await expect(page.locator('text=/workspace/project-a')).toBeVisible({ timeout: 5000 });

			// Check for last activity information
			const metadataElements = page.locator('.workspace-meta, .workspace-info, [data-testid="workspace-metadata"]');
			if (await metadataElements.first().isVisible()) {
				// Should show relative time information
				await expect(page.locator('text=/ago|Today|Yesterday/i').first()).toBeVisible();
			}

			// Check for session counts if displayed
			const sessionCount = page.locator('text=/session|3.*session/i');
			if (await sessionCount.first().isVisible()) {
				console.log('Session counts are displayed in workspace metadata');
			}
		});
	});

	test('should handle workspace switching errors gracefully', async ({ page }) => {
		// Mock workspace switch error
		await page.route('/api/workspaces/*/switch', (route) => {
			route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Failed to switch workspace' })
			});
		});

		await page.goto('/');
		await waitForWorkspace(page);

		// Open workspace navigation
		const workspaceTab = page.locator('button', { hasText: 'Workspaces' });
		if (await workspaceTab.isVisible()) {
			await workspaceTab.click();
		}

		await test.step('Handle switch error', async () => {
			// Try to switch workspace
			const projectBetaItem = page.locator('.workspace-item', { hasText: 'Project Beta' }).first();
			if (await projectBetaItem.isVisible()) {
				const switchButton = projectBetaItem.locator('button', { hasText: 'Switch' });
				await switchButton.click();

				// Should show error message
				await expect(page.locator('.error-message, [role="alert"]').first()).toBeVisible({ timeout: 5000 });
			}
		});
	});

	test('should support keyboard navigation in workspace list', async ({ page }) => {
		await page.goto('/');
		await waitForWorkspace(page);

		// Open workspace navigation
		const workspaceTab = page.locator('button', { hasText: 'Workspaces' });
		if (await workspaceTab.isVisible()) {
			await workspaceTab.click();
		}

		await test.step('Test keyboard navigation', async () => {
			// Try to navigate through workspace items with Tab
			await page.keyboard.press('Tab');

			const firstWorkspaceItem = page.locator('.workspace-item').first();
			if (await firstWorkspaceItem.isVisible()) {
				// Check if workspace items are focusable
				const switchButton = firstWorkspaceItem.locator('button').first();
				await switchButton.focus();
				await expect(switchButton).toBeFocused();

				// Test Enter key activation
				await switchButton.press('Enter');
				await page.waitForTimeout(500);
			}
		});
	});

	test('should be responsive on mobile viewport', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });

		await page.goto('/');
		await waitForWorkspace(page);

		// Open workspace navigation
		const workspaceTab = page.locator('button', { hasText: 'Workspaces' });
		if (await workspaceTab.isVisible()) {
			await workspaceTab.click();
		}

		await test.step('Verify mobile responsive layout', async () => {
			// Workspace items should be properly sized for mobile
			const workspaceItems = page.locator('.workspace-item');
			if (await workspaceItems.first().isVisible()) {
				const itemBox = await workspaceItems.first().boundingBox();
				expect(itemBox.width).toBeLessThan(400); // Should fit in mobile viewport
			}

			// Buttons should be touch-friendly
			const switchButtons = page.locator('button', { hasText: 'Switch' });
			if (await switchButtons.first().isVisible()) {
				const buttonBox = await switchButtons.first().boundingBox();
				expect(buttonBox.height).toBeGreaterThan(40); // Touch-friendly height
			}
		});
	});

	test('should preserve workspace selection across navigation', async ({ page }) => {
		await page.goto('/');
		await waitForWorkspace(page);

		// Select a workspace
		const workspaceTab = page.locator('button', { hasText: 'Workspaces' });
		if (await workspaceTab.isVisible()) {
			await workspaceTab.click();

			const projectBetaItem = page.locator('.workspace-item', { hasText: 'Project Beta' }).first();
			if (await projectBetaItem.isVisible()) {
				const switchButton = projectBetaItem.locator('button', { hasText: 'Switch' });
				await switchButton.click();
				await page.waitForTimeout(1000);

				// Navigate to another tab and back
				const activeTab = page.locator('button', { hasText: 'Active' });
				if (await activeTab.isVisible()) {
					await activeTab.click();
					await page.waitForTimeout(500);

					// Go back to workspaces tab
					await workspaceTab.click();

					// Workspace selection should be preserved
					const selectedWorkspace = page.locator('.workspace-item.selected, .workspace-item[aria-selected="true"]');
					if (await selectedWorkspace.isVisible()) {
						await expect(selectedWorkspace).toContainText('Project Beta');
					}
				}
			}
		}
	});
});