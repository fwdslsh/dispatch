import { test, expect, vi } from 'vitest';
import { generateUUID, getClientId } from '../../src/lib/client/shared/utils/uuid.js';

// Mock localStorage for testing
const localStorageMock = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
	length: 0,
	key: vi.fn(),
};

Object.defineProperty(global, 'localStorage', {
	value: localStorageMock,
	writable: true,
});

test('generateUUID returns a valid UUID format', () => {
	const uuid = generateUUID();
	
	// Check UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	expect(uuid).toMatch(uuidRegex);
});

test('generateUUID works when crypto.randomUUID is not available', () => {
	// Mock crypto object without randomUUID
	const originalCrypto = global.crypto;
	Object.defineProperty(global, 'crypto', {
		value: {},
		writable: true,
		configurable: true,
	});
	
	const uuid = generateUUID();
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	expect(uuid).toMatch(uuidRegex);
	
	// Restore crypto
	Object.defineProperty(global, 'crypto', {
		value: originalCrypto,
		writable: true,
		configurable: true,
	});
});

test('getClientId retrieves existing ID from localStorage', () => {
	const existingId = 'existing-uuid-123';
	localStorageMock.getItem.mockReturnValue(existingId);
	
	const clientId = getClientId();
	expect(clientId).toBe(existingId);
	expect(localStorageMock.getItem).toHaveBeenCalledWith('clientId');
});

test('getClientId creates new ID when none exists', () => {
	localStorageMock.getItem.mockReturnValue(null);
	
	const clientId = getClientId();
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	
	expect(clientId).toMatch(uuidRegex);
	expect(localStorageMock.setItem).toHaveBeenCalledWith('clientId', clientId);
});