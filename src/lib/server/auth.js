const TERMINAL_KEY = process.env.TERMINAL_KEY ?? 'testkey12345';

export function validateKey(key) {
	// If TERMINAL_KEY is explicitly set to empty string, allow any key
	if (TERMINAL_KEY === '') {
		return true;
	}
	return key === TERMINAL_KEY;
}

export function requireAuth(key) {
	if (!validateKey(key)) {
		throw new Error('Invalid authentication key');
	}
}
