/**
 * Socket Manager - Uses simplified session architecture
 * The simplified implementation provides a clean abstraction layer
 * that shields the application from session type details
 */

export async function getSocketSetup() {
	console.log('[SOCKET] Using simplified session architecture');
	const { setupSocketIO } = await import('./socket-setup-simplified.js');
	return { setupSocketIO, mode: 'simplified' };
}

export { getSocketEvents } from './socket-setup-simplified.js';
