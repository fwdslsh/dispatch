/**
 * Unit tests for JWTService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JWTService } from '$lib/server/auth/JWTService.js';
import jwt from 'jsonwebtoken';

describe('JWTService', () => {
	const testSecret = 'test-secret-key-12345';
	let jwtService;

	beforeEach(() => {
		jwtService = new JWTService(testSecret);
	});

	describe('constructor', () => {
		it('should create instance with valid secret', () => {
			expect(jwtService).toBeInstanceOf(JWTService);
		});

		it('should throw error if secret is missing', () => {
			expect(() => new JWTService()).toThrow('JWT secret required');
			expect(() => new JWTService('')).toThrow('JWT secret required');
			expect(() => new JWTService(null)).toThrow('JWT secret required');
		});
	});

	describe('generateToken', () => {
		it('should generate valid JWT token', () => {
			const payload = { userId: 'user-123' };
			const token = jwtService.generateToken(payload);

			expect(token).toBeTruthy();
			expect(typeof token).toBe('string');

			// Verify token structure (header.payload.signature)
			const parts = token.split('.');
			expect(parts).toHaveLength(3);
		});

		it('should include payload data in token', () => {
			const payload = { userId: 'user-123', role: 'admin' };
			const token = jwtService.generateToken(payload);

			const decoded = jwt.verify(token, testSecret);
			expect(decoded.userId).toBe('user-123');
			expect(decoded.role).toBe('admin');
		});

		it('should use default expiration of 30 days', () => {
			const payload = { userId: 'user-123' };
			const token = jwtService.generateToken(payload);

			const decoded = jwt.verify(token, testSecret);
			const expirationDate = new Date(decoded.exp * 1000);
			const now = new Date();
			const daysDiff = Math.round((expirationDate - now) / (1000 * 60 * 60 * 24));

			expect(daysDiff).toBeGreaterThanOrEqual(29);
			expect(daysDiff).toBeLessThanOrEqual(30);
		});

		it('should accept custom expiration', () => {
			const payload = { userId: 'user-123' };
			const token = jwtService.generateToken(payload, { expiresIn: '1h' });

			const decoded = jwt.verify(token, testSecret);
			const expirationDate = new Date(decoded.exp * 1000);
			const now = new Date();
			const hoursDiff = (expirationDate - now) / (1000 * 60 * 60);

			expect(hoursDiff).toBeGreaterThan(0.9);
			expect(hoursDiff).toBeLessThanOrEqual(1);
		});

		it('should include standard JWT claims', () => {
			const payload = { userId: 'user-123' };
			const token = jwtService.generateToken(payload);

			const decoded = jwt.verify(token, testSecret);
			expect(decoded.iat).toBeDefined(); // issued at
			expect(decoded.exp).toBeDefined(); // expiration
		});
	});

	describe('validateToken', () => {
		it('should validate and decode valid token', () => {
			const payload = { userId: 'user-123', role: 'admin' };
			const token = jwtService.generateToken(payload);

			const decoded = jwtService.validateToken(token);

			expect(decoded.userId).toBe('user-123');
			expect(decoded.role).toBe('admin');
		});

		it('should throw error for invalid token', () => {
			expect(() => jwtService.validateToken('invalid.token.here')).toThrow();
		});

		it('should throw error for token with wrong secret', () => {
			const otherService = new JWTService('different-secret');
			const token = otherService.generateToken({ userId: 'user-123' });

			expect(() => jwtService.validateToken(token)).toThrow();
		});

		it('should throw error for expired token', () => {
			const payload = { userId: 'user-123' };
			const token = jwtService.generateToken(payload, { expiresIn: '1ms' });

			// Wait for token to expire
			return new Promise((resolve) => {
				setTimeout(() => {
					expect(() => jwtService.validateToken(token)).toThrow();
					resolve();
				}, 10);
			});
		});

		it('should throw error for malformed token', () => {
			expect(() => jwtService.validateToken('not-a-jwt')).toThrow();
			expect(() => jwtService.validateToken('')).toThrow();
			expect(() => jwtService.validateToken(null)).toThrow();
		});

		it('should include JWT metadata in decoded token', () => {
			const payload = { userId: 'user-123' };
			const token = jwtService.generateToken(payload);

			const decoded = jwtService.validateToken(token);

			expect(decoded.iat).toBeDefined();
			expect(decoded.exp).toBeDefined();
			expect(typeof decoded.iat).toBe('number');
			expect(typeof decoded.exp).toBe('number');
		});
	});

	describe('refreshToken', () => {
		it('should create new token from existing token', () => {
			const payload = { userId: 'user-123', role: 'admin' };
			const originalToken = jwtService.generateToken(payload);

			// Wait a bit to ensure different timestamp
			return new Promise((resolve) => {
				setTimeout(() => {
					const refreshedToken = jwtService.refreshToken(originalToken);

					expect(refreshedToken).toBeTruthy();
					expect(refreshedToken).not.toBe(originalToken);

					const decoded = jwtService.validateToken(refreshedToken);
					expect(decoded.userId).toBe('user-123');
					expect(decoded.role).toBe('admin');
					resolve();
				}, 10);
			});
		});

		it('should remove JWT-specific claims from refreshed token', () => {
			const payload = { userId: 'user-123' };
			const originalToken = jwtService.generateToken(payload, { expiresIn: '1h' });

			const originalDecoded = jwtService.validateToken(originalToken);
			const originalIat = originalDecoded.iat;
			const originalExp = originalDecoded.exp;

			const refreshedToken = jwtService.refreshToken(originalToken);
			const refreshedDecoded = jwtService.validateToken(refreshedToken);

			expect(refreshedDecoded.iat).not.toBe(originalIat);
			expect(refreshedDecoded.exp).not.toBe(originalExp);
		});

		it('should extend expiration on refresh', () => {
			const payload = { userId: 'user-123' };
			const originalToken = jwtService.generateToken(payload, { expiresIn: '1h' });

			const originalDecoded = jwtService.validateToken(originalToken);
			const originalExp = new Date(originalDecoded.exp * 1000);

			return new Promise((resolve) => {
				setTimeout(() => {
					const refreshedToken = jwtService.refreshToken(originalToken);
					const refreshedDecoded = jwtService.validateToken(refreshedToken);
					const refreshedExp = new Date(refreshedDecoded.exp * 1000);

					// Refreshed token should expire later (uses default 30d)
					expect(refreshedExp.getTime()).toBeGreaterThan(originalExp.getTime());
					resolve();
				}, 10);
			});
		});

		it('should throw error when refreshing invalid token', () => {
			expect(() => jwtService.refreshToken('invalid.token')).toThrow();
		});

		it('should throw error when refreshing expired token', () => {
			const payload = { userId: 'user-123' };
			const token = jwtService.generateToken(payload, { expiresIn: '1ms' });

			return new Promise((resolve) => {
				setTimeout(() => {
					expect(() => jwtService.refreshToken(token)).toThrow();
					resolve();
				}, 10);
			});
		});

		it('should preserve custom payload properties', () => {
			const payload = {
				userId: 'user-123',
				role: 'admin',
				permissions: ['read', 'write'],
				metadata: { foo: 'bar' }
			};
			const originalToken = jwtService.generateToken(payload);

			const refreshedToken = jwtService.refreshToken(originalToken);
			const decoded = jwtService.validateToken(refreshedToken);

			expect(decoded.userId).toBe('user-123');
			expect(decoded.role).toBe('admin');
			expect(decoded.permissions).toEqual(['read', 'write']);
			expect(decoded.metadata).toEqual({ foo: 'bar' });
		});
	});
});
