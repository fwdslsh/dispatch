// Export all data access objects
export { UserDAO } from './User.js';
export { AuthSessionDAO } from './AuthSession.js';
export { UserDeviceDAO } from './UserDevice.js';
export { WebAuthnCredentialDAO } from './WebAuthnCredential.js';
export { OAuthAccountDAO } from './OAuthAccount.js';
export { AuthEventDAO } from './AuthEvent.js';
export { CertificateDAO } from './Certificate.js';

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