import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app.js';

describe('PUT /api/settings/{category} - Contract Tests', () => {
	const authKey = 'testkey12345';

	beforeEach(async () => {
		// Clean setup for each test
	});

	afterEach(async () => {
		// Clean up after each test
	});

	it('should update settings in authentication category', async () => {
		const updateData = {
			authKey,
			settings: {
				terminal_key: 'newkey12345',
				oauth_client_id: 'test-client-id'
			}
		};

		const response = await request(app)
			.put('/api/settings/authentication')
			.send(updateData)
			.expect(200);

		expect(response.body).toHaveProperty('success', true);
		expect(response.body).toHaveProperty('updated_count');
		expect(response.body.updated_count).toBeGreaterThan(0);
	});

	it('should update settings in workspace category', async () => {
		const updateData = {
			authKey,
			settings: {
				workspaces_root: '/custom/workspace'
			}
		};

		const response = await request(app).put('/api/settings/workspace').send(updateData).expect(200);

		expect(response.body).toHaveProperty('success', true);
		expect(response.body).toHaveProperty('updated_count');
	});

	it('should validate required settings and return 400 for missing values', async () => {
		const updateData = {
			authKey,
			settings: {
				terminal_key: '' // Invalid empty value for required field
			}
		};

		const response = await request(app)
			.put('/api/settings/authentication')
			.send(updateData)
			.expect(400);

		expect(response.body).toHaveProperty('error');
		expect(response.body.error).toContain('validation');
	});

	it('should validate terminal key minimum length', async () => {
		const updateData = {
			authKey,
			settings: {
				terminal_key: 'short' // Less than 8 characters
			}
		};

		const response = await request(app)
			.put('/api/settings/authentication')
			.send(updateData)
			.expect(400);

		expect(response.body).toHaveProperty('error');
		expect(response.body.error).toContain('minimum 8 characters');
	});

	it('should return 401 for invalid auth key', async () => {
		const updateData = {
			authKey: 'invalid',
			settings: {
				terminal_key: 'validkey12345'
			}
		};

		const response = await request(app)
			.put('/api/settings/authentication')
			.send(updateData)
			.expect(401);

		expect(response.body).toHaveProperty('error');
	});

	it('should return 400 for non-existent category', async () => {
		const updateData = {
			authKey,
			settings: {
				some_setting: 'value'
			}
		};

		const response = await request(app)
			.put('/api/settings/nonexistent')
			.send(updateData)
			.expect(400);

		expect(response.body).toHaveProperty('error');
		expect(response.body.error).toContain('Invalid category');
	});

	it('should have performance under 50ms for setting updates', async () => {
		const updateData = {
			authKey,
			settings: {
				theme: 'dark'
			}
		};

		const startTime = Date.now();

		await request(app).put('/api/settings/ui').send(updateData).expect(200);

		const duration = Date.now() - startTime;
		expect(duration).toBeLessThan(50);
	});

	it('should invalidate sessions when authentication settings change', async () => {
		const updateData = {
			authKey,
			settings: {
				terminal_key: 'newsecurekey123'
			}
		};

		const response = await request(app)
			.put('/api/settings/authentication')
			.send(updateData)
			.expect(200);

		expect(response.body).toHaveProperty('session_invalidated', true);
	});

	it('should not invalidate sessions for non-authentication settings', async () => {
		const updateData = {
			authKey,
			settings: {
				theme: 'light'
			}
		};

		const response = await request(app).put('/api/settings/ui').send(updateData).expect(200);

		expect(response.body.session_invalidated).toBeFalsy();
	});
});
