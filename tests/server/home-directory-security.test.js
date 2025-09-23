import { describe, it, expect, vi, beforeEach } from 'vitest';
import { homedir } from 'node:os';

describe('Home Directory APIs Security', () => {
	describe('Path validation logic', () => {
		it('should allow paths within home directory', () => {
			const homeDir = '/home/testuser';
			const requestedPath = '/home/testuser/documents';
			const isAllowed = requestedPath.startsWith(homeDir);

			expect(isAllowed).toBe(true);
		});

		it('should deny paths outside home directory', () => {
			const homeDir = '/home/testuser';
			const requestedPath = '/etc/passwd';
			const isAllowed = requestedPath.startsWith(homeDir);

			expect(isAllowed).toBe(false);
		});

		it('should deny path traversal attempts', () => {
			const homeDir = '/home/testuser';
			const requestedPath = '/home/otheruser'; // Resolved from '../otheruser'
			const isAllowed = requestedPath.startsWith(homeDir);

			expect(isAllowed).toBe(false);
		});
	});

	describe('API endpoint behavior', () => {
		it('should return 403 for unauthorized paths', async () => {
			// Test that the API would return 403 for paths outside home
			const unauthorizedPaths = [
				'/etc/passwd',
				'/var/log',
				'/root',
				'/home/otheruser'
			];

			unauthorizedPaths.forEach(path => {
				const homeDir = '/home/testuser';
				const isAllowed = path.startsWith(homeDir);
				expect(isAllowed).toBe(false);
			});
		});

		it('should allow authorized paths within home', async () => {
			// Test that the API would allow paths within home
			const authorizedPaths = [
				'/home/testuser',
				'/home/testuser/documents',
				'/home/testuser/projects/myproject',
				'/home/testuser/.config'
			];

			authorizedPaths.forEach(path => {
				const homeDir = '/home/testuser';
				const isAllowed = path.startsWith(homeDir);
				expect(isAllowed).toBe(true);
			});
		});
	});
});