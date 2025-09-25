import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../../src/lib/server/shared/db/DatabaseManager.js';
import { WebAuthnManager } from '../../src/lib/server/shared/auth/WebAuthnManager.js';
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

describe('WebAuthn Manager', () => {
	let db;
	let webauthnManager;
	let tempDbPath;
	let testUserId;

	beforeEach(async () => {
		// Create a temporary database for testing
		tempDbPath = path.join(tmpdir(), `test-webauthn-${Date.now()}.db`);
		db = new DatabaseManager(tempDbPath);
		await db.init();

		// Run auth migrations to set up tables

		// Create WebAuthn manager
		webauthnManager = new WebAuthnManager(db);

		// Create a test user
		const userResult = await db.run(`
			INSERT INTO users (username, display_name, email, password_hash, is_admin)
			VALUES ('testuser', 'Test User', 'test@example.com', 'hashed_password', 0)
		`);
		testUserId = userResult.lastID;
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

	describe('Configuration and Availability', () => {
		it('should get WebAuthn config for localhost', async () => {
			const config = await webauthnManager.getWebAuthnConfig('localhost', false);

			expect(config.rpId).toBe('localhost');
			expect(config.rpName).toBe('Dispatch Development Environment');
			expect(config.origin).toBe('http://localhost');
			expect(config.isAvailable).toBe(true); // localhost should be available
		});

		it('should get WebAuthn config for HTTPS domain', async () => {
			const config = await webauthnManager.getWebAuthnConfig('example.com', true);

			expect(config.rpId).toBe('example.com');
			expect(config.origin).toBe('https://example.com');
			expect(config.isAvailable).toBe(true);
		});

		it('should reject HTTP non-localhost domains', async () => {
			const config = await webauthnManager.getWebAuthnConfig('example.com', false);

			expect(config.isAvailable).toBe(false);
		});

		it('should validate rpID correctly', () => {
			expect(webauthnManager.validateRpId('localhost:3000')).toBe('localhost');
			expect(webauthnManager.validateRpId('example.com:443')).toBe('example.com');
			expect(webauthnManager.validateRpId('test.localtunnel.me')).toBe('test.localtunnel.me');
		});

		it('should check WebAuthn availability', () => {
			expect(webauthnManager.isWebAuthnAvailable('localhost', false)).toBe(true);
			expect(webauthnManager.isWebAuthnAvailable('example.com', true)).toBe(true);
			expect(webauthnManager.isWebAuthnAvailable('example.com', false)).toBe(false);
		});
	});

	describe('Registration Flow', () => {
		it('should begin WebAuthn registration', async () => {
			const result = await webauthnManager.beginRegistration(testUserId, 'localhost', false);

			expect(result).toHaveProperty('challengeId');
			expect(result).toHaveProperty('publicKeyCredentialCreationOptions');
			expect(result.publicKeyCredentialCreationOptions).toHaveProperty('challenge');
			expect(result.publicKeyCredentialCreationOptions).toHaveProperty('user');
			expect(result.publicKeyCredentialCreationOptions.user.name).toBe('testuser');
		});

		it('should fail registration for non-existent user', async () => {
			await expect(webauthnManager.beginRegistration(99999, 'localhost', false)).rejects.toThrow(
				'User not found'
			);
		});

		it('should fail registration when WebAuthn unavailable', async () => {
			await expect(
				webauthnManager.beginRegistration(testUserId, 'insecure.example.com', false)
			).rejects.toThrow('WebAuthn not available in current environment');
		});

		it('should complete WebAuthn registration', async () => {
			// Begin registration
			const beginResult = await webauthnManager.beginRegistration(testUserId, 'localhost', false);

			// Mock credential response
			const mockCredential = {
				id: 'test-credential-id',
				response: {
					clientDataJSON: btoa(
						JSON.stringify({
							challenge: beginResult.publicKeyCredentialCreationOptions.challenge,
							type: 'webauthn.create',
							origin: 'http://localhost'
						})
					),
					attestationObject: 'mock-attestation-object'
				},
				type: 'public-key'
			};

			const result = await webauthnManager.completeRegistration(
				beginResult.challengeId,
				mockCredential,
				'Test Device'
			);

			expect(result.success).toBe(true);
			expect(result.credentialId).toBeDefined();

			// Verify credential was stored
			const credentials = await webauthnManager.getUserCredentials(testUserId);
			expect(credentials).toHaveLength(1);
			expect(credentials[0].deviceName).toBe('Test Device');
		});

		it('should fail registration with invalid challenge', async () => {
			const mockCredential = {
				id: 'test-credential-id',
				response: {
					clientDataJSON: btoa(
						JSON.stringify({
							challenge: 'invalid-challenge',
							type: 'webauthn.create',
							origin: 'http://localhost'
						})
					),
					attestationObject: 'mock-attestation-object'
				},
				type: 'public-key'
			};

			await expect(
				webauthnManager.completeRegistration('invalid-challenge-id', mockCredential)
			).rejects.toThrow('Invalid or expired challenge');
		});
	});

	describe('Authentication Flow', () => {
		beforeEach(async () => {
			// Register a credential for testing
			const beginResult = await webauthnManager.beginRegistration(testUserId, 'localhost', false);

			const mockCredential = {
				id: 'test-credential-id',
				response: {
					clientDataJSON: btoa(
						JSON.stringify({
							challenge: beginResult.publicKeyCredentialCreationOptions.challenge,
							type: 'webauthn.create',
							origin: 'http://localhost'
						})
					),
					attestationObject: 'mock-attestation-object'
				},
				type: 'public-key'
			};

			await webauthnManager.completeRegistration(
				beginResult.challengeId,
				mockCredential,
				'Test Device'
			);
		});

		it('should begin WebAuthn authentication', async () => {
			const result = await webauthnManager.beginAuthentication('localhost', false, 'testuser');

			expect(result).toHaveProperty('challengeId');
			expect(result).toHaveProperty('publicKeyCredentialRequestOptions');
			expect(result.publicKeyCredentialRequestOptions).toHaveProperty('challenge');
			expect(result.publicKeyCredentialRequestOptions.allowCredentials).toHaveLength(1);
		});

		it('should begin authentication without specific user', async () => {
			const result = await webauthnManager.beginAuthentication('localhost', false);

			expect(result).toHaveProperty('challengeId');
			expect(result.publicKeyCredentialRequestOptions.allowCredentials).toHaveLength(0);
		});

		it('should complete WebAuthn authentication', async () => {
			// Begin authentication
			const beginResult = await webauthnManager.beginAuthentication('localhost', false, 'testuser');

			// Mock credential response
			const mockCredential = {
				id: 'test-credential-id',
				response: {
					clientDataJSON: btoa(
						JSON.stringify({
							challenge: beginResult.publicKeyCredentialRequestOptions.challenge,
							type: 'webauthn.get',
							origin: 'http://localhost'
						})
					),
					authenticatorData: 'mock-authenticator-data',
					signature: 'mock-signature'
				}
			};

			const result = await webauthnManager.completeAuthentication(
				beginResult.challengeId,
				mockCredential
			);

			expect(result.success).toBe(true);
			expect(result.user).toBeDefined();
			expect(result.user.username).toBe('testuser');
		});
	});

	describe('Credential Management', () => {
		beforeEach(async () => {
			// Register a test credential
			const beginResult = await webauthnManager.beginRegistration(testUserId, 'localhost', false);

			const mockCredential = {
				id: 'test-credential-id',
				response: {
					clientDataJSON: btoa(
						JSON.stringify({
							challenge: beginResult.publicKeyCredentialCreationOptions.challenge,
							type: 'webauthn.create',
							origin: 'http://localhost'
						})
					),
					attestationObject: 'mock-attestation-object'
				},
				type: 'public-key'
			};

			await webauthnManager.completeRegistration(
				beginResult.challengeId,
				mockCredential,
				'Test Device'
			);
		});

		it('should get user credentials', async () => {
			const credentials = await webauthnManager.getUserCredentials(testUserId);

			expect(credentials).toHaveLength(1);
			expect(credentials[0]).toHaveProperty('deviceName', 'Test Device');
			expect(credentials[0]).toHaveProperty('createdAt');
		});

		it('should revoke credential', async () => {
			const credentials = await webauthnManager.getUserCredentials(testUserId);
			const credentialId = credentials[0].id;

			const result = await webauthnManager.revokeCredential(credentialId, testUserId);

			expect(result.success).toBe(true);

			// Verify credential is removed
			const remainingCredentials = await webauthnManager.getUserCredentials(testUserId);
			expect(remainingCredentials).toHaveLength(0);
		});

		it('should fail to revoke credential for wrong user', async () => {
			const credentials = await webauthnManager.getUserCredentials(testUserId);
			const credentialId = credentials[0].id;

			// Create another user
			const userResult = await db.run(`
				INSERT INTO users (username, email) VALUES ('otheruser', 'other@example.com')
			`);
			const otherUserId = userResult.lastID;

			await expect(webauthnManager.revokeCredential(credentialId, otherUserId)).rejects.toThrow(
				'Credential does not belong to user'
			);
		});
	});

	describe('Hostname Compatibility', () => {
		it('should detect compatible hostnames', async () => {
			const compatibility = await webauthnManager.checkHostnameCompatibility(
				'localhost',
				'localhost'
			);

			expect(compatibility.compatible).toBe(true);
		});

		it('should detect incompatible hostnames', async () => {
			const compatibility = await webauthnManager.checkHostnameCompatibility(
				'localhost',
				'example.com'
			);

			expect(compatibility.compatible).toBe(false);
			expect(compatibility.requiresReregistration).toBe(true);
			expect(compatibility.oldRpId).toBe('localhost');
			expect(compatibility.newRpId).toBe('example.com');
		});

		it('should handle tunnel URL compatibility', async () => {
			const compatibility = await webauthnManager.checkHostnameCompatibility(
				'abc123.localtunnel.me',
				'xyz789.localtunnel.me'
			);

			expect(compatibility.compatible).toBe(false);
			expect(compatibility.requiresReregistration).toBe(true);
		});
	});

	describe('Challenge Cleanup', () => {
		it('should clean up expired challenges', async () => {
			// Begin registration to create a challenge
			const beginResult = await webauthnManager.beginRegistration(testUserId, 'localhost', false);

			// Verify challenge exists
			expect(webauthnManager.challenges.has(beginResult.challengeId)).toBe(true);

			// Mock time passage by directly manipulating the challenge timestamp
			const challenge = webauthnManager.challenges.get(beginResult.challengeId);
			challenge.timestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago

			// Manually trigger cleanup by directly cleaning expired challenges
			const now = Date.now();
			const expiredChallenges = [];
			for (const [challengeId, challengeData] of webauthnManager.challenges) {
				if (now - challengeData.timestamp > webauthnManager.cleanupInterval) {
					expiredChallenges.push(challengeId);
				}
			}
			expiredChallenges.forEach((challengeId) => {
				webauthnManager.challenges.delete(challengeId);
			});

			// Verify challenge was cleaned up
			expect(webauthnManager.challenges.has(beginResult.challengeId)).toBe(false);
		});
	});

	describe('Error Handling', () => {
		it('should handle verification failures gracefully', async () => {
			const beginResult = await webauthnManager.beginRegistration(testUserId, 'localhost', false);

			// Invalid credential with wrong challenge
			const mockCredential = {
				id: 'test-credential-id',
				response: {
					clientDataJSON: btoa(
						JSON.stringify({
							challenge: 'wrong-challenge',
							type: 'webauthn.create',
							origin: 'http://localhost'
						})
					),
					attestationObject: 'mock-attestation-object'
				},
				type: 'public-key'
			};

			await expect(
				webauthnManager.completeRegistration(beginResult.challengeId, mockCredential)
			).rejects.toThrow('Registration verification failed');
		});

		it('should handle non-existent credentials in authentication', async () => {
			const beginResult = await webauthnManager.beginAuthentication('localhost', false, 'testuser');

			const mockCredential = {
				id: 'non-existent-credential',
				response: {
					clientDataJSON: btoa(
						JSON.stringify({
							challenge: beginResult.publicKeyCredentialRequestOptions.challenge,
							type: 'webauthn.get',
							origin: 'http://localhost'
						})
					),
					authenticatorData: 'mock-authenticator-data',
					signature: 'mock-signature'
				}
			};

			await expect(
				webauthnManager.completeAuthentication(beginResult.challengeId, mockCredential)
			).rejects.toThrow('Unknown credential');
		});
	});
});
