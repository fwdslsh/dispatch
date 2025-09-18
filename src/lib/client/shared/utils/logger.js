/**
 * Shared client-side logger wrapper to keep logging consistent with server logger.
 */
const levels = ['debug', 'info', 'warn', 'error'];

function createLogger(namespace = 'CLIENT') {
	const format = (level, ...args) => {
		const timestamp = new Date().toISOString();
		return [`[${timestamp}] [${namespace}] [${level.toUpperCase()}]`, ...args];
	};

	const logger = {};

	for (const level of levels) {
		logger[level] = (...args) => {
			if (typeof console[level] === 'function') {
				console[level](...format(level, ...args));
			} else {
				console.log(...format(level, ...args));
			}
		};
	}

	logger.child = (childNamespace) => createLogger(`${namespace}:${childNamespace}`);

	return logger;
}

export const logger = createLogger();
export { createLogger };
