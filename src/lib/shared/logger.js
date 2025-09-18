import { createLogger as createClientLogger } from '$lib/client/shared/utils/logger.js';

// In browser contexts this will be undefined, but importing for shared API makes usage easier.
export const clientLogger = createClientLogger;
