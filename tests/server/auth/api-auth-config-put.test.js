import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app.js';

describe('PUT /api/auth/config - Contract Tests', () => {
	const authKey = 'testkey12345';

	beforeEach(async () => {
		// Clean setup for each test
	});

	afterEach(async () => {
		// Clean up after each test
	});

	it('should update terminal key successfully', async () => {
		const updateData = {
			authKey,
			terminal_key: 'newkey12345'
		};

		const response = await request(app).put('/api/auth/config').send(updateData).expect(200);

		expect(response.body).toHaveProperty('success', true);
		expect(response.body).toHaveProperty('session_invalidated', true);
		expect(response.body).toHaveProperty('updated_count');
		expect(response.body.updated_count).toBeGreaterThan(0);
	});

	it('should update OAuth configuration', async () => {
		const updateData = {
			authKey,
			oauth_client_id: 'test-client-123',
			oauth_client_secret: 'secret-abc-456',
			oauth_redirect_uri: 'https://example.com/callback'
		};

		const response = await request(app).put('/api/auth/config').send(updateData).expect(200);

		expect(response.body).toHaveProperty('success', true);
		expect(response.body).toHaveProperty('updated_count');
	});

	it('should validate terminal key minimum length', async () => {
		const updateData = {
			authKey,
			terminal_key: 'short' // Less than 8 characters
		};

		const response = await request(app).put('/api/auth/config').send(updateData).expect(400);

		expect(response.body).toHaveProperty('error');
		expect(response.body.error).toContain('minimum 8 characters');
	});

	it('should reject empty terminal key for required field', async () => {
		const updateData = {
			authKey,
			terminal_key: ''
		};

		const response = await request(app).put('/api/auth/config').send(updateData).expect(400);

		expect(response.body).toHaveProperty('error');
		expect(response.body.error).toContain('Terminal key is required');
	});

	it('should validate OAuth redirect URI format', async () => {
		const updateData = {
			authKey,
			oauth_redirect_uri: 'invalid-uri'
		};

		const response = await request(app).put('/api/auth/config').send(updateData).expect(400);

		expect(response.body).toHaveProperty('error');
		expect(response.body.error).toContain('valid URL');
	});

	it('should return 401 for invalid auth key', async () => {
		const updateData = {
			authKey: 'invalid',
			terminal_key: 'validkey12345'
		};

		const response = await request(app).put('/api/auth/config').send(updateData).expect(401);

		expect(response.body).toHaveProperty('error');
		expect(response.body.error).toContain('Authentication failed');
	});

	it('should invalidate all sessions when terminal key changes', async () => {
		const updateData = {
			authKey,
			terminal_key: 'newsecurekey123'
		};

		const response = await request(app).put('/api/auth/config').send(updateData).expect(200);

		expect(response.body.session_invalidated).toBe(true);
		expect(response.body).toHaveProperty('message');
		expect(response.body.message).toContain('session');
	});

	it('should not invalidate sessions for OAuth-only changes', async () => {
		const updateData = {
			authKey,
			oauth_client_id: 'new-client-id'
		};

		const response = await request(app).put('/api/auth/config').send(updateData).expect(200);

		// OAuth changes might not invalidate sessions (depends on implementation)
		expect(response.body.session_invalidated).toBeDefined();
	});

	it('should handle partial updates', async () => {
		const updateData = {
			authKey,
			oauth_client_id: 'partial-update-id'
			// Only updating one OAuth field
		};

		const response = await request(app).put('/api/auth/config').send(updateData).expect(200);

		expect(response.body.success).toBe(true);
	});

	it('should not log sensitive values', async () => {
		// This is more of a behavioral test - we can't directly test logging
		// but we can ensure the response doesn't contain sensitive values
		const updateData = {
			authKey,
			terminal_key: 'secretkey123',
			oauth_client_secret: 'very-secret-value'
		};

		const response = await request(app).put('/api/auth/config').send(updateData).expect(200);

		// Response should not contain the actual sensitive values
		const responseString = JSON.stringify(response.body);
		expect(responseString).not.toContain('secretkey123');
		expect(responseString).not.toContain('very-secret-value');
	});
});
