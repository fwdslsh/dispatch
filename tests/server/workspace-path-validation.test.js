/**
 * Tests for workspace path validation security
 * Verifies protection against path traversal and other attacks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, normalize } from 'path';

// Mock the path validation function
// Since it's not exported, we'll test via the API endpoint behavior
// For now, let's create unit tests for the validation logic itself

/**
 * Path validation function (copied from implementation for testing)
 */
function isValidWorkspacePath(path, allowedRoot = null) {
	if (!path || typeof path !== 'string') return false;
	if (path.length > 500) return false;

	try {

		// Decode any URL-encoded characters
		const decoded = decodeURIComponent(path);

		// Normalize path to resolve . and .. segments
		const normalized = normalize(decoded);

		// Resolve to absolute path (handles symlinks and relative paths)
		const resolved = resolve(normalized);

		// Must be absolute path
		if (!resolved.startsWith('/')) return false;

		// Check for path traversal attempts after normalization
		if (normalized.includes('..') || normalized.includes('~')) {
			return false;
		}

		// Validate against allowed workspace root if provided
		const workspaceRoot = allowedRoot || process.env.WORKSPACES_ROOT;
		if (workspaceRoot) {
			const resolvedRoot = resolve(workspaceRoot);
			if (!resolved.startsWith(resolvedRoot)) {
				return false;
			}
		}

		return true;
	} catch (err) {
		return false;
	}
}

describe('Workspace Path Validation Security', () => {
	const originalWorkspaceRoot = process.env.WORKSPACES_ROOT;

	beforeEach(() => {
		process.env.WORKSPACES_ROOT = '/workspace';
	});

	afterEach(() => {
		process.env.WORKSPACES_ROOT = originalWorkspaceRoot;
	});

	describe('Basic validation', () => {
		it('should reject null or undefined paths', () => {
			expect(isValidWorkspacePath(null)).toBe(false);
			expect(isValidWorkspacePath(undefined)).toBe(false);
		});

		it('should reject non-string paths', () => {
			expect(isValidWorkspacePath(123)).toBe(false);
			expect(isValidWorkspacePath({})).toBe(false);
			expect(isValidWorkspacePath([])).toBe(false);
		});

		it('should reject paths longer than 500 characters', () => {
			const longPath = '/workspace/' + 'a'.repeat(500);
			expect(isValidWorkspacePath(longPath)).toBe(false);
		});

		it('should reject non-absolute paths', () => {
			expect(isValidWorkspacePath('relative/path')).toBe(false);
			expect(isValidWorkspacePath('./relative/path')).toBe(false);
			expect(isValidWorkspacePath('../relative/path')).toBe(false);
		});

		it('should accept valid absolute paths within workspace root', () => {
			expect(isValidWorkspacePath('/workspace/my-project')).toBe(true);
			expect(isValidWorkspacePath('/workspace/subfolder/project')).toBe(true);
		});
	});

	describe('Path traversal protection', () => {
		it('should block simple .. traversal', () => {
			expect(isValidWorkspacePath('/workspace/../etc')).toBe(false);
			expect(isValidWorkspacePath('/workspace/../../etc/passwd')).toBe(false);
		});

		it('should block URL-encoded .. traversal (%2e%2e)', () => {
			expect(isValidWorkspacePath('/workspace/%2e%2e/etc')).toBe(false);
			expect(isValidWorkspacePath('/workspace/%2e%2e%2fetc%2fpasswd')).toBe(false);
		});

		it('should block tilde expansion attempts', () => {
			expect(isValidWorkspacePath('/workspace/~/sensitive')).toBe(false);
			expect(isValidWorkspacePath('~/sensitive')).toBe(false);
		});
	});

	describe('Workspace root validation', () => {
		it('should reject paths outside workspace root', () => {
			expect(isValidWorkspacePath('/etc/passwd')).toBe(false);
			expect(isValidWorkspacePath('/home/user/data')).toBe(false);
			expect(isValidWorkspacePath('/var/log/system')).toBe(false);
		});

		it('should accept paths within workspace root', () => {
			expect(isValidWorkspacePath('/workspace/project1')).toBe(true);
			expect(isValidWorkspacePath('/workspace/deep/nested/path')).toBe(true);
		});

		it('should use custom allowed root when provided', () => {
			const customRoot = '/custom/workspaces';
			expect(isValidWorkspacePath('/custom/workspaces/project', customRoot)).toBe(true);
			expect(isValidWorkspacePath('/workspace/project', customRoot)).toBe(false);
		});
	});

	describe('Edge cases and error handling', () => {
		it('should handle malformed URL encoding gracefully', () => {
			expect(isValidWorkspacePath('/workspace/%XY%ZZ')).toBe(false);
		});

		it('should normalize paths correctly', () => {
			// These should resolve to the same path and be valid
			const path1 = '/workspace/./project';
			const path2 = '/workspace/project/';
			expect(isValidWorkspacePath(path1)).toBe(true);
			expect(isValidWorkspacePath(path2)).toBe(true);
		});
	});
});
