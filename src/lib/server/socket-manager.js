/**
 * Socket Manager - Uses simplified session architecture
 * The simplified implementation provides a clean abstraction layer
 * that shields the application from session type details
 */

import { logger } from './utils/logger.js';

export async function getSocketSetup() {
	logger.info('SOCKET', 'Using simplified session architecture');
	const { setupSocketIO } = await import('./socket-setup.js');
	return { setupSocketIO, mode: 'simplified' };
}

export { getSocketEvents } from './socket-setup.js';
