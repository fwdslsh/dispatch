import { describe, it, expect } from 'vitest';

/**
 * Normalize session ID to handle multiple formats from server
 * Strips 'claude_' prefix and converts to string for consistent comparison
 * @param {string|number} id - Session ID from server or client
 * @returns {string|null} Normalized session ID or null for invalid inputs
 */
function normalizeSessionId(id) {
	if (id === null || id === undefined) return null;
	return String(id).replace(/^claude_/, '');
}

/**
 * Check if two session IDs match after normalization
 * @param {string|number} id1 - First session ID
 * @param {string|number} id2 - Second session ID
 * @returns {boolean} True if IDs match after normalization
 */
function sessionIdsMatch(id1, id2) {
	const normalized1 = normalizeSessionId(id1);
	const normalized2 = normalizeSessionId(id2);

	// Return false if either normalized result is null (from null/undefined inputs)
	if (normalized1 === null || normalized2 === null) {
		return false;
	}

	return normalized1 === normalized2;
}

/**
 * Determine if a WebSocket event payload is intended for a specific session
 * @param {Object} payload - WebSocket event payload containing sessionId
 * @param {string|number} sessionId - Our session ID
 * @param {string|number} claudeSessionId - Our Claude session ID (optional)
 * @returns {boolean} True if payload is for our session
 */
function isEventForSession(payload, sessionId, claudeSessionId = null) {
	if (!payload || payload.sessionId === null || payload.sessionId === undefined) return false;

	// Check if we have any session IDs (note: 0 is a valid session ID)
	const hasSessionId = sessionId !== null && sessionId !== undefined;
	const hasClaudeId = claudeSessionId !== null && claudeSessionId !== undefined;
	if (!hasSessionId && !hasClaudeId) return false;

	const payloadId = normalizeSessionId(payload.sessionId);
	if (payloadId === null) return false;

	// Check against app session ID if provided
	if (hasSessionId) {
		const ourAppId = normalizeSessionId(sessionId);
		if (ourAppId !== null && sessionIdsMatch(payloadId, ourAppId)) {
			return true;
		}
	}

	// Check against Claude session ID if provided
	if (hasClaudeId) {
		const ourClaudeId = normalizeSessionId(claudeSessionId);
		if (ourClaudeId !== null && sessionIdsMatch(payloadId, ourClaudeId)) {
			return true;
		}
	}

	return false;
}

describe('Session ID Normalization', () => {
	describe('normalizeSessionId function', () => {
		it('should convert numbers to strings', () => {
			expect(normalizeSessionId(123)).toBe('123');
			expect(normalizeSessionId(0)).toBe('0');
			expect(normalizeSessionId(1)).toBe('1');
		});

		it('should return strings unchanged if no prefix', () => {
			expect(normalizeSessionId('session-123')).toBe('session-123');
			expect(normalizeSessionId('abc')).toBe('abc');
			expect(normalizeSessionId('')).toBe('');
		});

		it('should strip claude_ prefix from strings', () => {
			expect(normalizeSessionId('claude_123')).toBe('123');
			expect(normalizeSessionId('claude_session-456')).toBe('session-456');
			expect(normalizeSessionId('claude_')).toBe('');
		});

		it('should handle null and undefined', () => {
			expect(normalizeSessionId(null)).toBe(null);
			expect(normalizeSessionId(undefined)).toBe(null);
		});

		it('should handle mixed cases correctly', () => {
			expect(normalizeSessionId('claude_789')).toBe('789');
			expect(normalizeSessionId(789)).toBe('789');
			expect(normalizeSessionId('789')).toBe('789');
		});

		it('should only strip claude_ prefix from start', () => {
			expect(normalizeSessionId('session_claude_123')).toBe('session_claude_123');
			expect(normalizeSessionId('123_claude_456')).toBe('123_claude_456');
		});
	});

	describe('sessionIdsMatch function', () => {
		it('should match identical strings', () => {
			expect(sessionIdsMatch('123', '123')).toBe(true);
			expect(sessionIdsMatch('session-abc', 'session-abc')).toBe(true);
		});

		it('should match identical numbers', () => {
			expect(sessionIdsMatch(123, 123)).toBe(true);
			expect(sessionIdsMatch(0, 0)).toBe(true);
		});

		it('should match numbers and string equivalents', () => {
			expect(sessionIdsMatch(123, '123')).toBe(true);
			expect(sessionIdsMatch('456', 456)).toBe(true);
			expect(sessionIdsMatch(0, '0')).toBe(true);
		});

		it('should match after claude_ prefix normalization', () => {
			expect(sessionIdsMatch('claude_123', '123')).toBe(true);
			expect(sessionIdsMatch('123', 'claude_123')).toBe(true);
			expect(sessionIdsMatch('claude_456', 'claude_456')).toBe(true);
		});

		it('should not match different IDs', () => {
			expect(sessionIdsMatch('123', '456')).toBe(false);
			expect(sessionIdsMatch(123, 456)).toBe(false);
			expect(sessionIdsMatch('claude_123', '456')).toBe(false);
		});

		it('should return false for empty or null IDs', () => {
			expect(sessionIdsMatch(null, null)).toBe(false);
			expect(sessionIdsMatch(undefined, undefined)).toBe(false);
			expect(sessionIdsMatch('123', null)).toBe(false);
			expect(sessionIdsMatch(null, '123')).toBe(false);
			expect(sessionIdsMatch('123', undefined)).toBe(false);
			expect(sessionIdsMatch(undefined, '123')).toBe(false);
		});

		it('should handle empty strings correctly', () => {
			// Empty strings are valid session IDs (though unlikely)
			expect(sessionIdsMatch('', '')).toBe(true);
			expect(sessionIdsMatch('123', '')).toBe(false);
			expect(sessionIdsMatch('', '123')).toBe(false);
		});
	});

	describe('isEventForSession function', () => {
		it('should accept events with matching app session ID', () => {
			const payload = { sessionId: '123', commands: ['clear'] };
			expect(isEventForSession(payload, '123', null)).toBe(true);
			expect(isEventForSession(payload, 123, null)).toBe(true);
		});

		it('should accept events with matching Claude session ID', () => {
			const payload = { sessionId: 'claude_456', commands: ['help'] };
			expect(isEventForSession(payload, null, '456')).toBe(true);
			expect(isEventForSession(payload, null, 'claude_456')).toBe(true);
		});

		it('should accept events matching either session ID', () => {
			const payload = { sessionId: '789', commands: ['status'] };
			expect(isEventForSession(payload, '789', '123')).toBe(true);
			expect(isEventForSession(payload, '123', '789')).toBe(true);
		});

		it('should handle normalized IDs correctly', () => {
			const payload = { sessionId: 'claude_999', commands: ['clear'] };
			expect(isEventForSession(payload, '999', null)).toBe(true);
			expect(isEventForSession(payload, null, '999')).toBe(true);
			expect(isEventForSession(payload, '999', '123')).toBe(true);
		});

		it('should reject events for different sessions', () => {
			const payload = { sessionId: '123', commands: ['clear'] };
			expect(isEventForSession(payload, '456', null)).toBe(false);
			expect(isEventForSession(payload, null, '456')).toBe(false);
			expect(isEventForSession(payload, '456', '789')).toBe(false);
		});

		it('should reject events with no session ID', () => {
			const payload = { commands: ['clear'] };
			expect(isEventForSession(payload, '123', null)).toBe(false);
			expect(isEventForSession(payload, null, '456')).toBe(false);
		});

		it('should reject events when no local session IDs provided', () => {
			const payload = { sessionId: '123', commands: ['clear'] };
			expect(isEventForSession(payload, null, null)).toBe(false);
			expect(isEventForSession(payload, '', '')).toBe(false);
			expect(isEventForSession(payload, undefined, undefined)).toBe(false);
		});

		it('should reject null or undefined payloads', () => {
			expect(isEventForSession(null, '123', '456')).toBe(false);
			expect(isEventForSession(undefined, '123', '456')).toBe(false);
		});
	});

	describe('Real-world scenarios', () => {
		it('should handle server emitting with claudeSessionId format', () => {
			// Server emits: { sessionId: 'claude_123', commands: [...] }
			// Client has: sessionId='app-session-456', claudeSessionId='123'
			const payload = { sessionId: 'claude_123', commands: ['clear', 'help'] };
			expect(isEventForSession(payload, 'app-session-456', '123')).toBe(true);
		});

		it('should handle server emitting with appSessionId format', () => {
			// Server emits: { sessionId: 'app-session-789', commands: [...] }
			// Client has: sessionId='app-session-789', claudeSessionId='claude_123'
			const payload = { sessionId: 'app-session-789', commands: ['status'] };
			expect(isEventForSession(payload, 'app-session-789', 'claude_123')).toBe(true);
		});

		it('should handle server emitting with numeric session IDs', () => {
			// Server emits: { sessionId: 456, commands: [...] }
			// Client has: sessionId='456', claudeSessionId=null
			const payload = { sessionId: 456, commands: ['compact'] };
			expect(isEventForSession(payload, '456', null)).toBe(true);
		});

		it('should handle mixed format scenarios', () => {
			// Various combinations that should work
			const scenarios = [
				{ payload: { sessionId: 'claude_999' }, sessionId: '999', claudeSessionId: null },
				{ payload: { sessionId: 999 }, sessionId: 'claude_999', claudeSessionId: null },
				{ payload: { sessionId: '999' }, sessionId: null, claudeSessionId: 'claude_999' },
				{ payload: { sessionId: 'claude_888' }, sessionId: 'different', claudeSessionId: '888' }
			];

			scenarios.forEach(({ payload, sessionId, claudeSessionId }, index) => {
				expect(
					isEventForSession(payload, sessionId, claudeSessionId),
					`Scenario ${index + 1} should match`
				).toBe(true);
			});
		});

		it('should reject mismatched scenarios', () => {
			const scenarios = [
				{ payload: { sessionId: 'claude_111' }, sessionId: '222', claudeSessionId: null },
				{ payload: { sessionId: 333 }, sessionId: '444', claudeSessionId: '555' },
				{ payload: { sessionId: '666' }, sessionId: null, claudeSessionId: 'claude_777' }
			];

			scenarios.forEach(({ payload, sessionId, claudeSessionId }, index) => {
				expect(
					isEventForSession(payload, sessionId, claudeSessionId),
					`Scenario ${index + 1} should not match`
				).toBe(false);
			});
		});
	});

	describe('Edge cases', () => {
		it('should handle empty payload sessionId', () => {
			const payload = { sessionId: '', commands: ['clear'] };
			expect(isEventForSession(payload, '123', '456')).toBe(false);
		});

		it('should handle zero as valid session ID', () => {
			const payload = { sessionId: 0, commands: ['clear'] };
			expect(isEventForSession(payload, '0', null)).toBe(true);
			expect(isEventForSession(payload, 0, null)).toBe(true);
		});

		it('should handle claude_ prefix with numeric session', () => {
			const payload = { sessionId: 'claude_0', commands: ['status'] };
			expect(isEventForSession(payload, '0', null)).toBe(true);
			expect(isEventForSession(payload, 0, null)).toBe(true);
		});
	});
});

// Export functions for use in component
export { normalizeSessionId, sessionIdsMatch, isEventForSession };
