import { describe, expect, it, vi } from 'vitest';
import { ClaudeCommandCache } from '../../src/lib/server/claude/ClaudeCommandCache.js';

describe('ClaudeCommandCache', () => {
	it('returns cached commands while entry is fresh', async () => {
		const now = vi
			.fn()
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(100) // used for getOrFetch second call
			.mockReturnValue(200);
		const cache = new ClaudeCommandCache({ ttlMs: 5000, now });
		const fetcher = vi.fn().mockResolvedValue(['run']);

		const first = await cache.getOrFetch(
			{ cwd: '/work', pathToClaudeCodeExecutable: '/bin/claude' },
			fetcher
		);
		expect(first).toEqual({ commands: ['run'], fromCache: false });
		expect(fetcher).toHaveBeenCalledTimes(1);

		const second = await cache.getOrFetch(
			{ cwd: '/work', pathToClaudeCodeExecutable: '/bin/claude' },
			fetcher
		);
		expect(second).toEqual({ commands: ['run'], fromCache: true });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('refreshes commands after TTL expires', async () => {
		const now = vi
			.fn()
			.mockReturnValueOnce(0) // initial set
			.mockReturnValueOnce(6000) // on get -> treat expired
			.mockReturnValueOnce(6000);
		const cache = new ClaudeCommandCache({ ttlMs: 5000, now });
		const fetcher = vi.fn().mockResolvedValueOnce(['first']).mockResolvedValueOnce(['second']);

		await cache.getOrFetch({ cwd: '/work', pathToClaudeCodeExecutable: '/bin/claude' }, fetcher);
		expect(fetcher).toHaveBeenCalledTimes(1);

		const result = await cache.getOrFetch(
			{ cwd: '/work', pathToClaudeCodeExecutable: '/bin/claude' },
			fetcher
		);
		expect(result).toEqual({ commands: ['second'], fromCache: false });
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
