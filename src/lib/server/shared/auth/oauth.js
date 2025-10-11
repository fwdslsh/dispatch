/**
 * Legacy OAuth module - DEPRECATED
 *
 * This file previously contained MultiAuthManager, AuthProvider, GitHubAuthProvider,
 * and DevicePairingProvider classes that are no longer used.
 *
 * OAuth functionality has been moved to:
 * - OAuthManager: src/lib/server/auth/OAuth.server.js (OAuth provider management)
 * - SessionManager: src/lib/server/auth/SessionManager.server.js (session lifecycle)
 * - UserManager: src/lib/server/auth/UserManager.server.js (user management)
 *
 * This file is kept as a placeholder to prevent import errors during the transition.
 * It should be deleted once all references are confirmed removed.
 */

import { logger } from '../utils/logger.js';

logger.warn(
	'AUTH',
	'oauth.js is deprecated and will be removed. Use OAuthManager, SessionManager, and UserManager instead.'
);
