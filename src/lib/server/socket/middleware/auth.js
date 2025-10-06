/**
 * Authentication Middleware Factory
 * @file Creates Socket.IO authentication middleware using JWT
 */

import { JWTService } from "$lib/server/auth/JWTService";

/**
 * Create authentication middleware
 * @param {JWTService} jwtService - JWT service instance
 * @returns {Function} Socket.IO middleware function
 */
export function createAuthMiddleware(jwtService) {
	return ([event, ...args], next) => {
		// Skip auth for certain events
		const publicEvents = ['client:hello'];
		if (publicEvents.includes(event)) {
			return next();
		}

		// Extract auth key from event data
		const data = args[0];
		const token = data?.authKey;

		if (!token) {
			return next(new Error('Authentication required'));
		}

		try {
			// Validate JWT token
			const claims = jwtService.validateToken(token);

			// Attach user info to data for downstream handlers
			if (data) {
				data.userId = claims.userId;
				data.authClaims = claims;
			}

			next();
		} catch (err) {
			next(new Error(`Authentication failed: ${err.message}`));
		}
	};
}
