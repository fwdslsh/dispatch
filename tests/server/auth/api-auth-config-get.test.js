import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app.js';

describe('GET /api/auth/config - Contract Tests', () => {
	const authKey = 'testkey12345';

	beforeEach(async () => {
		// Clean setup for each test
	});

	afterEach(async () => {
		// Clean up after each test
	});

	it('should return authentication configuration status', async () => {
		const response = await request(app).get(`/api/auth/config?authKey=${authKey}`).expect(200);

		expect(response.body).toHaveProperty('terminal_key_set');
		expect(response.body).toHaveProperty('oauth_configured');
		expect(typeof response.body.terminal_key_set).toBe('boolean');
		expect(typeof response.body.oauth_configured).toBe('boolean');
	});

	it('should indicate terminal key status without exposing value', async () => {
		const response = await request(app).get(`/api/auth/config?authKey=${authKey}`).expect(200);

		expect(response.body.terminal_key_set).toBe(true);
		expect(response.body).not.toHaveProperty('terminal_key');
		expect(response.body).not.toHaveProperty('terminal_key_value');
	});

	it('should return OAuth configuration without sensitive data', async () => {
		const response = await request(app).get(`/api/auth/config?authKey=${authKey}`).expect(200);

		// Should have OAuth fields but no client_secret
		expect(response.body).toHaveProperty('oauth_client_id');
		expect(response.body).toHaveProperty('oauth_redirect_uri');
		expect(response.body).not.toHaveProperty('oauth_client_secret');
	});

	it('should return 401 for invalid auth key', async () => {
		const response = await request(app).get('/api/auth/config?authKey=invalid').expect(401);

		expect(response.body).toHaveProperty('error');
		expect(response.body.error).toContain('Authentication failed');
	});

	it('should return 401 for missing auth key', async () => {
		const response = await request(app).get('/api/auth/config').expect(401);

		expect(response.body).toHaveProperty('error');
	});

	it('should handle OAuth not configured scenario', async () => {
		const response = await request(app).get(`/api/auth/config?authKey=${authKey}`).expect(200);

		if (!response.body.oauth_configured) {
			expect(response.body.oauth_client_id).toBeNull();
			expect(response.body.oauth_redirect_uri).toBeNull();
		}
	});

	it('should handle OAuth configured scenario', async () => {
		// This test assumes OAuth might be configured
		const response = await request(app).get(`/api/auth/config?authKey=${authKey}`).expect(200);

		if (response.body.oauth_configured) {
			expect(response.body.oauth_client_id).toBeTruthy();
			expect(response.body.oauth_redirect_uri).toBeTruthy();
		}
	});
});
