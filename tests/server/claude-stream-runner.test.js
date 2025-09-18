import { describe, expect, it, vi } from 'vitest';
import { ClaudeStreamRunner } from '../../src/lib/server/claude/ClaudeStreamRunner.js';


const createLogStub = () => ({
	info: () => {},
	debug: () => {},
	warn: () => {},
	error: () => {},
	getLogLevel: () => 1,
	getLogLevelName: () => 'INFO'
});

describe('ClaudeStreamRunner', () => {
	const baseSession = {
		sessionId: 'claude-123',
		workspacePath: '/workspace',
		resumeCapable: true,
		options: {},
		appSessionId: 'app-1'
	};

	const defaultOptions = { maxTurns: 500 };
	const env = { HOME: '/home/test' };

	it('emits events and completion callbacks', async () => {
		const queryFn = vi.fn().mockImplementation(() => {
			return (async function* () {
				yield { type: 'delta', content: 'hello' };
			})();
		});
		const runner = new ClaudeStreamRunner({ queryFn, log: createLogStub() });

		const onDelta = vi.fn();
		const onComplete = vi.fn();
		const onError = vi.fn();
		const onActivityChange = vi.fn();

		await runner.run({
			session: { ...baseSession },
			userInput: 'hi',
			defaultOptions,
			env,
			onDelta,
			onComplete,
			onError,
			onActivityChange
		});

		expect(onDelta).toHaveBeenCalledWith({ type: 'delta', content: 'hello' });
		expect(onComplete).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
		expect(onActivityChange).toHaveBeenCalledWith('streaming');
		expect(onActivityChange).toHaveBeenCalledWith('idle');
	});

	it('retries when the primary attempt errors with prompt too long', async () => {
		let callCount = 0;
		const queryFn = vi.fn().mockImplementation(({ options }) => {
			callCount += 1;
			if (callCount === 1) {
				throw new Error('Prompt too long for this conversation');
			}
			return (async function* () {
				yield { type: 'delta', content: options.resume ? 'resume' : 'fresh' };
			})();
		});

		const runner = new ClaudeStreamRunner({ queryFn, log: createLogStub() });
		const onError = vi.fn();

		const result = await runner.run({
			session: { ...baseSession },
			userInput: 'hi',
			defaultOptions,
			env,
			onDelta: vi.fn(),
			onComplete: vi.fn(),
			onError,
			onActivityChange: vi.fn()
		});

		expect(result).toEqual({ retried: true });
		expect(queryFn).toHaveBeenCalledTimes(2);
		expect(onError).not.toHaveBeenCalled();
	});

	it('retries when stderr indicates missing conversation', async () => {
		const queryFn = vi.fn().mockImplementation(({ options }) => {
			if (options.resume) {
				options.stderr?.('No conversation found on disk');
				throw new Error('resume failed');
			}
			return (async function* () {
				yield { type: 'delta', content: 'fresh run' };
			})();
		});

		const runner = new ClaudeStreamRunner({ queryFn, log: createLogStub() });
		const onError = vi.fn();
		const onComplete = vi.fn();

		const result = await runner.run({
			session: { ...baseSession },
			userInput: 'hi',
			defaultOptions,
			env,
			onDelta: vi.fn(),
			onComplete,
			onError,
			onActivityChange: vi.fn()
		});

		expect(result).toEqual({ retried: true });
		expect(queryFn).toHaveBeenCalledTimes(2);
		expect(onComplete).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
	});
});
