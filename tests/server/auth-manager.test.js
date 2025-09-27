import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthManager } from '../../src/lib/server/auth/AuthManager.js';

// Mock the database manager
const mockDB = {
	run: vi.fn(),
	get: vi.fn(),
	all: vi.fn()
};

describe('AuthManager', () => {
	let authManager;

	beforeEach(() => {
		vi.clearAllMocks();
		authManager = new AuthManager(mockDB);
	});

	describe('createUser', () => {
		it('should create a new user with valid data', async () => {
			mockDB.run.mockResolvedValue({ lastID: 1 });

			const userId = await authManager.createUser('testuser', 'test@example.com', true, ['ssh_key']);

			expect(typeof userId).toBe('string');
			expect(mockDB.run).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO users'),
				expect.arrayContaining(['testuser', 'test@example.com', true, '["ssh_key"]'])
			);
		});
	});

	describe('generateSSHFingerprint', () => {
		it('should generate consistent fingerprints for the same key', () => {
			const publicKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7... test@example.com';
			
			const fingerprint1 = authManager.generateSSHFingerprint(publicKey);
			const fingerprint2 = authManager.generateSSHFingerprint(publicKey);

			expect(fingerprint1).toBe(fingerprint2);
			expect(fingerprint1).toHaveLength(16);
		});

		it('should generate different fingerprints for different keys', () => {
			const key1 = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7... test1@example.com';
			const key2 = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC8... test2@example.com';

			const fingerprint1 = authManager.generateSSHFingerprint(key1);
			const fingerprint2 = authManager.generateSSHFingerprint(key2);

			expect(fingerprint1).not.toBe(fingerprint2);
		});
	});

	describe('validateLegacyKey', () => {
		it('should validate correct legacy key', () => {
			process.env.TERMINAL_KEY = 'testkey123';
			
			const result = authManager.validateLegacyKey('testkey123');
			
			expect(result).toBe(true);
		});

		it('should reject incorrect legacy key', () => {
			process.env.TERMINAL_KEY = 'testkey123';
			
			const result = authManager.validateLegacyKey('wrongkey');
			
			expect(result).toBe(false);
		});

		it('should allow any key when TERMINAL_KEY is empty', () => {
			process.env.TERMINAL_KEY = '';
			
			const result = authManager.validateLegacyKey('anykey');
			
			expect(result).toBe(true);
		});
	});

	describe('generateJWT', () => {
		it('should generate a valid JWT token', () => {
			const token = authManager.generateJWT('user123', 'session456', 'ssh_key');
			
			expect(typeof token).toBe('string');
			expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
		});
	});

	describe('createSession', () => {
		it('should create a session with correct data', async () => {
			mockDB.run.mockResolvedValue({ lastID: 1 });

			const session = await authManager.createSession('user123', 'ssh_key');

			expect(session).toHaveProperty('sessionId');
			expect(session).toHaveProperty('expiresAt');
			expect(session).toHaveProperty('token');
			expect(typeof session.sessionId).toBe('string');
			expect(typeof session.token).toBe('string');
			expect(mockDB.run).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO auth_sessions'),
				expect.arrayContaining(['user123', 'ssh_key'])
			);
		});
	});
});