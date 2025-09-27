import {
	generateRegistrationOptions,
	verifyRegistrationResponse,
	generateAuthenticationOptions,
	verifyAuthenticationResponse
} from '@simplewebauthn/server';
import { logger } from '../shared/utils/logger.js';
import crypto from 'crypto';

/**
 * WebAuthn Manager for phish-resistant authentication
 */
export class WebAuthnManager {
	constructor(databaseManager) {
		this.db = databaseManager;
		this.rpName = 'Dispatch Terminal';
		this.rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
		this.origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';
		this.challenges = new Map(); // In production, use Redis or database
	}

	async init() {
		await this.createWebAuthnTables();
	}

	async createWebAuthnTables() {
		// WebAuthn credentials table
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS webauthn_credentials (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				credential_id TEXT NOT NULL UNIQUE,
				credential_public_key BLOB NOT NULL,
				counter INTEGER NOT NULL DEFAULT 0,
				credential_device_type TEXT,
				credential_backed_up BOOLEAN DEFAULT FALSE,
				transports TEXT, -- JSON array
				name TEXT, -- User-friendly name for the credential
				created_at INTEGER NOT NULL,
				last_used_at INTEGER,
				FOREIGN KEY (user_id) REFERENCES users(id)
			)
		`);

		// WebAuthn challenges table (temporary storage)
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS webauthn_challenges (
				id TEXT PRIMARY KEY,
				challenge TEXT NOT NULL,
				user_id TEXT,
				type TEXT NOT NULL, -- 'registration' or 'authentication'
				expires_at INTEGER NOT NULL,
				created_at INTEGER NOT NULL
			)
		`);
	}

	/**
	 * Generate registration options for a new WebAuthn credential
	 */
	async generateRegistrationOptions(userId, username, userDisplayName) {
		// Get existing credentials for this user
		const existingCredentials = await this.db.all(
			'SELECT credential_id FROM webauthn_credentials WHERE user_id = ?',
			[userId]
		);

		const excludeCredentials = existingCredentials.map(cred => ({
			id: Buffer.from(cred.credential_id, 'base64url'),
			type: 'public-key'
		}));

		const options = await generateRegistrationOptions({
			rpName: this.rpName,
			rpID: this.rpID,
			userID: userId,
			userName: username,
			userDisplayName: userDisplayName || username,
			timeout: 60000,
			attestationType: 'none',
			excludeCredentials,
			authenticatorSelection: {
				residentKey: 'preferred',
				userVerification: 'preferred'
				// Remove authenticatorAttachment to allow both platform and cross-platform authenticators
			},
			supportedAlgorithmIDs: [-7, -257] // ES256, RS256
		});

		// Store challenge temporarily
		const challengeId = crypto.randomUUID();
		const expiresAt = Date.now() + 60000; // 1 minute

		await this.db.run(
			`INSERT INTO webauthn_challenges (id, challenge, user_id, type, expires_at, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[challengeId, options.challenge, userId, 'registration', expiresAt, Date.now()]
		);

		return { ...options, challengeId };
	}

	/**
	 * Verify registration response and store credential
	 */
	async verifyRegistrationResponse(challengeId, response, credentialName) {
		// Get and validate challenge
		const challengeRecord = await this.db.get(
			'SELECT * FROM webauthn_challenges WHERE id = ? AND type = ?',
			[challengeId, 'registration']
		);

		if (!challengeRecord || challengeRecord.expires_at < Date.now()) {
			throw new Error('Invalid or expired challenge');
		}

		// Verify the registration response
		const verification = await verifyRegistrationResponse({
			response,
			expectedChallenge: challengeRecord.challenge,
			expectedOrigin: this.origin,
			expectedRPID: this.rpID,
			requireUserVerification: false // Match the 'preferred' setting from registration options
		});

		if (!verification.verified || !verification.registrationInfo) {
			throw new Error('Registration verification failed');
		}

		const { registrationInfo } = verification;

		// Store the credential
		const credentialId = crypto.randomUUID();
		await this.db.run(
			`INSERT INTO webauthn_credentials 
			 (id, user_id, credential_id, credential_public_key, counter, 
			  credential_device_type, credential_backed_up, transports, name, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				credentialId,
				challengeRecord.user_id,
				Buffer.from(registrationInfo.credentialID).toString('base64url'),
				registrationInfo.credentialPublicKey,
				registrationInfo.counter,
				registrationInfo.credentialDeviceType,
				registrationInfo.credentialBackedUp,
				JSON.stringify(response.response.transports || []),
				credentialName || 'WebAuthn Credential',
				Date.now()
			]
		);

		// Clean up challenge
		await this.db.run('DELETE FROM webauthn_challenges WHERE id = ?', [challengeId]);

		return { verified: true, credentialId };
	}

	/**
	 * Generate authentication options for WebAuthn login
	 */
	async generateAuthenticationOptions(userHandle = null) {
		let allowCredentials = [];

		if (userHandle) {
			// Get credentials for specific user
			const userCredentials = await this.db.all(
				'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?',
				[userHandle]
			);

			allowCredentials = userCredentials.map(cred => ({
				id: Buffer.from(cred.credential_id, 'base64url'),
				type: 'public-key',
				transports: JSON.parse(cred.transports || '[]')
			}));
		}

		const options = await generateAuthenticationOptions({
			timeout: 60000,
			allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
			userVerification: 'preferred',
			rpID: this.rpID
		});

		// Store challenge temporarily
		const challengeId = crypto.randomUUID();
		const expiresAt = Date.now() + 60000;

		await this.db.run(
			`INSERT INTO webauthn_challenges (id, challenge, user_id, type, expires_at, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[challengeId, options.challenge, userHandle, 'authentication', expiresAt, Date.now()]
		);

		return { ...options, challengeId };
	}

	/**
	 * Verify authentication response and return user
	 */
	async verifyAuthenticationResponse(challengeId, response) {
		// Get challenge
		const challengeRecord = await this.db.get(
			'SELECT * FROM webauthn_challenges WHERE id = ? AND type = ?',
			[challengeId, 'authentication']
		);

		if (!challengeRecord || challengeRecord.expires_at < Date.now()) {
			throw new Error('Invalid or expired challenge');
		}

		// Find the credential
		const credentialId = Buffer.from(response.rawId, 'base64url').toString('base64url');
		const credential = await this.db.get(
			'SELECT * FROM webauthn_credentials WHERE credential_id = ?',
			[credentialId]
		);

		if (!credential) {
			throw new Error('Credential not found');
		}

		// Verify the authentication response
		const verification = await verifyAuthenticationResponse({
			response,
			expectedChallenge: challengeRecord.challenge,
			expectedOrigin: this.origin,
			expectedRPID: this.rpID,
			authenticator: {
				credentialID: Buffer.from(credential.credential_id, 'base64url'),
				credentialPublicKey: credential.credential_public_key,
				counter: credential.counter,
				transports: JSON.parse(credential.transports || '[]')
			},
			requireUserVerification: false // Match the 'preferred' setting from authentication options
		});

		if (!verification.verified) {
			throw new Error('Authentication verification failed');
		}

		// Update counter and last used
		await this.db.run(
			'UPDATE webauthn_credentials SET counter = ?, last_used_at = ? WHERE id = ?',
			[verification.authenticationInfo.newCounter, Date.now(), credential.id]
		);

		// Clean up challenge
		await this.db.run('DELETE FROM webauthn_challenges WHERE id = ?', [challengeId]);

		// Get user info
		const user = await this.db.get('SELECT * FROM users WHERE id = ?', [credential.user_id]);

		return { verified: true, user };
	}

	/**
	 * Get user's WebAuthn credentials
	 */
	async getUserCredentials(userId) {
		return await this.db.all(
			`SELECT id, name, credential_device_type, created_at, last_used_at, transports
			 FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at DESC`,
			[userId]
		);
	}

	/**
	 * Delete a WebAuthn credential
	 */
	async deleteCredential(userId, credentialId) {
		const result = await this.db.run(
			'DELETE FROM webauthn_credentials WHERE id = ? AND user_id = ?',
			[credentialId, userId]
		);

		return result.changes > 0;
	}

	/**
	 * Clean up expired challenges
	 */
	async cleanupExpiredChallenges() {
		const now = Date.now();
		await this.db.run('DELETE FROM webauthn_challenges WHERE expires_at < ?', [now]);
	}
}