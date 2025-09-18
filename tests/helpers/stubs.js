/**
 * Simple test stubs - only implement what tests actually use
 * No complex mocks that break when interfaces change
 */

/**
 * Minimal SessionApiClient stub
 * Only implement what the component actually calls
 */
export const createSessionApiStub = () => {
	const stub = {
		list: () => Promise.resolve({ sessions: [] }),
		create: () => Promise.resolve({ id: 'test-session', typeSpecificId: 'test-123' })
	};

	// Add minimal properties to satisfy type checking
	// These are never called but TypeScript needs them
	stub.config = {};
	stub.baseUrl = '';
	stub.getHeaders = () => ({});
	stub.handleResponse = () => {};
	stub.update = () => Promise.resolve({});
	stub.delete = () => Promise.resolve({});
	stub.rename = () => Promise.resolve({});
	stub.pin = () => Promise.resolve({});
	stub.unpin = () => Promise.resolve({});
	stub.getHistory = () => Promise.resolve([]);
	stub.getClaudeSessions = () => Promise.resolve([]);
	stub.checkClaudeAuth = () => Promise.resolve({ authenticated: false });
	stub.validateSessionOptions = () => true;
	stub.dispose = () => {};

	return stub;
};

export const createPersistenceStub = () => ({
	get: () => null,
	set: () => {}
});

export const createLoggerStub = () => ({
	info: () => {},
	debug: () => {},
	warn: () => {},
	error: () => {},
	getLogLevel: () => 1,
	getLogLevelName: () => 'INFO'
});