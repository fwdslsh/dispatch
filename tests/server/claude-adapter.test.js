import { describe, expect, it, vi } from 'vitest';

vi.mock('@anthropic-ai/claude-code', () => {
	return {
		query: vi.fn(() => {
			const generator = (async function* () {
				yield {
					type: 'assistant',
					message: {
						id: 'msg-123',
						content: [{ type: 'text', text: 'Hello from Claude' }]
					}
				};
				yield {
					type: 'result',
					result: 'All done',
					is_error: false,
					total_cost_usd: 0.01
				};
			})();

			return generator;
		})
	};
});

const { ClaudeAdapter } = await import('../../src/lib/server/adapters/ClaudeAdapter.js');

describe('ClaudeAdapter', () => {
	it('emits claude:message events with normalized payload structure', async () => {
		const events = [];
		const adapter = new ClaudeAdapter();
		const instance = await adapter.create({
			cwd: '/tmp',
			onEvent: (event) => events.push(event)
		});

		await instance.input.write('test prompt');

		expect(events).toHaveLength(2);
		for (const event of events) {
			expect(event.channel).toBe('claude:message');
			expect(event.payload?.events).toBeDefined();
			expect(Array.isArray(event.payload.events)).toBe(true);
			expect(event.payload.events[0]).toHaveProperty('type');
		}

		const [assistantEvent, resultEvent] = events;
		expect(assistantEvent.payload.events[0].type).toBe('assistant');
		expect(assistantEvent.payload.events[0].message?.content?.[0]?.text).toContain('Hello');
		expect(resultEvent.payload.events[0].type).toBe('result');
		expect(resultEvent.payload.events[0].result).toBe('All done');
	});
});
