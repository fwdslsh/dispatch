/**
 * JWTService - JWT token operations
 * @file Handles JWT token generation and validation
 */

import jwt from 'jsonwebtoken';

export class JWTService {
	#secret;

	/**
	 * @param {string} secret - JWT signing secret (TERMINAL_KEY)
	 */
	constructor(secret) {
		if (!secret) {
			throw new Error('JWT secret required');
		}
		this.#secret = secret;
	}

	/**
	 * Generate JWT token
	 * @param {Object} payload - Token payload
	 * @param {string} payload.userId - User ID
	 * @param {Object} [options] - JWT options
	 * @param {string} [options.expiresIn='30d'] - Expiration time
	 * @returns {string} JWT token
	 */
	generateToken(payload, options = {}) {
		return jwt.sign(payload, this.#secret, {
			expiresIn: options.expiresIn || '30d'
		});
	}

	/**
	 * Validate and decode JWT token
	 * @param {string} token - JWT token
	 * @returns {Object} Decoded token payload
	 * @throws {Error} If token invalid or expired
	 */
	validateToken(token) {
		return jwt.verify(token, this.#secret);
	}

	/**
	 * Refresh token expiration
	 * @param {string} token - Existing JWT token
	 * @returns {string} New JWT token with extended expiration
	 */
	refreshToken(token) {
		const payload = this.validateToken(token);
		// Remove JWT-specific claims
		delete payload.iat;
		delete payload.exp;
		return this.generateToken(payload);
	}
}
