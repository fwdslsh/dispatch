import { describe, it, expect } from 'vitest';
import { SESSION_TYPE, VALID_SESSION_TYPES, isValidSessionType } from '../../src/lib/shared/session-types.js';

describe('session-types', () => {
	describe('SESSION_TYPE constants', () => {
		it('defines all session types', () => {
			expect(SESSION_TYPE.PTY).toBe('pty');
			expect(SESSION_TYPE.CLAUDE).toBe('claude');
			expect(SESSION_TYPE.FILE_EDITOR).toBe('file-editor');
		});
	});

	describe('VALID_SESSION_TYPES', () => {
		it('contains all session types', () => {
			expect(VALID_SESSION_TYPES).toContain('pty');
			expect(VALID_SESSION_TYPES).toContain('claude');
			expect(VALID_SESSION_TYPES).toContain('file-editor');
			expect(VALID_SESSION_TYPES).toHaveLength(3);
		});
	});

	describe('isValidSessionType', () => {
		it('returns true for valid session types', () => {
			expect(isValidSessionType('pty')).toBe(true);
			expect(isValidSessionType('claude')).toBe(true);
			expect(isValidSessionType('file-editor')).toBe(true);
		});

		it('returns false for invalid session types', () => {
			expect(isValidSessionType('terminal')).toBe(false);
			expect(isValidSessionType('shell')).toBe(false);
			expect(isValidSessionType('unknown')).toBe(false);
			expect(isValidSessionType('')).toBe(false);
			expect(isValidSessionType(null)).toBe(false);
			expect(isValidSessionType(undefined)).toBe(false);
		});
	});
});