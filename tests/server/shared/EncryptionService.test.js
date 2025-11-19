import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EncryptionService } from '../../../src/lib/server/shared/EncryptionService.js';

describe('EncryptionService', () => {
	let service;
	const testKey = EncryptionService.generateKey();
	const originalEnv = process.env.ENCRYPTION_KEY;

	beforeEach(() => {
		// Set encryption key for tests
		process.env.ENCRYPTION_KEY = testKey;
		service = new EncryptionService(testKey);
	});

	afterEach(() => {
		// Restore original environment
		process.env.ENCRYPTION_KEY = originalEnv;
	});

	describe('generateKey', () => {
		it('should generate a valid base64 key', () => {
			const key = EncryptionService.generateKey();
			expect(key).toMatch(/^[A-Za-z0-9+/]+=*$/);
			expect(Buffer.from(key, 'base64').length).toBe(32);
		});

		it('should generate unique keys', () => {
			const key1 = EncryptionService.generateKey();
			const key2 = EncryptionService.generateKey();
			expect(key1).not.toBe(key2);
		});
	});

	describe('isAvailable', () => {
		it('should return true when encryption key is set', () => {
			expect(service.isAvailable()).toBe(true);
		});

		it('should return false when encryption key is not set', () => {
			const noKeyService = new EncryptionService(null);
			expect(noKeyService.isAvailable()).toBe(false);
		});
	});

	describe('encrypt', () => {
		it('should encrypt plaintext successfully', () => {
			const plaintext = 'my-secret-value';
			const encrypted = service.encrypt(plaintext);

			expect(encrypted).toBeTruthy();
			expect(encrypted).not.toBe(plaintext);
			expect(encrypted.split(':').length).toBe(4); // salt:iv:ciphertext:authTag
		});

		it('should produce different ciphertext for same plaintext (different salt/IV)', () => {
			const plaintext = 'my-secret-value';
			const encrypted1 = service.encrypt(plaintext);
			const encrypted2 = service.encrypt(plaintext);

			expect(encrypted1).not.toBe(encrypted2);
		});

		it('should throw error for empty plaintext', () => {
			expect(() => service.encrypt('')).toThrow('Plaintext must be a non-empty string');
		});

		it('should throw error for non-string plaintext', () => {
			expect(() => service.encrypt(123)).toThrow('Plaintext must be a non-empty string');
			expect(() => service.encrypt(null)).toThrow('Plaintext must be a non-empty string');
		});

		it('should return null when encryption is unavailable', () => {
			const noKeyService = new EncryptionService(null);
			const result = noKeyService.encrypt('secret');
			expect(result).toBeNull();
		});
	});

	describe('decrypt', () => {
		it('should decrypt encrypted value correctly', () => {
			const plaintext = 'my-secret-value';
			const encrypted = service.encrypt(plaintext);
			const decrypted = service.decrypt(encrypted);

			expect(decrypted).toBe(plaintext);
		});

		it('should handle long strings', () => {
			const plaintext = 'a'.repeat(10000);
			const encrypted = service.encrypt(plaintext);
			const decrypted = service.decrypt(encrypted);

			expect(decrypted).toBe(plaintext);
		});

		it('should handle special characters', () => {
			const plaintext = '🔐 Secret: $#@!%^&*()_+-=[]{}|;:\'",.<>?/`~';
			const encrypted = service.encrypt(plaintext);
			const decrypted = service.decrypt(encrypted);

			expect(decrypted).toBe(plaintext);
		});

		it('should return null for null input', () => {
			expect(service.decrypt(null)).toBeNull();
		});

		it('should return null for undefined input', () => {
			expect(service.decrypt(undefined)).toBeNull();
		});

		it('should return ciphertext as-is if invalid format and encryption unavailable', () => {
			const noKeyService = new EncryptionService(null);
			const invalid = 'not-encrypted';
			expect(noKeyService.decrypt(invalid)).toBe(invalid);
		});

		it('should return plaintext value if format is invalid (migration case)', () => {
			const plaintext = 'old-plaintext-secret';
			const decrypted = service.decrypt(plaintext);
			expect(decrypted).toBe(plaintext);
		});

		it('should throw error for tampered ciphertext', () => {
			const plaintext = 'my-secret';
			const encrypted = service.encrypt(plaintext);

			// Tamper with the ciphertext (flip a bit)
			const parts = encrypted.split(':');
			const tamperedCiphertext = parts[2].replace('a', 'b');
			const tampered = [parts[0], parts[1], tamperedCiphertext, parts[3]].join(':');

			expect(() => service.decrypt(tampered)).toThrow('Decryption failed');
		});

		it('should throw error for tampered auth tag', () => {
			const plaintext = 'my-secret';
			const encrypted = service.encrypt(plaintext);

			// Tamper with auth tag
			const parts = encrypted.split(':');
			const tamperedTag = parts[3].replace('a', 'b');
			const tampered = [parts[0], parts[1], parts[2], tamperedTag].join(':');

			expect(() => service.decrypt(tampered)).toThrow('Decryption failed');
		});
	});

	describe('encryptFields', () => {
		it('should encrypt specified fields in object', () => {
			const obj = {
				publicField: 'visible',
				secretField: 'secret-value',
				anotherSecret: 'another-secret'
			};

			const result = service.encryptFields(obj, ['secretField', 'anotherSecret']);

			expect(result.publicField).toBe('visible');
			expect(result.secretField).not.toBe('secret-value');
			expect(result.anotherSecret).not.toBe('another-secret');
			expect(result.secretField.split(':').length).toBe(4);
		});

		it('should handle missing fields gracefully', () => {
			const obj = { publicField: 'visible' };
			const result = service.encryptFields(obj, ['missingField']);

			expect(result.publicField).toBe('visible');
			expect(result.missingField).toBeUndefined();
		});

		it('should throw error for non-object input', () => {
			expect(() => service.encryptFields('not-an-object', [])).toThrow(
				'Input must be an object'
			);
		});
	});

	describe('decryptFields', () => {
		it('should decrypt specified fields in object', () => {
			const obj = {
				publicField: 'visible',
				secretField: 'secret-value',
				anotherSecret: 'another-secret'
			};

			const encrypted = service.encryptFields(obj, ['secretField', 'anotherSecret']);
			const decrypted = service.decryptFields(encrypted, ['secretField', 'anotherSecret']);

			expect(decrypted.publicField).toBe('visible');
			expect(decrypted.secretField).toBe('secret-value');
			expect(decrypted.anotherSecret).toBe('another-secret');
		});

		it('should handle missing fields gracefully', () => {
			const obj = { publicField: 'visible' };
			const result = service.decryptFields(obj, ['missingField']);

			expect(result.publicField).toBe('visible');
			expect(result.missingField).toBeUndefined();
		});

		it('should throw error for non-object input', () => {
			expect(() => service.decryptFields('not-an-object', [])).toThrow(
				'Input must be an object'
			);
		});
	});

	describe('isEncrypted', () => {
		it('should return true for encrypted values', () => {
			const encrypted = service.encrypt('secret');
			expect(service.isEncrypted(encrypted)).toBe(true);
		});

		it('should return false for plaintext', () => {
			expect(service.isEncrypted('plaintext-value')).toBe(false);
		});

		it('should return false for non-string values', () => {
			expect(service.isEncrypted(null)).toBe(false);
			expect(service.isEncrypted(undefined)).toBe(false);
			expect(service.isEncrypted(123)).toBe(false);
			expect(service.isEncrypted({})).toBe(false);
		});

		it('should return false for invalid format', () => {
			expect(service.isEncrypted('invalid:format')).toBe(false);
			expect(service.isEncrypted('a:b:c')).toBe(false);
			expect(service.isEncrypted('not:hex:values:here')).toBe(false);
		});
	});

	describe('round-trip encryption', () => {
		const testCases = [
			{ name: 'simple string', value: 'hello world' },
			{ name: 'OAuth client secret', value: 'gho_1234567890abcdefghijklmnopqrstuvwxyz' },
			{ name: 'long value', value: 'x'.repeat(1000) },
			{ name: 'unicode', value: '你好世界 🌍' },
			{ name: 'JSON', value: JSON.stringify({ key: 'value', nested: { data: 123 } }) }
		];

		testCases.forEach(({ name, value }) => {
			it(`should handle round-trip for ${name}`, () => {
				const encrypted = service.encrypt(value);
				const decrypted = service.decrypt(encrypted);
				expect(decrypted).toBe(value);
			});
		});
	});

	describe('security properties', () => {
		it('should use unique salt for each encryption', () => {
			const plaintext = 'secret';
			const encrypted1 = service.encrypt(plaintext);
			const encrypted2 = service.encrypt(plaintext);

			const salt1 = encrypted1.split(':')[0];
			const salt2 = encrypted2.split(':')[0];

			expect(salt1).not.toBe(salt2);
		});

		it('should use unique IV for each encryption', () => {
			const plaintext = 'secret';
			const encrypted1 = service.encrypt(plaintext);
			const encrypted2 = service.encrypt(plaintext);

			const iv1 = encrypted1.split(':')[1];
			const iv2 = encrypted2.split(':')[1];

			expect(iv1).not.toBe(iv2);
		});

		it('should produce different ciphertext with different keys', () => {
			const plaintext = 'secret';
			const key1 = EncryptionService.generateKey();
			const key2 = EncryptionService.generateKey();

			const service1 = new EncryptionService(key1);
			const service2 = new EncryptionService(key2);

			const encrypted1 = service1.encrypt(plaintext);
			const encrypted2 = service2.encrypt(plaintext);

			// Ciphertext should be different
			expect(encrypted1.split(':')[2]).not.toBe(encrypted2.split(':')[2]);

			// Service 2 cannot decrypt service 1's ciphertext
			expect(() => service2.decrypt(encrypted1)).toThrow();
		});
	});
});
