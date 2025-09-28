import { test, expect } from '@playwright/test';

const TEST_KEY = process.env.TERMINAL_KEY || 'testkey12345';
const BASE_URL = 'http://localhost:5173';

test.describe('Workspace API', () => {
	const testWorkspacePath = '/tmp/test-workspace-e2e';
	const testWorkspaceName = 'E2E Test Workspace';

	test.beforeEach(async ({ page }) => {
		// Clean up any existing test workspace
		try {
			await page.request.delete(`${BASE_URL}/api/workspaces/${encodeURIComponent(testWorkspacePath)}?authKey=${TEST_KEY}`);
		} catch {
			// Ignore if workspace doesn't exist
		}
	});

	test.afterEach(async ({ page }) => {
		// Clean up test workspace
		try {
			await page.request.delete(`${BASE_URL}/api/workspaces/${encodeURIComponent(testWorkspacePath)}?authKey=${TEST_KEY}`);
		} catch {
			// Ignore if workspace doesn't exist
		}
	});

	test('should list workspaces (empty initially)', async ({ page }) => {
		const response = await page.request.get(`${BASE_URL}/api/workspaces?authKey=${TEST_KEY}`);
		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data).toHaveProperty('workspaces');
		expect(data).toHaveProperty('pagination');
		expect(Array.isArray(data.workspaces)).toBe(true);
		expect(data.pagination).toMatchObject({
			total: expect.any(Number),
			limit: 50,
			offset: 0,
			hasMore: expect.any(Boolean)
		});
	});

	test('should create a new workspace', async ({ page }) => {
		const response = await page.request.post(`${BASE_URL}/api/workspaces`, {
			data: {
				path: testWorkspacePath,
				name: testWorkspaceName,
				authKey: TEST_KEY
			}
		});

		expect(response.status()).toBe(201);

		const data = await response.json();
		expect(data).toMatchObject({
			id: testWorkspacePath,
			name: testWorkspaceName,
			path: testWorkspacePath,
			status: 'new',
			createdAt: expect.any(String),
			lastActive: null,
			updatedAt: expect.any(String),
			sessionCounts: {
				total: 0,
				running: 0,
				stopped: 0,
				error: 0
			}
		});

		// Verify the workspace exists in the list
		const listResponse = await page.request.get(`${BASE_URL}/api/workspaces?authKey=${TEST_KEY}`);
		const listData = await listResponse.json();

		const createdWorkspace = listData.workspaces.find(w => w.path === testWorkspacePath);
		expect(createdWorkspace).toBeDefined();
		expect(createdWorkspace.name).toBe(testWorkspaceName);
	});

	test('should prevent duplicate workspace creation', async ({ page }) => {
		// Create workspace first
		await page.request.post(`${BASE_URL}/api/workspaces`, {
			data: {
				path: testWorkspacePath,
				name: testWorkspaceName,
				authKey: TEST_KEY
			}
		});

		// Try to create the same workspace again
		const response = await page.request.post(`${BASE_URL}/api/workspaces`, {
			data: {
				path: testWorkspacePath,
				name: 'Different Name',
				authKey: TEST_KEY
			}
		});

		expect(response.status()).toBe(409);

		const data = await response.json();
		expect(data.message).toContain('already exists');
	});

	test('should require authentication for workspace creation', async ({ page }) => {
		const response = await page.request.post(`${BASE_URL}/api/workspaces`, {
			data: {
				path: testWorkspacePath,
				name: testWorkspaceName,
				authKey: 'invalid-key'
			}
		});

		expect(response.status()).toBe(401);

		const data = await response.json();
		expect(data.message).toContain('Authentication required');
	});

	test('should validate workspace path format', async ({ page }) => {
		const invalidPaths = [
			'', // empty
			'relative/path', // not absolute
			'/path/with/../traversal', // path traversal
			'/path/with/~user', // tilde expansion
			'x'.repeat(501) // too long
		];

		for (const invalidPath of invalidPaths) {
			const response = await page.request.post(`${BASE_URL}/api/workspaces`, {
				data: {
					path: invalidPath,
					name: 'Test',
					authKey: TEST_KEY
				}
			});

			expect(response.status()).toBe(400);

			const data = await response.json();
			expect(data.message).toContain('path');
		}
	});

	test('should get workspace details', async ({ page }) => {
		// Create workspace first
		await page.request.post(`${BASE_URL}/api/workspaces`, {
			data: {
				path: testWorkspacePath,
				name: testWorkspaceName,
				authKey: TEST_KEY
			}
		});

		// Get workspace details
		const response = await page.request.get(`${BASE_URL}/api/workspaces/${encodeURIComponent(testWorkspacePath)}`);
		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data).toMatchObject({
			id: testWorkspacePath,
			name: expect.any(String),
			path: testWorkspacePath,
			status: 'new',
			createdAt: expect.any(String),
			lastActive: null,
			updatedAt: expect.any(String),
			sessionCounts: {
				running: 0,
				stopped: 0,
				starting: 0,
				error: 0
			},
			sessionStats: {
				total: 0,
				byStatus: expect.any(Object),
				byType: expect.any(Object)
			},
			activeSessions: []
		});
	});

	test('should return 404 for non-existent workspace', async ({ page }) => {
		const response = await page.request.get(`${BASE_URL}/api/workspaces/${encodeURIComponent('/non/existent/path')}`);
		expect(response.status()).toBe(404);

		const data = await response.json();
		expect(data.message).toContain('not found');
	});

	test('should update workspace metadata', async ({ page }) => {
		// Create workspace first
		await page.request.post(`${BASE_URL}/api/workspaces`, {
			data: {
				path: testWorkspacePath,
				name: testWorkspaceName,
				authKey: TEST_KEY
			}
		});

		// Update workspace
		const response = await page.request.put(`${BASE_URL}/api/workspaces/${encodeURIComponent(testWorkspacePath)}`, {
			data: {
				name: 'Updated Name',
				status: 'active',
				authKey: TEST_KEY
			}
		});

		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data.name).toBe('Updated Name');
		expect(data.status).toBe('active');
	});

	test('should require authentication for workspace updates', async ({ page }) => {
		// Create workspace first
		await page.request.post(`${BASE_URL}/api/workspaces`, {
			data: {
				path: testWorkspacePath,
				name: testWorkspaceName,
				authKey: TEST_KEY
			}
		});

		// Try to update without auth
		const response = await page.request.put(`${BASE_URL}/api/workspaces/${encodeURIComponent(testWorkspacePath)}`, {
			data: {
				name: 'Updated Name',
				authKey: 'invalid-key'
			}
		});

		expect(response.status()).toBe(401);
	});

	test('should delete workspace', async ({ page }) => {
		// Create workspace first
		await page.request.post(`${BASE_URL}/api/workspaces`, {
			data: {
				path: testWorkspacePath,
				name: testWorkspaceName,
				authKey: TEST_KEY
			}
		});

		// Delete workspace
		const response = await page.request.delete(`${BASE_URL}/api/workspaces/${encodeURIComponent(testWorkspacePath)}?authKey=${TEST_KEY}`);
		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data.message).toContain('deleted successfully');

		// Verify workspace is gone
		const getResponse = await page.request.get(`${BASE_URL}/api/workspaces/${encodeURIComponent(testWorkspacePath)}`);
		expect(getResponse.status()).toBe(404);
	});

	test('should require authentication for workspace deletion', async ({ page }) => {
		// Create workspace first
		await page.request.post(`${BASE_URL}/api/workspaces`, {
			data: {
				path: testWorkspacePath,
				name: testWorkspaceName,
				authKey: TEST_KEY
			}
		});

		// Try to delete without auth
		const response = await page.request.delete(`${BASE_URL}/api/workspaces/${encodeURIComponent(testWorkspacePath)}?authKey=invalid-key`);
		expect(response.status()).toBe(401);
	});

	test('should handle pagination correctly', async ({ page }) => {
		// Create multiple workspaces
		const workspaces = [];
		for (let i = 0; i < 3; i++) {
			const path = `/tmp/test-workspace-${i}`;
			workspaces.push(path);

			await page.request.post(`${BASE_URL}/api/workspaces`, {
				data: {
					path,
					name: `Test Workspace ${i}`,
					authKey: TEST_KEY
				}
			});
		}

		// Test pagination with limit
		const response = await page.request.get(`${BASE_URL}/api/workspaces?limit=2&authKey=${TEST_KEY}`);
		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data.workspaces.length).toBeLessThanOrEqual(2);
		expect(data.pagination.limit).toBe(2);

		// Clean up
		for (const path of workspaces) {
			try {
				await page.request.delete(`${BASE_URL}/api/workspaces/${encodeURIComponent(path)}?authKey=${TEST_KEY}`);
			} catch {
				// Ignore cleanup errors
			}
		}
	});

	test('should filter workspaces by status', async ({ page }) => {
		// Create workspace
		await page.request.post(`${BASE_URL}/api/workspaces`, {
			data: {
				path: testWorkspacePath,
				name: testWorkspaceName,
				authKey: TEST_KEY
			}
		});

		// Test status filtering
		const response = await page.request.get(`${BASE_URL}/api/workspaces?status=new&authKey=${TEST_KEY}`);
		expect(response.status()).toBe(200);

		const data = await response.json();
		for (const workspace of data.workspaces) {
			expect(workspace.status).toBe('new');
		}
	});
});