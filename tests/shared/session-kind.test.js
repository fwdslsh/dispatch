import { describe, expect, it } from 'vitest';
import { normalizeSessionKind } from '../../src/lib/shared/session-kind.js';

describe('normalizeSessionKind', () => {
	it('returns null for falsy values', () => {
		expect(normalizeSessionKind(null)).toBeNull();
		expect(normalizeSessionKind(undefined)).toBeNull();
		expect(normalizeSessionKind('')).toBeNull();
	});

	it('normalizes terminal aliases to pty', () => {
		expect(normalizeSessionKind('pty')).toBe('pty');
		expect(normalizeSessionKind('terminal')).toBe('pty');
		expect(normalizeSessionKind('Terminal_session')).toBe('pty');
		expect(normalizeSessionKind('terminal-session')).toBe('pty');
		expect(normalizeSessionKind(' shell ')).toBe('pty');
	});

	it('normalizes claude aliases to claude', () => {
		expect(normalizeSessionKind('claude')).toBe('claude');
		expect(normalizeSessionKind('Claude_Session')).toBe('claude');
		expect(normalizeSessionKind('claude-session')).toBe('claude');
		expect(normalizeSessionKind('claude_code')).toBe('claude');
	});

	it('returns null for unknown kinds', () => {
		expect(normalizeSessionKind('unknown')).toBeNull();
		expect(normalizeSessionKind('all')).toBeNull();
	});
});

