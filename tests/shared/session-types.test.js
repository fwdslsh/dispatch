import { describe, it, expect } from 'vitest';
import {
	SESSION_TYPE,
	VALID_SESSION_TYPES,
	CANONICAL_SESSION_TYPES,
	isValidSessionType,
	normalizeSessionType
} from '../../src/lib/shared/session-types.js';

describe('session-types', () => {
	describe('SESSION_TYPE constants', () => {
		it('defines canonical session types', () => {
			expect(SESSION_TYPE.TERMINAL).toBe('terminal');
			expect(SESSION_TYPE.AI).toBe('ai');
			expect(SESSION_TYPE.OPENCODE).toBe('opencode');
			expect(SESSION_TYPE.FILE_EDITOR).toBe('file-editor');
		});

		it('provides legacy aliases for migration', () => {
			// Legacy aliases map to canonical types
			expect(SESSION_TYPE.PTY).toBe('terminal');
			expect(SESSION_TYPE.CLAUDE).toBe('ai');
			// Note: OPENCODE is now a canonical type (not an alias for AI)
			// because OpenCode has its own dedicated iframe page
			expect(SESSION_TYPE.OPENCODE_TUI).toBe('ai');
		});
	});

	describe('CANONICAL_SESSION_TYPES', () => {
		it('contains only canonical session types', () => {
			expect(CANONICAL_SESSION_TYPES).toContain('terminal');
			expect(CANONICAL_SESSION_TYPES).toContain('ai');
			expect(CANONICAL_SESSION_TYPES).toContain('opencode');
			expect(CANONICAL_SESSION_TYPES).toContain('file-editor');
			expect(CANONICAL_SESSION_TYPES).toHaveLength(4);
		});
	});

	describe('VALID_SESSION_TYPES', () => {
		it('contains canonical session types', () => {
			expect(VALID_SESSION_TYPES).toContain('terminal');
			expect(VALID_SESSION_TYPES).toContain('ai');
			expect(VALID_SESSION_TYPES).toContain('opencode');
			expect(VALID_SESSION_TYPES).toContain('file-editor');
			expect(VALID_SESSION_TYPES).toHaveLength(4);
		});
	});

	describe('isValidSessionType', () => {
		it('returns true for valid session types', () => {
			expect(isValidSessionType('terminal')).toBe(true);
			expect(isValidSessionType('ai')).toBe(true);
			expect(isValidSessionType('opencode')).toBe(true);
			expect(isValidSessionType('file-editor')).toBe(true);
		});

		it('returns false for invalid session types', () => {
			expect(isValidSessionType('shell')).toBe(false);
			expect(isValidSessionType('unknown')).toBe(false);
			expect(isValidSessionType('')).toBe(false);
			expect(isValidSessionType(null)).toBe(false);
			expect(isValidSessionType(undefined)).toBe(false);
		});

		it('returns false for legacy types (use normalizeSessionType first)', () => {
			// Legacy types are not directly valid - they must be normalized first
			expect(isValidSessionType('pty')).toBe(false);
			expect(isValidSessionType('claude')).toBe(false);
			expect(isValidSessionType('opencode-tui')).toBe(false);
		});
	});

	describe('normalizeSessionType', () => {
		it('normalizes legacy types to canonical types', () => {
			expect(normalizeSessionType('pty')).toBe('terminal');
			expect(normalizeSessionType('claude')).toBe('ai');
			expect(normalizeSessionType('opencode-tui')).toBe('ai');
		});

		it('returns canonical types unchanged', () => {
			expect(normalizeSessionType('terminal')).toBe('terminal');
			expect(normalizeSessionType('ai')).toBe('ai');
			expect(normalizeSessionType('opencode')).toBe('opencode');
			expect(normalizeSessionType('file-editor')).toBe('file-editor');
		});

		it('returns unknown types unchanged', () => {
			expect(normalizeSessionType('unknown')).toBe('unknown');
			expect(normalizeSessionType('shell')).toBe('shell');
		});
	});
});
