/**
 * Method invocation utilities to simplify common patterns
 *
 * Provides standardized patterns for calling methods that may or may not exist
 * following SOLID principles while maintaining simplicity.
 */

/**
 * Safely call one of several possible cleanup methods on an object
 * @param {object} service - Object to call cleanup methods on
 * @param {Array<string>} methodNames - Method names to try in order
 * @returns {Promise<boolean>} True if a method was called, false otherwise
 */
export async function safeCallCleanup(service, methodNames = ['dispose', 'cleanup', 'close']) {
	if (!service || typeof service !== 'object') {
		return false;
	}

	for (const methodName of methodNames) {
		const method = service[methodName];
		if (typeof method === 'function') {
			await method.call(service);
			return true;
		}
	}

	return false;
}

/**
 * Safely call a method if it exists
 * @param {object} obj - Object to call method on
 * @param {string} methodName - Method name to call
 * @param {...any} args - Arguments to pass to the method
 * @returns {any} Method result or undefined if method doesn't exist
 */
export function safeCall(obj, methodName, ...args) {
	if (!obj || typeof obj !== 'object') {
		return undefined;
	}

	const method = obj[methodName];
	if (typeof method === 'function') {
		return method.call(obj, ...args);
	}

	return undefined;
}

/**
 * Safely call an async method if it exists
 * @param {object} obj - Object to call method on
 * @param {string} methodName - Method name to call
 * @param {...any} args - Arguments to pass to the method
 * @returns {Promise<any>} Method result or undefined if method doesn't exist
 */
export async function safeCallAsync(obj, methodName, ...args) {
	if (!obj || typeof obj !== 'object') {
		return undefined;
	}

	const method = obj[methodName];
	if (typeof method === 'function') {
		return await method.call(obj, ...args);
	}

	return undefined;
}

/**
 * Check if object has method without verbose typeof checks
 * @param {object} obj - Object to check
 * @param {string} methodName - Method name to check
 * @returns {boolean} True if method exists and is callable
 */
export function hasMethod(obj, methodName) {
	return obj && typeof obj === 'object' && typeof obj[methodName] === 'function';
}

/**
 * Conditionally call a method if object exists and has the method
 * @param {object} obj - Object to call method on
 * @param {string} methodName - Method name to call
 * @param {...any} args - Arguments to pass
 * @returns {any} Method result or undefined
 */
export function callIfExists(obj, methodName, ...args) {
	return hasMethod(obj, methodName) ? obj[methodName](...args) : undefined;
}
