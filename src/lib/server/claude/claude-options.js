/**
 * @typedef {import('@anthropic-ai/claude-code').Options} ClaudeSDKOptions
 * @typedef {ClaudeSDKOptions & { workspaceEnv?: Record<string, string | undefined> }} ClaudeOptionsInput
 */

const DEFAULT_ALLOWED_TOOLS = Object.freeze([
	'Agent',
	'Bash',
	'BashOutput',
	'ExitPlanMode',
	'FileEdit',
	'FileMultiEdit',
	'FileRead',
	'FileWrite',
	'Glob',
	'Grep',
	'KillShell',
	'ListMcpResources',
	'Mcp',
	'NotebookEdit',
	'ReadMcpResource',
	'TodoWrite',
	'WebFetch',
	'WebSearch'
]);

/**
 * Build Claude SDK options with repository defaults applied.
 * @param {ClaudeOptionsInput} [options]
 * @returns {ClaudeSDKOptions}
 */
export function buildClaudeOptions(options = {}) {
	const input = /** @type {ClaudeOptionsInput} */ (options);
	const {
		workspaceEnv = {},
		env,
		allowedTools,
		disallowedTools,
		additionalDirectories,
		mcpServers,
		hooks,
		permissionMode,
		includePartialMessages,
		...rest
	} = input;

	const mergedEnv = env
		? { ...process.env, ...workspaceEnv, ...env }
		: { ...process.env, ...workspaceEnv };

	return {
		...rest,
		cwd: input.cwd || process.env.WORKSPACES_ROOT || process.env.HOME,
		permissionMode: permissionMode || 'bypassPermissions',
		allowedTools: allowedTools ? [...allowedTools] : [...DEFAULT_ALLOWED_TOOLS],
		disallowedTools,
		additionalDirectories: additionalDirectories || [],
		mcpServers: mcpServers ? { ...mcpServers } : {},
		hooks: hooks ? { ...hooks } : {},
		includePartialMessages: includePartialMessages ?? false,
		env: mergedEnv,
		systemPrompt: { type: "preset", preset: "claude_code" },
		settingSources: ["user", "project", "local"]
	};
}

export const CLAUDE_DEFAULT_ALLOWED_TOOLS = DEFAULT_ALLOWED_TOOLS;
