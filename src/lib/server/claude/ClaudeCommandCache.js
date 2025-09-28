import { logger } from '../shared/utils/logger.js';

/**
 * Maintains a TTL-based cache of Claude command metadata keyed by workspace + executable path.
 */
export class ClaudeCommandCache {
	constructor({ ttlMs = 5 * 60 * 1000, now = () => Date.now(), log = logger } = {}) {
		this.ttlMs = ttlMs;
		this.now = now;
		this.log = log;
		this.cache = new Map();
	}

	/**
	 * Build a cache key from session options.
	 * @param {{ cwd?: string, pathToClaudeCodeExecutable?: string }} options
	 */
	static buildCacheKey(options = {}) {
		const cwd = options.cwd || '';
		const executable = options.pathToClaudeCodeExecutable || '';
		return `${cwd}:${executable}`;
	}

	/**
	 * Retrieve cached commands if present and not expired.
	 * @param {{ cwd?: string, pathToClaudeCodeExecutable?: string }} options
	 */
	get(options = {}) {
		const key = ClaudeCommandCache.buildCacheKey(options);
		const entry = this.cache.get(key);
		if (!entry) return null;

		const age = this.now() - entry.fetchedAt;
		if (age > this.ttlMs) {
			this.cache.delete(key);
			this.log.debug('Claude', 'Command cache expired', { key, age });
			return null;
		}

		return entry.commands;
	}

	/**
	 * Store commands for the provided options.
	 * @param {{ cwd?: string, pathToClaudeCodeExecutable?: string }} options
	 * @param {Array} commands
	 */
	set(options = {}, commands) {
		const key = ClaudeCommandCache.buildCacheKey(options);
		this.cache.set(key, { commands, fetchedAt: this.now() });
		this.log.debug('Claude', 'Command cache updated', { key, count: commands?.length || 0 });
	}

	/**
	 * Resolve commands either from cache or by executing fetcher.
	 * @param {{ cwd?: string, pathToClaudeCodeExecutable?: string }} options
	 * @param {() => Promise<Array>} fetcher
	 */
	async getOrFetch(options = {}, fetcher) {
		const cached = this.get(options);
		if (cached) {
			return { commands: cached, fromCache: true };
		}

		const commands = await fetcher();
		if (Array.isArray(commands)) {
			this.set(options, commands);
		}
		return { commands, fromCache: false };
	}

	clear(options = {}) {
		const key = ClaudeCommandCache.buildCacheKey(options);
		this.cache.delete(key);
	}
}
