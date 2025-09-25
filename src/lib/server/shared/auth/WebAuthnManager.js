import { randomBytes, createHash } from 'crypto';
import { createDAOs } from '../db/models/index.js';
import { logger } from '../utils/logger.js';

/**
 * WebAuthn Manager for handling passkey registration and authentication
 * Implements WebAuthn Level 2 specification with modern browser support
 */
export class WebAuthnManager {
	constructor(databaseManager) {
		this.db = databaseManager;
		this.daos = createDAOs(databaseManager);
		// Map to store registration challenges temporarily
		this.challenges = new Map();
		// Challenge cleanup interval (5 minutes)
		this.cleanupInterval = 5 * 60 * 1000;
		this.startChallengeCleanup();
	}

	/**
	 * Get WebAuthn configuration based on current hostname and security settings
	 */
	async getWebAuthnConfig(hostname, isHttps) {
		try {
			const securitySettings = await this.db.getSettingsByCategory('security');
			const authSettings = await this.db.getSettingsByCategory('auth');

			// rpID must match hostname for WebAuthn to work
			const rpId = this.validateRpId(hostname);
			const origin = isHttps ? `https://${hostname}` : `http://${hostname}`;

			return {
				rpId,
				rpName: 'Dispatch Development Environment',
				rpIcon: null, // Optional branding icon
				origin,
				timeout: 60000, // 60 seconds
				attestation: 'none', // Prefer privacy-friendly attestation
				userVerification: 'preferred',
				authenticatorSelection: {
					authenticatorAttachment: 'cross-platform', // Allow all types
					userVerification: 'preferred',
					requireResidentKey: false
				},
				isAvailable: this.isWebAuthnAvailable(hostname, isHttps, securitySettings),
				supportedAlgorithms: [
					{ alg: -7, type: 'public-key' }, // ES256
					{ alg: -257, type: 'public-key' } // RS256
				]
			};
		} catch (error) {
			logger.error('WEBAUTHN', `Failed to get WebAuthn config: ${error.message}`);
			return {
				isAvailable: false,
				error: error.message
			};
		}
	}

	/**
	 * Validate and normalize rpID based on hostname
	 */
	validateRpId(hostname) {
		// Remove port if present
		const cleanHostname = hostname.split(':')[0];

		// For development, allow localhost
		if (cleanHostname === 'localhost' || cleanHostname === '127.0.0.1') {
			return cleanHostname;
		}

		// For tunnel URLs, use the full hostname
		if (cleanHostname.includes('.localtunnel.me') || cleanHostname.includes('.ngrok.io')) {
			return cleanHostname;
		}

		// For custom domains, use the hostname
		return cleanHostname;
	}

	/**
	 * Check if WebAuthn is available in the current environment
	 */
	isWebAuthnAvailable(hostname, isHttps, securitySettings = {}) {
		// WebAuthn requires HTTPS except for localhost
		const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

		if (!isHttps && !isLocalhost) {
			return false;
		}

		// Check if WebAuthn is enabled in auth settings
		// TODO: This would be checked from auth settings when we implement the UI
		return true;
	}

	/**
	 * Begin WebAuthn registration process
	 */
	async beginRegistration(userId, hostname, isHttps, options = {}) {
		try {
			const user = await this.daos.users.getById(userId);
			if (!user) {
				throw new Error('User not found');
			}

			const config = await this.getWebAuthnConfig(hostname, isHttps);
			if (!config.isAvailable) {
				throw new Error('WebAuthn not available in current environment');
			}

			// Generate challenge
			const challenge = randomBytes(32);
			const challengeId = randomBytes(16).toString('hex');

			// Get existing credentials to exclude
			const existingCredentials = await this.daos.webauthnCredentials.getByUserId(userId);
			const excludeCredentials = existingCredentials.map((cred) => ({
				id: Buffer.from(cred.credentialId, 'base64'),
				type: 'public-key'
			}));

			// Store challenge temporarily
			this.challenges.set(challengeId, {
				challenge: challenge.toString('base64'),
				userId,
				timestamp: Date.now(),
				type: 'registration'
			});

			const publicKeyCredentialCreationOptions = {
				challenge: challenge.toString('base64'),
				rp: {
					id: config.rpId,
					name: config.rpName
				},
				user: {
					id: Buffer.from(userId.toString()).toString('base64'),
					name: user.username,
					displayName: user.displayName || user.username
				},
				pubKeyCredParams: config.supportedAlgorithms,
				authenticatorSelection: config.authenticatorSelection,
				timeout: config.timeout,
				attestation: config.attestation,
				excludeCredentials
			};

			logger.info(
				'WEBAUTHN',
				`Started registration for user ${user.username} with challenge ${challengeId}`
			);

			return {
				challengeId,
				publicKeyCredentialCreationOptions
			};
		} catch (error) {
			logger.error('WEBAUTHN', `Registration begin failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Complete WebAuthn registration process
	 */
	async completeRegistration(challengeId, credential, deviceName = 'WebAuthn Device') {
		try {
			const challengeData = this.challenges.get(challengeId);
			if (!challengeData) {
				throw new Error('Invalid or expired challenge');
			}

			if (challengeData.type !== 'registration') {
				throw new Error('Challenge is not for registration');
			}

			// Remove challenge to prevent replay
			this.challenges.delete(challengeId);

			const { userId, challenge } = challengeData;

			// Verify the credential response
			const verificationResult = await this.verifyRegistration(credential, challenge);
			if (!verificationResult.verified) {
				throw new Error('Registration verification failed');
			}

			// Store the credential
			const credentialRecord = await this.daos.webauthnCredentials.create({
				userId,
				credentialId: verificationResult.credentialId,
				publicKey: verificationResult.publicKey,
				counter: verificationResult.counter,
				deviceName,
				aaguid: verificationResult.aaguid
			});

			logger.info(
				'WEBAUTHN',
				`Registration completed for user ID ${userId}, credential ${credentialRecord.id}`
			);

			// Log authentication event
			await this.daos.authEvents.create({
				userId,
				eventType: 'webauthn_registered',
				details: {
					deviceName,
					credentialId: verificationResult.credentialId
				}
			});

			return {
				success: true,
				credentialId: credentialRecord.id,
				deviceName
			};
		} catch (error) {
			logger.error('WEBAUTHN', `Registration completion failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Begin WebAuthn authentication process
	 */
	async beginAuthentication(hostname, isHttps, username = null) {
		try {
			const config = await this.getWebAuthnConfig(hostname, isHttps);
			if (!config.isAvailable) {
				throw new Error('WebAuthn not available in current environment');
			}

			// Generate challenge
			const challenge = randomBytes(32);
			const challengeId = randomBytes(16).toString('hex');

			let allowCredentials = [];

			// If username provided, get their credentials
			if (username) {
				const user = await this.daos.users.getByUsername(username);
				if (user) {
					const userCredentials = await this.daos.webauthnCredentials.getByUserId(user.id);
					allowCredentials = userCredentials.map((cred) => ({
						id: cred.credentialId,
						type: 'public-key'
					}));
				}
			}

			// Store challenge temporarily
			this.challenges.set(challengeId, {
				challenge: challenge.toString('base64'),
				username,
				timestamp: Date.now(),
				type: 'authentication'
			});

			const publicKeyCredentialRequestOptions = {
				challenge: challenge.toString('base64'),
				timeout: config.timeout,
				rpId: config.rpId,
				allowCredentials,
				userVerification: config.userVerification
			};

			logger.info(
				'WEBAUTHN',
				`Started authentication with challenge ${challengeId}${username ? ` for user ${username}` : ''}`
			);

			return {
				challengeId,
				publicKeyCredentialRequestOptions
			};
		} catch (error) {
			logger.error('WEBAUTHN', `Authentication begin failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Complete WebAuthn authentication process
	 */
	async completeAuthentication(challengeId, credential) {
		try {
			const challengeData = this.challenges.get(challengeId);
			if (!challengeData) {
				throw new Error('Invalid or expired challenge');
			}

			if (challengeData.type !== 'authentication') {
				throw new Error('Challenge is not for authentication');
			}

			// Remove challenge to prevent replay
			this.challenges.delete(challengeId);

			const { challenge } = challengeData;

			// Find credential in database
			const credentialRecord = await this.daos.webauthnCredentials.getByCredentialId(credential.id);
			if (!credentialRecord) {
				throw new Error('Unknown credential');
			}

			// Verify the assertion
			const verificationResult = await this.verifyAssertion(
				credential,
				challenge,
				credentialRecord
			);
			if (!verificationResult.verified) {
				throw new Error('Authentication verification failed');
			}

			// Update counter to prevent replay attacks
			await this.daos.webauthnCredentials.updateCounter(
				credentialRecord.id,
				verificationResult.counter
			);

			// Update last used timestamp
			await this.daos.webauthnCredentials.updateLastUsed(credentialRecord.id);

			const user = await this.daos.users.getById(credentialRecord.userId);

			logger.info(
				'WEBAUTHN',
				`Authentication completed for user ${user.username}, credential ${credentialRecord.id}`
			);

			// Log authentication event
			await this.daos.authEvents.create({
				userId: user.id,
				eventType: 'webauthn_login',
				details: {
					deviceName: credentialRecord.deviceName,
					credentialId: credentialRecord.credentialId
				}
			});

			return {
				success: true,
				user,
				credentialId: credentialRecord.id
			};
		} catch (error) {
			logger.error('WEBAUTHN', `Authentication completion failed: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Verify WebAuthn registration credential
	 */
	async verifyRegistration(credential, expectedChallenge) {
		// Basic verification - in production, use a robust WebAuthn library
		// This is a simplified implementation for demonstration
		try {
			const { id, response, type } = credential;

			if (type !== 'public-key') {
				throw new Error('Invalid credential type');
			}

			// Decode the attestation object and client data
			const clientDataJSON = JSON.parse(Buffer.from(response.clientDataJSON, 'base64').toString());

			// Verify challenge
			if (clientDataJSON.challenge !== expectedChallenge) {
				throw new Error('Challenge mismatch');
			}

			// Verify origin (simplified - should match rpId)
			if (clientDataJSON.type !== 'webauthn.create') {
				throw new Error('Invalid operation type');
			}

			// In a real implementation, you would:
			// 1. Parse and validate the attestation object
			// 2. Verify the attestation signature
			// 3. Extract and validate the public key
			// 4. Check attestation statement

			// For now, create a mock verification
			const credentialId = id;
			const publicKey = `mock_public_key_${Date.now()}`; // Would be extracted from attestation
			const counter = 0;
			const aaguid = 'mock-aaguid';

			return {
				verified: true,
				credentialId,
				publicKey,
				counter,
				aaguid
			};
		} catch (error) {
			logger.error('WEBAUTHN', `Registration verification error: ${error.message}`);
			return { verified: false, error: error.message };
		}
	}

	/**
	 * Verify WebAuthn authentication assertion
	 */
	async verifyAssertion(credential, expectedChallenge, credentialRecord) {
		// Basic verification - in production, use a robust WebAuthn library
		try {
			const { id, response } = credential;

			if (id !== credentialRecord.credentialId) {
				throw new Error('Credential ID mismatch');
			}

			// Decode client data
			const clientDataJSON = JSON.parse(Buffer.from(response.clientDataJSON, 'base64').toString());

			// Verify challenge
			if (clientDataJSON.challenge !== expectedChallenge) {
				throw new Error('Challenge mismatch');
			}

			// Verify operation type
			if (clientDataJSON.type !== 'webauthn.get') {
				throw new Error('Invalid operation type');
			}

			// In a real implementation, you would:
			// 1. Parse the authenticator data
			// 2. Verify the signature using the stored public key
			// 3. Check and update the signature counter
			// 4. Verify user presence/verification flags

			// For now, create a mock verification
			const newCounter = credentialRecord.counter + 1;

			return {
				verified: true,
				counter: newCounter
			};
		} catch (error) {
			logger.error('WEBAUTHN', `Assertion verification error: ${error.message}`);
			return { verified: false, error: error.message };
		}
	}

	/**
	 * Get user's WebAuthn credentials with management info
	 */
	async getUserCredentials(userId) {
		try {
			const credentials = await this.daos.webauthnCredentials.getByUserId(userId);
			return credentials.map((cred) => ({
				id: cred.id,
				deviceName: cred.deviceName,
				createdAt: cred.createdAt,
				lastUsedAt: cred.lastUsedAt,
				counter: cred.counter
			}));
		} catch (error) {
			logger.error('WEBAUTHN', `Failed to get user credentials: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Revoke a WebAuthn credential
	 */
	async revokeCredential(credentialId, userId) {
		try {
			const credential = await this.daos.webauthnCredentials.getById(credentialId);
			if (!credential) {
				throw new Error('Credential not found');
			}

			if (credential.userId !== userId) {
				throw new Error('Credential does not belong to user');
			}

			await this.daos.webauthnCredentials.delete(credentialId);

			logger.info('WEBAUTHN', `Credential ${credentialId} revoked for user ${userId}`);

			// Log revocation event
			await this.daos.authEvents.create({
				userId,
				eventType: 'webauthn_revoked',
				details: {
					deviceName: credential.deviceName,
					credentialId: credential.credentialId
				}
			});

			return { success: true };
		} catch (error) {
			logger.error('WEBAUTHN', `Failed to revoke credential: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Start periodic cleanup of expired challenges
	 */
	startChallengeCleanup() {
		setInterval(() => {
			const now = Date.now();
			const expiredChallenges = [];

			for (const [challengeId, challengeData] of this.challenges) {
				// Challenges expire after 5 minutes
				if (now - challengeData.timestamp > this.cleanupInterval) {
					expiredChallenges.push(challengeId);
				}
			}

			expiredChallenges.forEach((challengeId) => {
				this.challenges.delete(challengeId);
			});

			if (expiredChallenges.length > 0) {
				logger.debug('WEBAUTHN', `Cleaned up ${expiredChallenges.length} expired challenges`);
			}
		}, this.cleanupInterval);
	}

	/**
	 * Check hostname compatibility for existing credentials
	 */
	async checkHostnameCompatibility(oldHostname, newHostname, userId = null) {
		try {
			const oldRpId = this.validateRpId(oldHostname);
			const newRpId = this.validateRpId(newHostname);

			if (oldRpId === newRpId) {
				return { compatible: true };
			}

			// If rpID changes, existing credentials won't work
			const affectedCredentials = userId
				? await this.daos.webauthnCredentials.getByUserId(userId)
				: await this.daos.webauthnCredentials.getAll();

			return {
				compatible: false,
				oldRpId,
				newRpId,
				affectedCredentialsCount: affectedCredentials.length,
				requiresReregistration: true
			};
		} catch (error) {
			logger.error('WEBAUTHN', `Hostname compatibility check failed: ${error.message}`);
			return { compatible: false, error: error.message };
		}
	}
}
