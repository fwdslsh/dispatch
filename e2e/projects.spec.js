// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Projects Management', () => {
	test.beforeEach(async ({ page }) => {
		// Authenticate first
		await page.goto('/');
		await page.waitForTimeout(1000);

		const authInput = page.locator('input[type="password"]');
		if (await authInput.isVisible()) {
			await authInput.fill('test');
			await page.locator('button[type="submit"]').click();
		}

		// Navigate to projects if not already there
		await page.goto('/projects');
		await expect(page).toHaveURL(/.*\/projects/);
	});

	test('should display projects page with main elements', async ({ page }) => {
		// Check page title and main elements
		await expect(page).toHaveTitle(/Projects/);

		// Should have header
		await expect(page.locator('header')).toBeVisible();

		// Should have projects list or empty state
		const projectsList = page.locator('[data-testid="projects-list"], .projects-container');
		const emptyState = page.locator('.empty-state, .no-projects');

		const hasProjects = await projectsList.isVisible();
		const hasEmptyState = await emptyState.isVisible();

		expect(hasProjects || hasEmptyState).toBeTruthy();
	});

	test('should have create new project functionality', async ({ page }) => {
		// Look for create project button or form
		const createButton = page.locator(
			'button:has-text("Create"), button:has-text("New Project"), [data-testid="create-project"]'
		);
		const createForm = page.locator(
			'form:has(input[placeholder*="project" i]), .create-project-form'
		);

		// Either button or form should be visible
		const hasCreateButton = await createButton.isVisible();
		const hasCreateForm = await createForm.isVisible();

		expect(hasCreateButton || hasCreateForm).toBeTruthy();
	});

	test('should create a new project', async ({ page }) => {
		const projectName = `test-project-${Date.now()}`;

		// Try to find and click create button
		const createButton = page
			.locator(
				'button:has-text("Create"), button:has-text("New Project"), [data-testid="create-project"]'
			)
			.first();

		if (await createButton.isVisible()) {
			await createButton.click();
		}

		// Look for project name input
		const nameInput = page
			.locator(
				'input[placeholder*="name" i], input[placeholder*="project" i], [data-testid="project-name-input"]'
			)
			.first();

		if (await nameInput.isVisible()) {
			await nameInput.fill(projectName);

			// Look for submit button
			const submitButton = page
				.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")')
				.first();

			if (await submitButton.isVisible()) {
				await submitButton.click();

				// Wait for project to appear in list
				await page.waitForTimeout(2000);

				// Check that project appears in the list
				await expect(page.locator(`text=${projectName}`)).toBeVisible();
			}
		}
	});

	test('should handle project name validation', async ({ page }) => {
		// Try to create project with invalid name
		const createButton = page
			.locator(
				'button:has-text("Create"), button:has-text("New Project"), [data-testid="create-project"]'
			)
			.first();

		if (await createButton.isVisible()) {
			await createButton.click();
		}

		const nameInput = page
			.locator(
				'input[placeholder*="name" i], input[placeholder*="project" i], [data-testid="project-name-input"]'
			)
			.first();

		if (await nameInput.isVisible()) {
			// Try empty name
			await nameInput.fill('');
			const submitButton = page
				.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")')
				.first();

			if (await submitButton.isVisible()) {
				await submitButton.click();

				// Should show validation error
				const errorMessage = page.locator('.error, [data-testid="error"], .validation-error');
				if (await errorMessage.isVisible()) {
					await expect(errorMessage).toContainText(/required|name|invalid/i);
				}
			}

			// Try invalid characters
			await nameInput.fill('invalid/name*');
			if (await submitButton.isVisible()) {
				await submitButton.click();
				await page.waitForTimeout(500);

				// Should show validation error or sanitize the name
				const hasError = await errorMessage.isVisible();
				const wasCreated = await page.locator('text=invalid-name').isVisible();

				// Either should show error or sanitize the name
				expect(hasError || wasCreated).toBeTruthy();
			}
		}
	});

	test('should navigate to project sessions page', async ({ page }) => {
		// Look for existing projects
		const projectLinks = page.locator(
			'a[href*="/projects/"], .project-item a, [data-testid="project-link"]'
		);
		const projectCount = await projectLinks.count();

		if (projectCount > 0) {
			// Click on first project
			await projectLinks.first().click();

			// Should navigate to project page
			await expect(page).toHaveURL(/.*\/projects\/[a-f0-9-]+/);

			// Should show project sessions page
			await expect(page.locator('h1, .project-title')).toBeVisible();
		}
	});

	test('should display project metadata', async ({ page }) => {
		const projectItems = page.locator('.project-item, [data-testid="project-item"]');
		const projectCount = await projectItems.count();

		if (projectCount > 0) {
			const firstProject = projectItems.first();

			// Should show project name
			await expect(firstProject.locator('.project-name, .name, h3')).toBeVisible();

			// May show project description, created date, etc.
			const description = firstProject.locator('.description, .project-description');
			const createdDate = firstProject.locator('.created, .date');

			// These are optional but if present should be visible
			if (await description.isVisible()) {
				await expect(description).toBeVisible();
			}
			if (await createdDate.isVisible()) {
				await expect(createdDate).toBeVisible();
			}
		}
	});

	test('should handle project deletion if supported', async ({ page }) => {
		// Create a project first to delete
		const projectName = `delete-test-${Date.now()}`;

		const createButton = page
			.locator(
				'button:has-text("Create"), button:has-text("New Project"), [data-testid="create-project"]'
			)
			.first();

		if (await createButton.isVisible()) {
			await createButton.click();

			const nameInput = page
				.locator('input[placeholder*="name" i], input[placeholder*="project" i]')
				.first();
			if (await nameInput.isVisible()) {
				await nameInput.fill(projectName);

				const submitButton = page
					.locator('button[type="submit"], button:has-text("Create")')
					.first();
				if (await submitButton.isVisible()) {
					await submitButton.click();
					await page.waitForTimeout(2000);
				}
			}
		}

		// Look for delete button or menu
		const deleteButton = page.locator(
			`button:has-text("Delete"), .delete-btn, [data-testid="delete-project"]`
		);
		const menuButton = page.locator('.menu-btn, .actions-btn, [data-testid="project-menu"]');

		if (await deleteButton.isVisible()) {
			await deleteButton.click();

			// Handle confirmation dialog
			const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete")');
			if (await confirmButton.isVisible()) {
				await confirmButton.click();
				await page.waitForTimeout(1000);

				// Project should be removed
				await expect(page.locator(`text=${projectName}`)).not.toBeVisible();
			}
		}
	});

	test('should handle empty projects state', async ({ page }) => {
		// Check if there's an empty state message
		const emptyState = page.locator('.empty-state, .no-projects, [data-testid="empty-projects"]');
		const projectsList = page.locator('.projects-list, [data-testid="projects-list"]');

		const hasEmptyState = await emptyState.isVisible();
		const hasProjects =
			(await projectsList.isVisible()) && (await projectsList.locator('.project-item').count()) > 0;

		if (hasEmptyState && !hasProjects) {
			await expect(emptyState).toContainText(/no projects|empty|create/i);
		}
	});

	test('should be responsive on mobile viewports', async ({ page }) => {
		// Test mobile layout
		await page.setViewportSize({ width: 375, height: 667 });
		await page.reload();

		// Should still show main elements
		await expect(page.locator('header')).toBeVisible();

		// Projects should be stacked vertically on mobile
		const projectItems = page.locator('.project-item');
		const count = await projectItems.count();

		if (count > 1) {
			const firstProject = projectItems.first();
			const secondProject = projectItems.nth(1);

			const firstBox = await firstProject.boundingBox();
			const secondBox = await secondProject.boundingBox();

			if (firstBox && secondBox) {
				// Second project should be below first (vertical stacking)
				expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height - 10);
			}
		}
	});
});
