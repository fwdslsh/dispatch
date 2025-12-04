/**
 * @typedef {Object} OpenCodeOptionsInput
 * @property {string} [cwd] - Working directory
 * @property {string} [baseUrl] - OpenCode server base URL
 * @property {string} [model] - AI model to use
 * @property {string} [provider] - AI provider (anthropic, openai, etc.)
 * @property {number} [timeout] - Request timeout in milliseconds
 * @property {number} [maxRetries] - Maximum number of retries
 * @property {Record<string, string | undefined>} [workspaceEnv] - Workspace environment variables
 * @property {Record<string, string | undefined>} [env] - Additional environment variables
 */

/**
 * Build OpenCode SDK options with repository defaults applied.
 * @param {OpenCodeOptionsInput} [options]
 * @returns {OpenCodeOptionsInput}
 */
export function buildOpenCodeOptions(options = {}) {
	const input = /** @type {OpenCodeOptionsInput} */ (options);
	const {
		workspaceEnv = {},
		env,
		baseUrl,
		model,
		provider,
		timeout,
		maxRetries,
		...rest
	} = input;

	const mergedEnv = env
		? { ...process.env, ...workspaceEnv, ...env }
		: { ...process.env, ...workspaceEnv };

	return {
		...rest,
		cwd: input.cwd || process.env.WORKSPACES_ROOT || process.env.HOME,
		baseUrl: baseUrl || process.env.OPENCODE_SERVER_URL || 'http://localhost:4096',
		model: model || 'claude-3-7-sonnet-20250219',
		provider: provider || 'anthropic',
		timeout: timeout || 60000,
		maxRetries: maxRetries || 2,
		env: mergedEnv
	};
}
