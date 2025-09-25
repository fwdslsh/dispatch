// Import all data access objects
import { UserDAO } from './User.js';
import { AuthSessionDAO } from './AuthSession.js';
import { UserDeviceDAO } from './UserDevice.js';
import { WebAuthnCredentialDAO } from './WebAuthnCredential.js';
import { OAuthAccountDAO } from './OAuthAccount.js';
import { AuthEventDAO } from './AuthEvent.js';
import { CertificateDAO } from './Certificate.js';

// Export all data access objects
export {
	UserDAO,
	AuthSessionDAO,
	UserDeviceDAO,
	WebAuthnCredentialDAO,
	OAuthAccountDAO,
	AuthEventDAO,
	CertificateDAO
};

/**
 * Initialize all DAOs with a database manager instance
 */
export function createDAOs(databaseManager) {
	return {
		users: new UserDAO(databaseManager),
		authSessions: new AuthSessionDAO(databaseManager),
		userDevices: new UserDeviceDAO(databaseManager),
		webauthnCredentials: new WebAuthnCredentialDAO(databaseManager),
		oauthAccounts: new OAuthAccountDAO(databaseManager),
		authEvents: new AuthEventDAO(databaseManager),
		certificates: new CertificateDAO(databaseManager)
	};
}
