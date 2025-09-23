import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../../src/routes/api/auth/ssh/+server.js';

// Mock the auth module
vi.mock('../../src/lib/server/shared/auth.js', () => ({
	getAuthManager: vi.fn()
}));

describe('SSH Authentication API', () => {
	let mockAuthManager;
	let mockRequest;
	let mockCookies;

	beforeEach(async () => {
		vi.clearAllMocks();

		mockAuthManager = {
			verifySSHKey: vi.fn(),
			createSession: vi.fn(),
			handleFirstUserSSHAuth: vi.fn()
		};

		const { getAuthManager } = await import('../../src/lib/server/shared/auth.js');
		getAuthManager.mockReturnValue(mockAuthManager);

		mockCookies = {
			set: vi.fn()
		};

		mockRequest = {
			json: vi.fn()
		};
	});

	it('should authenticate with valid SSH key', async () => {
		const validSSHKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7vbqajDjZWbwvyTestKeyDataHere test@example.com';

		mockRequest.json.mockResolvedValue({ publicKey: validSSHKey });
		mockAuthManager.verifySSHKey.mockResolvedValue({
			id: 'key123',
			user_id: 'user123',
			username: 'testuser',
			email: 'test@example.com',
			fingerprint: 'abcd1234'
		});
		mockAuthManager.createSession.mockResolvedValue({
			sessionId: 'session123',
			token: 'jwt.token.here'
		});

		const response = await POST({ request: mockRequest, cookies: mockCookies, locals: { services: { authManager: mockAuthManager } } });
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.user.id).toBe('user123');
		expect(mockCookies.set).toHaveBeenCalledWith(
			'dispatch-auth-token',
			'jwt.token.here',
			expect.objectContaining({
				path: '/',
				httpOnly: true,
				sameSite: 'lax'
			})
		);
	});

	it('should reject invalid SSH key format', async () => {
		mockRequest.json.mockResolvedValue({ publicKey: 'invalid-key-format' });

		const response = await POST({ request: mockRequest, cookies: mockCookies, locals: { services: { authManager: mockAuthManager } } });
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Invalid SSH public key format');
	});

	it('should reject unauthorized SSH key when not first user', async () => {
		const validSSHKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7vbqajDjZWbwvyTestKeyDataHere test@example.com';

		mockRequest.json.mockResolvedValue({ publicKey: validSSHKey });
		mockAuthManager.verifySSHKey.mockResolvedValue(null); // Key not found
		mockAuthManager.handleFirstUserSSHAuth.mockResolvedValue(null); // Not first user

		const response = await POST({ request: mockRequest, cookies: mockCookies, locals: { services: { authManager: mockAuthManager } } });
		const data = await response.json();

		expect(response.status).toBe(401);
		expect(data.success).toBe(false);
		expect(data.error).toBe('SSH key not authorized');
	});

	it('should handle first user SSH authentication', async () => {
		const validSSHKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7vbqajDjZWbwvyTestKeyDataHere test@example.com';

		mockRequest.json.mockResolvedValue({ publicKey: validSSHKey });
		mockAuthManager.verifySSHKey.mockResolvedValue(null); // Key not found in existing users
		mockAuthManager.handleFirstUserSSHAuth.mockResolvedValue({
			id: 'key123',
			user_id: 'admin123',
			username: 'admin',
			email: 'admin@dispatch.local',
			fingerprint: 'abcd1234'
		});
		mockAuthManager.createSession.mockResolvedValue({
			sessionId: 'session123',
			token: 'jwt.token.here'
		});

		const response = await POST({ request: mockRequest, cookies: mockCookies, locals: { services: { authManager: mockAuthManager } } });
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.user.id).toBe('admin123');
		expect(data.user.username).toBe('admin');
	});

	it('should handle missing public key', async () => {
		mockRequest.json.mockResolvedValue({});

		const response = await POST({ request: mockRequest, cookies: mockCookies, locals: { services: { authManager: mockAuthManager } } });
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe('Public key is required');
	});
});