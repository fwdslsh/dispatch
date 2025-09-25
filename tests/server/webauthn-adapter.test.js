import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';
import { WebAuthnAdapter } from '../../src/lib/server/shared/auth/adapters/WebAuthnAdapter.js';
import path from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

// Setup WebCrypto polyfill for Node.js testing
import { Crypto } from '@peculiar/webcrypto';

// Setup crypto for Node.js environment
if (typeof globalThis.crypto === 'undefined') {
	const crypto = new Crypto();
	Object.defineProperty(globalThis, 'crypto', {
		value: crypto,
		writable: false,
		configurable: true
	});
}

describe('WebAuthn Adapter', () => {
	let db;
	let webauthnAdapter;
	let tempDbPath;
	let testUserId;
	let mockRequest;

	beforeEach(async () => {
		// Create a temporary database for testing
		tempDbPath = path.join(tmpdir(), `test-webauthn-adapter-${Date.now()}.db`);
		db = new DatabaseManager(tempDbPath);
		await db.init();

		// Run auth migrations

		// Create WebAuthn adapter
		webauthnAdapter = new WebAuthnAdapter(db, null);

		// Create a test user
		const userResult = await db.run(`
			INSERT INTO users (username, display_name, email, password_hash, is_admin)
			VALUES ('testuser', 'Test User', 'test@example.com', 'hashed_password', 0)
		`);
		testUserId = userResult.lastID;

		// Mock request object
		mockRequest = {
			headers: {
				host: 'localhost:3000'
			},
			protocol: 'http'
		};
	});

	afterEach(async () => {
		if (db) {
			await db.close();
		}
		try {
			rmSync(tempDbPath, { force: true });
		} catch (e) {
			// Ignore cleanup errors
		}
	});

	describe('Adapter Interface', () => {
		it('should implement adapter interface correctly', () => {
			expect(webauthnAdapter.name).toBe('webauthn');
			expect(webauthnAdapter.displayName).toBe('WebAuthn/Passkey');
			expect(webauthnAdapter.icon).toBe('🔐');

			expect(typeof webauthnAdapter.isAvailable).toBe('function');
			expect(typeof webauthnAdapter.getSupportedMethods).toBe('function');
			expect(typeof webauthnAdapter.beginAuthentication).toBe('function');
			expect(typeof webauthnAdapter.completeAuthentication).toBe('function');
		});

		it('should get adapter info', () => {
			const info = webauthnAdapter.getInfo();

			expect(info.name).toBe('webauthn');
			expect(info.displayName).toBe('WebAuthn/Passkey');
			expect(info.requiresHttps).toBe(true);
			expect(info.supportsRegistration).toBe(true);
			expect(info.supportsAuthentication).toBe(true);
		});

		it('should get supported methods', () => {
			const methods = webauthnAdapter.getSupportedMethods();

			expect(methods).toContain('webauthn-register');
			expect(methods).toContain('webauthn-authenticate');
		});
	});

	describe('Availability Checking', () => {
		it('should detect availability for localhost', async () => {
			const isAvailable = await webauthnAdapter.isAvailable(mockRequest);
			expect(isAvailable).toBe(true);
		});

		it('should detect unavailability for HTTP non-localhost', async () => {
			const httpsRequest = {
				...mockRequest,
				headers: { host: 'example.com' },
				protocol: 'http'
			};

			const isAvailable = await webauthnAdapter.isAvailable(httpsRequest);
			expect(isAvailable).toBe(false);
		});

		it('should detect availability for HTTPS', async () => {
			const httpsRequest = {
				...mockRequest,
				headers: { host: 'example.com' },
				protocol: 'https'
			};

			const isAvailable = await webauthnAdapter.isAvailable(httpsRequest);
			expect(isAvailable).toBe(true);
		});
	});

	describe('Registration Flow', () => {
		it('should begin registration process', async () => {
			const result = await webauthnAdapter.beginAuthentication(mockRequest, 'webauthn-register', {
				userId: testUserId,
				deviceName: 'Test Device'
			});

			expect(result.sessionId).toBeDefined();
			expect(result.method).toBe('webauthn-register');
			expect(result.challenge).toBeDefined();
			expect(result.requiresUserInteraction).toBe(true);
		});

		it('should fail registration without user ID', async () => {
			await expect(
				webauthnAdapter.beginAuthentication(mockRequest, 'webauthn-register', {
					deviceName: 'Test Device'
				})
			).rejects.toThrow('User ID required for WebAuthn registration');
		});

		it('should complete registration process', async () => {
			// Begin registration
			const beginResult = await webauthnAdapter.beginAuthentication(
				mockRequest,
				'webauthn-register',
				{ userId: testUserId, deviceName: 'Test Device' }
			);

			// Mock credential response
			const mockCredential = {
				id: 'test-credential-id',
				response: {
					clientDataJSON: btoa(
						JSON.stringify({
							challenge: beginResult.challenge.challenge,
							type: 'webauthn.create',
							origin: 'http://localhost'
						})
					),
					attestationObject: 'mock-attestation-object'
				},
				type: 'public-key'
			};

			const result = await webauthnAdapter.completeAuthentication(
				beginResult.sessionId,
				mockRequest,
				{ credential: mockCredential }
			);

			expect(result.success).toBe(true);
			expect(result.method).toBe('webauthn-register');
			expect(result.userId).toBe(testUserId);
			expect(result.credentialId).toBeDefined();
		});
	});

	describe('Authentication Flow', () => {
		beforeEach(async () => {
			// Register a credential first
			const beginResult = await webauthnAdapter.beginAuthentication(
				mockRequest,
				'webauthn-register',
				{ userId: testUserId, deviceName: 'Test Device' }
			);

			const mockCredential = {
				id: 'test-credential-id',
				response: {
					clientDataJSON: btoa(
						JSON.stringify({
							challenge: beginResult.challenge.challenge,
							type: 'webauthn.create',
							origin: 'http://localhost'
						})
					),
					attestationObject: 'mock-attestation-object'
				},
				type: 'public-key'
			};

			await webauthnAdapter.completeAuthentication(beginResult.sessionId, mockRequest, {
				credential: mockCredential
			});
		});

		it('should begin authentication process', async () => {
			const result = await webauthnAdapter.beginAuthentication(
				mockRequest,
				'webauthn-authenticate',
				{ username: 'testuser' }
			);

			expect(result.sessionId).toBeDefined();
			expect(result.method).toBe('webauthn-authenticate');
			expect(result.challenge).toBeDefined();
			expect(result.requiresUserInteraction).toBe(true);
		});

		it('should complete authentication process', async () => {
			// Begin authentication
			const beginResult = await webauthnAdapter.beginAuthentication(
				mockRequest,
				'webauthn-authenticate',
				{ username: 'testuser' }
			);

			// Mock credential response
			const mockCredential = {
				id: 'test-credential-id',
				response: {
					clientDataJSON: btoa(
						JSON.stringify({
							challenge: beginResult.challenge.challenge,
							type: 'webauthn.get',
							origin: 'http://localhost'
						})
					),
					authenticatorData: 'mock-authenticator-data',
					signature: 'mock-signature'
				}
			};

			const result = await webauthnAdapter.completeAuthentication(
				beginResult.sessionId,
				mockRequest,
				{ credential: mockCredential }
			);

			expect(result.success).toBe(true);
			expect(result.method).toBe('webauthn-authenticate');
			expect(result.user).toBeDefined();
			expect(result.user.username).toBe('testuser');
			expect(result.authMethod).toBe('webauthn');
		});
	});

	describe('Credential Management', () => {
		beforeEach(async () => {
			// Register a credential
			const beginResult = await webauthnAdapter.beginAuthentication(
				mockRequest,
				'webauthn-register',
				{ userId: testUserId, deviceName: 'Test Device' }
			);

			const mockCredential = {
				id: 'test-credential-id',
				response: {
					clientDataJSON: btoa(
						JSON.stringify({
							challenge: beginResult.challenge.challenge,
							type: 'webauthn.create',
							origin: 'http://localhost'
						})
					),
					attestationObject: 'mock-attestation-object'
				},
				type: 'public-key'
			};

			await webauthnAdapter.completeAuthentication(beginResult.sessionId, mockRequest, {
				credential: mockCredential
			});
		});

		it('should get user credentials', async () => {
			const credentials = await webauthnAdapter.getUserCredentials(testUserId);

			expect(credentials).toHaveLength(1);
			expect(credentials[0].deviceName).toBe('Test Device');
		});

		it('should revoke credentials', async () => {
			const credentials = await webauthnAdapter.getUserCredentials(testUserId);
			const credentialId = credentials[0].id;

			const result = await webauthnAdapter.revokeCredential(credentialId, testUserId);

			expect(result.success).toBe(true);
		});
	});

	describe('Session Management', () => {
		it('should generate unique session IDs', () => {
			const sessionId1 = webauthnAdapter.generateSessionId();
			const sessionId2 = webauthnAdapter.generateSessionId();

			expect(sessionId1).not.toBe(sessionId2);
			expect(sessionId1).toMatch(/^webauthn_\d+_\w+$/);
		});

		it('should cleanup expired sessions', () => {
			// Create a mock session
			const sessionId = webauthnAdapter.generateSessionId();
			webauthnAdapter.activeSessions.set(sessionId, {
				method: 'webauthn-register',
				userId: testUserId,
				timestamp: Date.now() - 6 * 60 * 1000 // 6 minutes ago
			});

			// Verify session exists
			expect(webauthnAdapter.activeSessions.has(sessionId)).toBe(true);

			// Run cleanup
			webauthnAdapter.cleanupExpiredSessions();

			// Verify session was cleaned up
			expect(webauthnAdapter.activeSessions.has(sessionId)).toBe(false);
		});

		it('should fail completion with invalid session ID', async () => {
			const mockCredential = {
				id: 'test-credential-id',
				response: {
					clientDataJSON: 'mock-client-data',
					attestationObject: 'mock-attestation-object'
				}
			};

			await expect(
				webauthnAdapter.completeAuthentication('invalid-session-id', mockRequest, {
					credential: mockCredential
				})
			).rejects.toThrow('Invalid or expired authentication session');
		});
	});

	describe('Configuration', () => {
		it('should get WebAuthn config', async () => {
			const config = await webauthnAdapter.getConfig(mockRequest);

			expect(config.rpId).toBe('localhost');
			expect(config.rpName).toBe('Dispatch Development Environment');
			expect(config.isAvailable).toBe(true);
		});

		it('should check hostname compatibility', async () => {
			const compatibility = await webauthnAdapter.checkHostnameCompatibility(
				'localhost',
				'example.com'
			);

			expect(compatibility.compatible).toBe(false);
			expect(compatibility.requiresReregistration).toBe(true);
		});
	});

	describe('Error Handling', () => {
		it('should handle unsupported methods', async () => {
			await expect(
				webauthnAdapter.beginAuthentication(mockRequest, 'unsupported-method', {})
			).rejects.toThrow('Unsupported WebAuthn method: unsupported-method');
		});

		it('should reject traditional authenticate method', async () => {
			await expect(webauthnAdapter.authenticate({ username: 'test' })).rejects.toThrow(
				'WebAuthn requires begin/complete authentication flow'
			);
		});

		it('should handle WebAuthn unavailability', async () => {
			const httpRequest = {
				headers: { host: 'example.com' },
				protocol: 'http'
			};

			await expect(
				webauthnAdapter.beginAuthentication(httpRequest, 'webauthn-register', {
					userId: testUserId
				})
			).rejects.toThrow('WebAuthn not available in current environment');
		});
	});

	describe('Validation', () => {
		it('should validate credentials', () => {
			const result = webauthnAdapter.validateCredentials({ username: 'test' });
			expect(result.valid).toBe(true);
		});
	});
});
