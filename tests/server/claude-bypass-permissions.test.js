import { describe, expect, it, vi } from 'vitest';
import {
	buildClaudeOptions,
	CLAUDE_DEFAULT_ALLOWED_TOOLS
} from '../../src/lib/server/claude/claude-options.js';

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
		const options = buildClaudeOptions({ cwd: '/tmp' });

		expect(options.allowedTools).toEqual(CLAUDE_DEFAULT_ALLOWED_TOOLS);
		expect(options.permissionMode).toBe('bypassPermissions');
	});

	it('should maintain compatibility with custom tool lists', () => {
		const customTools = ['FileRead', 'FileWrite', 'Bash'];
		const options = buildClaudeOptions({ cwd: '/tmp', allowedTools: customTools });

		expect(options.allowedTools).toEqual(customTools);
		expect(options.permissionMode).toBe('bypassPermissions');
	});

	it('should support custom permission modes', () => {
		const options = buildClaudeOptions({ cwd: '/tmp', permissionMode: 'acceptEdits' });

		expect(options.permissionMode).toBe('acceptEdits');
	});
});
