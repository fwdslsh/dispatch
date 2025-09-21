import { describe, it, expect, vi } from 'vitest';
import { ClaudeAdapter } from '../../src/lib/server/claude/ClaudeAdapter.js';

describe('ClaudeAdapter error handling', () => {
	it('should prevent interrupt errors by removing interrupt method', async () => {
		// Mock the Claude Code SDK with interrupt method that would throw
		const mockQuery = vi.fn().mockImplementation(function* () {
			yield { type: 'message', content: 'test' };
		});

		// Add an interrupt method that would throw the problematic error
		mockQuery.interrupt = vi.fn().mockImplementation(() => {
			throw new Error('interrupt requires --input-format stream-json');
		});

		// Mock the claude-code module
		vi.doMock('@anthropic-ai/claude-code', () => ({
			query: vi.fn().mockReturnValue(mockQuery)
		}));

		const adapter = new ClaudeAdapter();
		const onEvent = vi.fn();

		const session = await adapter.create({
			cwd: '/tmp',
			onEvent
		});

		// Simulate starting a query
		await session.input.write('test message');

		// Verify that the interrupt method was removed from the query
		expect(mockQuery.interrupt).toBeUndefined();

		// Test that close() completes gracefully without interrupting
		expect(() => session.close()).not.toThrow();
	});

	it('should handle closing gracefully with active queries', async () => {
		// Mock an async iterator that yields multiple events
		const mockQuery = {
			async *[Symbol.asyncIterator]() {
				yield { type: 'message', content: 'test 1' };
				yield { type: 'message', content: 'test 2' };
			},
			interrupt: vi.fn() // This will be deleted by our adapter
		};

		// Mock the claude-code module
		vi.doMock('@anthropic-ai/claude-code', () => ({
			query: vi.fn().mockReturnValue(mockQuery)
		}));

		const adapter = new ClaudeAdapter();
		const onEvent = vi.fn();

		const session = await adapter.create({
			cwd: '/tmp',
			onEvent
		});

		// Start a query (don't await - let it run in background)
		const queryPromise = session.input.write('test message');

		// Close the session while query is running
		expect(() => session.close()).not.toThrow();

		// Wait for query to complete
		await queryPromise;

		// Verify interrupt method was removed
		expect(mockQuery.interrupt).toBeUndefined();
	});
});
