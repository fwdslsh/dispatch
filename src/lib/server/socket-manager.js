/**
 * Socket Manager - Provides a configurable socket setup
 * Can use either the simplified abstraction or the original implementation
 */

// Environment variable to control which implementation to use
// Default to simplified sessions unless explicitly disabled
const USE_SIMPLIFIED = process.env.USE_SIMPLIFIED_SESSIONS !== 'false';

export async function getSocketSetup() {
	if (USE_SIMPLIFIED) {
		console.log('[SOCKET] Using simplified session architecture');
		const { setupSocketIO } = await import('./socket-setup-simplified.js');
		return { setupSocketIO, mode: 'simplified' };
	} else {
		console.log('[SOCKET] Using original session architecture');
		const { setupSocketIO } = await import('./socket-setup.js');
		return { setupSocketIO, mode: 'original' };
	}
}

export { getSocketEvents } from './socket-setup.js';
