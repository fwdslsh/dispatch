import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app.js';

describe('GET /api/settings - Contract Tests', () => {
	const authKey = 'testkey12345';

	beforeEach(async () => {
		// Clean setup for each test
	});

	afterEach(async () => {
		// Clean up after each test
	});

	it('should return all settings with valid auth key', async () => {
		const response = await request(app).get(`/api/settings?authKey=${authKey}`).expect(200);

		expect(response.body).toHaveProperty('categories');
		expect(response.body).toHaveProperty('settings');
		expect(Array.isArray(response.body.categories)).toBe(true);
		expect(Array.isArray(response.body.settings)).toBe(true);

		// Verify essential categories exist
		const categoryIds = response.body.categories.map((c) => c.id);
		expect(categoryIds).toContain('authentication');
		expect(categoryIds).toContain('workspace');
		expect(categoryIds).toContain('network');
		expect(categoryIds).toContain('ui');
	});

	it('should filter settings by category when category param provided', async () => {
		const response = await request(app)
			.get(`/api/settings?authKey=${authKey}&category=authentication`)
			.expect(200);

		expect(response.body).toHaveProperty('categories');
		expect(response.body).toHaveProperty('settings');

		// Should only return authentication category and its settings
		expect(response.body.categories).toHaveLength(1);
		expect(response.body.categories[0].id).toBe('authentication');

		response.body.settings.forEach((setting) => {
			expect(setting.category_id).toBe('authentication');
		});
	});

	it('should return 401 for invalid auth key', async () => {
		const response = await request(app).get('/api/settings?authKey=invalid').expect(401);

		expect(response.body).toHaveProperty('error');
		expect(response.body.error).toContain('Authentication failed');
	});

	it('should return 401 for missing auth key', async () => {
		const response = await request(app).get('/api/settings').expect(401);

		expect(response.body).toHaveProperty('error');
	});

	it('should return empty arrays for non-existent category', async () => {
		const response = await request(app)
			.get(`/api/settings?authKey=${authKey}&category=nonexistent`)
			.expect(200);

		expect(response.body.categories).toHaveLength(0);
		expect(response.body.settings).toHaveLength(0);
	});

	it('should mask sensitive values in response', async () => {
		const response = await request(app)
			.get(`/api/settings?authKey=${authKey}&category=authentication`)
			.expect(200);

		const sensitiveSettings = response.body.settings.filter((s) => s.is_sensitive);
		sensitiveSettings.forEach((setting) => {
			if (setting.current_value) {
				expect(setting.current_value).toMatch(/^\*+$/);
			}
		});
	});

	it('should have performance under 25ms for basic GET request', async () => {
		const startTime = Date.now();

		await request(app).get(`/api/settings?authKey=${authKey}`).expect(200);

		const duration = Date.now() - startTime;
		expect(duration).toBeLessThan(25);
	});
});
