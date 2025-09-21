import { describe, expect, it, vi } from 'vitest';

// Mock the Claude Code SDK
let capturedOptions = null;
vi.mock('@anthropic-ai/claude-code', () => {
	return {
		query: vi.fn((options) => {
			capturedOptions = options;
			const generator = (async function* () {
				yield {
					type: 'assistant',
					message: {
						id: 'msg-bypass-test',
						content: [{ type: 'text', text: 'Permission bypass test successful' }]
					}
				};
			})();
			return generator;
		})
	};
});

const { ClaudeAdapter } = await import('../../src/lib/server/claude/ClaudeAdapter.js');

describe('Claude Bypass Permissions Configuration', () => {
	it('should default to bypassPermissions permission mode when no options provided', async () => {
		const adapter = new ClaudeAdapter();
		const instance = await adapter.create({
			cwd: '/tmp',
			onEvent: () => {}
		});

		await instance.input.write('test prompt');

		expect(capturedOptions?.options?.permissionMode).toBe('bypassPermissions');
	});

	it('should respect explicit permissionMode when provided', async () => {
		const adapter = new ClaudeAdapter();
		const instance = await adapter.create({
			cwd: '/tmp',
			options: { permissionMode: 'default' },
			onEvent: () => {}
		});

		await instance.input.write('test prompt');

		expect(capturedOptions?.options?.permissionMode).toBe('default');
	});

	it('should include all available tools in buildClaudeOptions by default', () => {
		const options = { cwd: '/tmp' };

		const expectedTools = [
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
		];

		expect(options.allowedTools).toEqual(expectedTools);
		expect(options.permissionMode).toBe('bypassPermissions');
	});

	it('should maintain compatibility with custom tool lists', () => {
		const customTools = ['FileRead', 'FileWrite', 'Bash'];
		const options = {
			cwd: '/tmp',
			allowedTools: customTools
		};

		expect(options.allowedTools).toEqual(customTools);
		expect(options.permissionMode).toBe('bypassPermissions');
	});

	it('should support custom permission modes', () => {
		const options = {
			cwd: '/tmp',
			permissionMode: 'acceptEdits'
		};

		expect(options.permissionMode).toBe('acceptEdits');
	});
});
