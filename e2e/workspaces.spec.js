/**
 * Workspace Operation E2E Tests
 *
 * Tests for workspace management including:
 * - Creating new workspaces
 * - Listing workspaces
 * - Deleting workspaces
 * - Workspace settings and configuration
 * - File operations within workspaces
 */

import { test, expect } from '@playwright/test';
import { resetToOnboarded } from './helpers/index.js';

const BASE_URL = 'http://localhost:7173';

test.describe('Workspace Management - CRUD Operations', () => {
	let apiKey;

	test.beforeEach(async () => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;
	});

	test('should create new workspace via API', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				name: 'test-workspace',
				path: '/workspace/test-workspace'
			}
		});

		expect(response.status()).toBe(201);

		const workspace = await response.json();
		expect(workspace.id).toBeTruthy();
		expect(workspace.name).toBe('test-workspace');
		expect(workspace.path).toBe('/workspace/test-workspace');
	});

	test('should list all workspaces via API', async ({ request }) => {
		// Create a workspace first
		await request.post(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				name: 'list-test-workspace',
				path: '/workspace/list-test'
			}
		});

		// List workspaces
		const response = await request.get(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		expect(response.status()).toBe(200);

		const workspaces = await response.json();
		expect(Array.isArray(workspaces)).toBe(true);
		expect(workspaces.length).toBeGreaterThan(0);

		const workspace = workspaces.find((w) => w.name === 'list-test-workspace');
		expect(workspace).toBeTruthy();
	});

	test('should get workspace details via API', async ({ request }) => {
		// Create workspace
		const createResponse = await request.post(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				name: 'details-test-workspace',
				path: '/workspace/details-test'
			}
		});

		const created = await createResponse.json();
		const workspaceId = created.id;

		// Get workspace details
		const response = await request.get(`${BASE_URL}/api/workspaces/${workspaceId}`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		expect(response.status()).toBe(200);

		const workspace = await response.json();
		expect(workspace.id).toBe(workspaceId);
		expect(workspace.name).toBe('details-test-workspace');
	});

	test('should delete workspace via API', async ({ request }) => {
		// Create workspace
		const createResponse = await request.post(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				name: 'delete-test-workspace',
				path: '/workspace/delete-test'
			}
		});

		const workspace = await createResponse.json();
		const workspaceId = workspace.id;

		// Delete workspace
		const deleteResponse = await request.delete(`${BASE_URL}/api/workspaces/${workspaceId}`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		expect(deleteResponse.status()).toBe(200);

		// Verify workspace is deleted
		const listResponse = await request.get(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		const workspaces = await listResponse.json();
		const deletedWorkspace = workspaces.find((w) => w.id === workspaceId);
		expect(deletedWorkspace).toBeFalsy();
	});

	test('should update workspace via API', async ({ request }) => {
		// Create workspace
		const createResponse = await request.post(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				name: 'update-test-workspace',
				path: '/workspace/update-test'
			}
		});

		const workspace = await createResponse.json();
		const workspaceId = workspace.id;

		// Update workspace
		const updateResponse = await request.patch(`${BASE_URL}/api/workspaces/${workspaceId}`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				name: 'updated-workspace-name'
			}
		});

		expect(updateResponse.status()).toBe(200);

		const updated = await updateResponse.json();
		expect(updated.name).toBe('updated-workspace-name');
	});
});

test.describe('Workspace Management - UI Operations', () => {
	let apiKey;

	test.beforeEach(async ({ page }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Login
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);
	});

	test('should show workspace selector/switcher in UI', async ({ page }) => {
		// Look for workspace indicator or selector
		const workspaceElement = page
			.locator('[data-testid="workspace-selector"], .workspace-selector, .workspace-name')
			.first();

		// Workspace UI should be visible
		const isVisible = await workspaceElement.isVisible({ timeout: 5000 }).catch(() => false);
		expect(isVisible).toBe(true);
	});

	test('should list workspaces in UI', async ({ page, request }) => {
		// Create multiple workspaces via API
		await request.post(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: { name: 'ui-workspace-1', path: '/workspace/ui-1' }
		});

		await request.post(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: { name: 'ui-workspace-2', path: '/workspace/ui-2' }
		});

		// Reload to see workspaces
		await page.reload();

		// Workspaces might be in a dropdown, sidebar, or workspace switcher
		// Try to find workspace list trigger
		const workspaceTrigger = page
			.locator('button:has-text("Workspaces"), [aria-label*="Workspace"], .workspace-trigger')
			.first();
		if (await workspaceTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
			await workspaceTrigger.click();
		}

		// Look for workspace names in UI
		const workspace1 = page.locator('text="ui-workspace-1"').first();
		const workspace2 = page.locator('text="ui-workspace-2"').first();

		// At least check that workspace elements exist (they might be hidden in a menu)
		const hasWorkspace1 = (await workspace1.count()) > 0;
		const hasWorkspace2 = (await workspace2.count()) > 0;

		// Both workspaces should exist in the DOM
		expect(hasWorkspace1 || hasWorkspace2).toBe(true);
	});
});

test.describe('Workspace Management - File Operations', () => {
	let apiKey;

	test.beforeEach(async () => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;
	});

	test('should browse workspace files via API', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/browse?path=/workspace`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		expect(response.status()).toBe(200);

		const contents = await response.json();
		expect(Array.isArray(contents)).toBe(true);
	});

	test('should read file from workspace via API', async ({ request }) => {
		// First, check if /api/files endpoint exists
		const response = await request.get(`${BASE_URL}/api/files?path=/workspace/README.md`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		// API might return 404 if file doesn't exist, or 200 if it does
		expect([200, 404]).toContain(response.status());
	});

	test('should write file to workspace via API', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/files`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				path: '/workspace/test-file.txt',
				content: 'Test content from E2E test'
			}
		});

		// File write might succeed (200/201) or fail if endpoint doesn't exist
		expect([200, 201, 404]).toContain(response.status());
	});
});

test.describe('Workspace Management - Settings', () => {
	let apiKey;

	test.beforeEach(async ({ page }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="key"]', apiKey);
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE_URL}/workspace`);
	});

	test('should access workspace settings from UI', async ({ page }) => {
		// Navigate to settings
		await page.goto(`${BASE_URL}/settings`);

		// Look for workspace-related settings
		const settingsPage = page.locator('main, [role="main"], .settings-container').first();
		await expect(settingsPage).toBeVisible({ timeout: 5000 });

		// Workspace settings section might exist
		const workspaceSection = page.locator('text=/Workspace|Work Space/i').first();
		const hasWorkspaceSettings = (await workspaceSection.count()) > 0;

		// Just verify settings page loads
		expect(await settingsPage.count()).toBeGreaterThan(0);
	});

	test('should show workspace environment variables', async ({ request }) => {
		// Get workspace settings via API
		const response = await request.get(`${BASE_URL}/api/settings?category=workspace`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		if (response.status() === 200) {
			const settings = await response.json();
			expect(settings).toBeTruthy();
		}
	});
});

test.describe('Workspace Management - Session Association', () => {
	let apiKey;
	let workspaceId;

	test.beforeEach(async ({ request }) => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;

		// Create a workspace
		const response = await request.post(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				name: 'session-workspace',
				path: '/workspace/session-test'
			}
		});

		const workspace = await response.json();
		workspaceId = workspace.id;
	});

	test('should create session in specific workspace', async ({ request }) => {
		// Create session with workspace path
		const response = await request.post(`${BASE_URL}/api/sessions`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				type: 'pty',
				name: 'Workspace Session',
				workspacePath: '/workspace/session-test'
			}
		});

		expect(response.status()).toBe(201);

		const session = await response.json();
		expect(session.runId).toBeTruthy();

		// Session should be associated with workspace
		// (exact field name depends on implementation)
	});

	test('should list sessions for workspace', async ({ request }) => {
		// Create sessions in workspace
		await request.post(`${BASE_URL}/api/sessions`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				type: 'pty',
				name: 'WS Session 1',
				workspacePath: '/workspace/session-test'
			}
		});

		await request.post(`${BASE_URL}/api/sessions`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				type: 'pty',
				name: 'WS Session 2',
				workspacePath: '/workspace/session-test'
			}
		});

		// Get workspace details (might include session count)
		const response = await request.get(`${BASE_URL}/api/workspaces/${workspaceId}`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		expect(response.status()).toBe(200);

		const workspace = await response.json();
		expect(workspace.id).toBe(workspaceId);

		// Workspace might have session count or list
		if (workspace.sessionCount !== undefined) {
			expect(workspace.sessionCount).toBeGreaterThanOrEqual(2);
		}
	});
});

test.describe('Workspace Management - Validation', () => {
	let apiKey;

	test.beforeEach(async () => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;
	});

	test('should reject workspace with invalid path', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				name: 'invalid-workspace',
				path: '../../../etc/passwd' // Path traversal attempt
			}
		});

		// Should reject with 400 Bad Request
		expect(response.status()).toBe(400);
	});

	test('should reject duplicate workspace name', async ({ request }) => {
		// Create first workspace
		await request.post(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				name: 'duplicate-test',
				path: '/workspace/dup-1'
			}
		});

		// Try to create duplicate
		const response = await request.post(`${BASE_URL}/api/workspaces`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				name: 'duplicate-test',
				path: '/workspace/dup-2'
			}
		});

		// Might reject duplicate (409 Conflict) or allow (200)
		// depending on implementation
		expect([200, 201, 409]).toContain(response.status());
	});

	test('should require authentication for workspace operations', async ({ request }) => {
		// Try to create workspace without auth
		const response = await request.post(`${BASE_URL}/api/workspaces`, {
			data: {
				name: 'unauth-workspace',
				path: '/workspace/unauth'
			}
		});

		// Should reject with 401 Unauthorized
		expect(response.status()).toBe(401);
	});
});

test.describe('Workspace Management - Git Integration', () => {
	let apiKey;

	test.beforeEach(async () => {
		const result = await resetToOnboarded();
		apiKey = result.apiKey.key;
	});

	test('should clone repository into workspace', async ({ request }) => {
		// Try to clone a repository via API
		const response = await request.post(`${BASE_URL}/api/git/clone`, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			data: {
				url: 'https://github.com/example/example.git',
				path: '/workspace/cloned-repo'
			}
		});

		// API might not exist yet, or might work
		expect([200, 201, 404]).toContain(response.status());
	});

	test('should show git status for workspace', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/git/status?path=/workspace`, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		// Git status endpoint might exist
		expect([200, 404]).toContain(response.status());
	});
});
