const TERMINAL_KEY = process.env.TERMINAL_KEY || 'testkey12345';

export function validateKey(key) {
	return key === TERMINAL_KEY;
}

export function requireAuth(key) {
	if (!validateKey(key)) {
		throw new Error('Invalid authentication key');
	}
}
