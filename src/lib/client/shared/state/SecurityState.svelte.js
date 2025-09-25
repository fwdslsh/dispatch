/**
 * Security state management for authentication warnings and method availability
 */

class SecurityState {
	warnings = $state([]);
	methodAvailability = $state({
		local: { available: true, reason: null },
		webauthn: { available: false, reason: 'Checking WebAuthn support...' },
		oauth: { available: false, reason: 'Checking OAuth configuration...' }
	});

	securityContext = $state({
		isHttps: false,
		hostname: 'localhost',
		hasValidCertificate: false,
		tunnelActive: false,
		tunnelUrl: null
	});

	constructor() {
		this.checkSecurityContext();
		this.checkMethodAvailability();
	}

	// Security context detection
	async checkSecurityContext() {
		try {
			this.securityContext.isHttps = window.location.protocol === 'https:';
			this.securityContext.hostname = window.location.hostname;

			// Check for tunnel indicators
			const hostname = this.securityContext.hostname;
			this.securityContext.tunnelActive =
				hostname.includes('.ngrok.io') ||
				hostname.includes('.localtunnel.me') ||
				hostname.includes('.tunnel.me') ||
				hostname.includes('.loca.lt');

			if (this.securityContext.tunnelActive) {
				this.securityContext.tunnelUrl = window.location.origin;
			}

			// Fetch additional context from server if available
			try {
				const response = await fetch('/api/security/context');
				if (response.ok) {
					const context = await response.json();
					this.securityContext = { ...this.securityContext, ...context };
				}
			} catch (error) {
				console.warn('Could not fetch security context from server:', error);
			}

			this.updateSecurityWarnings();
		} catch (error) {
			console.error('Error checking security context:', error);
		}
	}

	// Check availability of authentication methods
	async checkMethodAvailability() {
		// Check WebAuthn availability
		this.checkWebAuthnAvailability();

		// Check OAuth availability
		await this.checkOAuthAvailability();

		// Local auth is always available
		this.methodAvailability.local = { available: true, reason: null };
	}

	checkWebAuthnAvailability() {
		try {
			if (!window.PublicKeyCredential) {
				this.methodAvailability.webauthn = {
					available: false,
					reason: 'WebAuthn not supported by browser'
				};
				return;
			}

			if (!this.securityContext.isHttps && this.securityContext.hostname !== 'localhost') {
				this.methodAvailability.webauthn = {
					available: false,
					reason: 'WebAuthn requires HTTPS or localhost'
				};
				return;
			}

			// Check if hostname is suitable for WebAuthn
			if (this.securityContext.tunnelActive) {
				this.methodAvailability.webauthn = {
					available: true,
					reason: 'WebAuthn available via tunnel (credentials tied to tunnel domain)'
				};
			} else {
				this.methodAvailability.webauthn = {
					available: true,
					reason: null
				};
			}
		} catch (error) {
			this.methodAvailability.webauthn = {
				available: false,
				reason: 'Error checking WebAuthn support'
			};
		}
	}

	async checkOAuthAvailability() {
		try {
			const response = await fetch('/api/auth/oauth/config');
			if (response.ok) {
				const config = await response.json();
				const hasProviders = config.providers && config.providers.length > 0;

				if (!hasProviders) {
					this.methodAvailability.oauth = {
						available: false,
						reason: 'No OAuth providers configured'
					};
					return;
				}

				// Check if current URL is suitable for OAuth
				if (!this.securityContext.isHttps && this.securityContext.hostname !== 'localhost') {
					this.methodAvailability.oauth = {
						available: false,
						reason: 'OAuth requires HTTPS or localhost'
					};
					return;
				}

				this.methodAvailability.oauth = {
					available: true,
					reason: null,
					providers: config.providers
				};
			} else {
				this.methodAvailability.oauth = {
					available: false,
					reason: 'OAuth configuration not available'
				};
			}
		} catch (error) {
			this.methodAvailability.oauth = {
				available: false,
				reason: 'Error checking OAuth configuration'
			};
		}
	}

	// Generate contextual security warnings
	updateSecurityWarnings() {
		const newWarnings = [];

		// HTTP warning
		if (!this.securityContext.isHttps && this.securityContext.hostname !== 'localhost') {
			newWarnings.push({
				id: 'http-warning',
				type: 'warning',
				title: 'Insecure Connection',
				message: 'You are using HTTP instead of HTTPS. Authentication data may be intercepted. Consider enabling HTTPS or using a tunnel service.',
				dismissible: true,
				actions: [
					{
						label: 'Learn More',
						variant: 'secondary',
						action: 'learn-https'
					}
				]
			});
		}

		// Tunnel domain warning for WebAuthn
		if (this.securityContext.tunnelActive && this.methodAvailability.webauthn.available) {
			newWarnings.push({
				id: 'webauthn-tunnel-warning',
				type: 'info',
				title: 'WebAuthn on Tunnel Domain',
				message: 'Your WebAuthn credentials are tied to the current tunnel domain. If the tunnel changes, you may need to re-register your devices.',
				dismissible: true,
				actions: [
					{
						label: 'Understand',
						variant: 'secondary',
						action: 'understand-webauthn-tunnel'
					}
				]
			});
		}

		// Limited auth methods warning
		const availableMethods = Object.entries(this.methodAvailability)
			.filter(([_, config]) => config.available)
			.length;

		if (availableMethods === 1) {
			newWarnings.push({
				id: 'limited-auth-warning',
				type: 'warning',
				title: 'Limited Authentication Options',
				message: 'Only one authentication method is available. Consider configuring additional methods for better security and convenience.',
				dismissible: true,
				actions: [
					{
						label: 'Configure Methods',
						variant: 'primary',
						action: 'configure-auth-methods'
					}
				]
			});
		}

		// No OAuth providers warning (if OAuth is configured but no providers available)
		if (this.methodAvailability.oauth.reason === 'No OAuth providers configured') {
			newWarnings.push({
				id: 'no-oauth-providers',
				type: 'info',
				title: 'OAuth Not Configured',
				message: 'OAuth providers (Google, GitHub) are not configured. You can set them up for convenient authentication.',
				dismissible: true,
				actions: [
					{
						label: 'Configure OAuth',
						variant: 'secondary',
						action: 'configure-oauth'
					}
				]
			});
		}

		this.warnings = newWarnings;
	}

	// Add a new warning
	addWarning(warning) {
		const existingIndex = this.warnings.findIndex(w => w.id === warning.id);
		if (existingIndex >= 0) {
			this.warnings[existingIndex] = warning;
		} else {
			this.warnings = [...this.warnings, warning];
		}
	}

	// Remove a warning
	dismissWarning(warningId) {
		this.warnings = this.warnings.filter(w => w.id !== warningId);
	}

	// Get warnings for a specific context
	getWarningsForContext(context = 'general') {
		return this.warnings.filter(warning => {
			if (context === 'login') {
				return ['http-warning', 'limited-auth-warning'].includes(warning.id);
			}
			if (context === 'webauthn') {
				return ['webauthn-tunnel-warning', 'http-warning'].includes(warning.id);
			}
			if (context === 'oauth') {
				return ['no-oauth-providers', 'http-warning'].includes(warning.id);
			}
			return true;
		});
	}

	// Get available authentication methods
	getAvailableMethods() {
		return Object.entries(this.methodAvailability)
			.filter(([_, config]) => config.available)
			.map(([method, config]) => ({ method, ...config }));
	}

	// Get unavailable authentication methods with reasons
	getUnavailableMethods() {
		return Object.entries(this.methodAvailability)
			.filter(([_, config]) => !config.available)
			.map(([method, config]) => ({ method, ...config }));
	}

	// Refresh security state
	async refresh() {
		await this.checkSecurityContext();
		await this.checkMethodAvailability();
	}
}

export { SecurityState };