import { logger } from '../utils/logger.js';

const NO_CONVERSATION_PATTERN = /no conversation found/i;

function shouldRetry(error, sawNoConversation) {
	const message = String(error?.message || error || '').toLowerCase();
	if (!message && !sawNoConversation) return false;
	const promptTooLong =
		message.includes('prompt too long') ||
		(message.includes('context') && message.includes('too') && message.includes('long'));
	return promptTooLong || sawNoConversation;
}

function buildStreamOptions({ session, env, resume, onStderr, maxTurns }) {
	const baseOptions = {
		...session.options,
		env,
		stderr: onStderr
	};

	if (resume) {
		return {
			...baseOptions,
			continue: true,
			resume: session.sessionId,
			maxTurns
		};
	}

	return {
		...baseOptions,
		continue: false,
		maxTurns
	};
}

export class ClaudeStreamRunner {
	/**
	 * @param {Object} options
	 * @param {Function} options.queryFn - Function for querying Claude
	 * @param {Object} [options.log] - Logger instance
	 */
	constructor({ queryFn, log = logger }) {
		if (typeof queryFn !== 'function') {
			throw new Error('ClaudeStreamRunner requires a query function');
		}
		this.queryFn = queryFn;
		this.log = log;
	}

	async run({
		session,
		userInput,
		defaultOptions,
		env,
		onDelta,
		onComplete,
		onError,
		onActivityChange
	}) {
		const context = {
			sawNoConversation: false,
			sawAnyEvent: false
		};

		const notifyStreaming = () => {
			if (!context.sawAnyEvent) {
				context.sawAnyEvent = true;
				onActivityChange?.('streaming');
			}
		};

		const handleStderr = (data) => {
			try {
				const text = String(data || '');
				if (NO_CONVERSATION_PATTERN.test(text)) {
					context.sawNoConversation = true;
				}
				this.log.error('Claude', `stderr ${session.sessionId}`, data);
			} catch {}
		};

		const maxTurnsBase = defaultOptions?.maxTurns || 20;
		const shortMaxTurns = Math.min(20, maxTurnsBase);

		const runStreamAttempt = async ({ resume, maxTurns }) => {
			this.log.debug('Claude', 'Starting Claude stream attempt', {
				sessionId: session.sessionId,
				resume,
				maxTurns
			});

			const options = buildStreamOptions({ session, env, resume, onStderr: handleStderr, maxTurns });
			const stream = this.queryFn({ prompt: userInput, options });
			if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
				throw new Error('Claude stream did not return an async iterator');
			}

			for await (const event of stream) {
				if (!event) continue;
				notifyStreaming();
				onDelta?.(event);
			}
		};

		const finalize = () => {
			onActivityChange?.('idle');
			onComplete?.();
		};

		try {
			const resumeAttempt = !!session.resumeCapable;
			const primaryMaxTurns = resumeAttempt ? shortMaxTurns : maxTurnsBase;
			await runStreamAttempt({ resume: resumeAttempt, maxTurns: primaryMaxTurns });
			finalize();
			return { retried: false };
		} catch (error) {
			this.log.error('Claude', 'Primary Claude stream failed', error);
			if (!shouldRetry(error, context.sawNoConversation)) {
				onActivityChange?.('idle');
				onError?.(error, { retried: false });
				throw error;
			}

			this.log.warn('Claude', 'Retrying Claude stream without resume');
			context.sawAnyEvent = false; // allow streaming state to fire again

			try {
				await runStreamAttempt({ resume: false, maxTurns: shortMaxTurns });
				finalize();
				return { retried: true };
			} catch (retryError) {
				this.log.error('Claude', 'Claude stream retry failed', retryError);
				onActivityChange?.('idle');
				onError?.(retryError, { retried: true });
				throw retryError;
			}
		}
	}
}

export { shouldRetry };
