import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { logger } from './utils/logger.js';

/**
 * Enhanced TunnelManager with security policy integration
 * Manages LocalTunnel for public URL access with runtime control
 * Integrates with security, OAuth, and WebAuthn systems for automatic updates
 * Uses database settings for persistent tunnel configuration
 */
export class TunnelManager extends EventEmitter {
	constructor({ port, subdomain = '', database }) {
		super();
		this.port = port;
		this.subdomain = subdomain;
		this.database = database;
		this.process = null;
		this.isEnabled = false;
		this.currentUrl = null;
		this.previousUrl = null;
		this.io = null; // Socket.IO instance for broadcasting

		// Integration hooks for automatic updates
		this.securityHooks = [];
		this.oauthHooks = [];
		this.webauthnHooks = [];

		// Store original security policies for rollback
		this.originalSecurityPolicies = null;

		// Hosting context cache
		this.hostingContext = {
			mode: 'lan',
			isSecure: false,
			hasCustomDomain: false,
			hasTunnel: false
		};
	}

	/**
	 * Set Socket.IO instance for broadcasting status updates
	 * @param {object} io - Socket.IO server instance
	 */
	setSocketIO(io) {
		this.io = io;
		logger.info('TUNNEL', 'Socket.IO instance set for broadcasting');
	}

	/**
	 * Initialize tunnel manager and restore state from database
	 * @returns {Promise<void>}
	 */
	async init() {
		try {
			const settings = await this._loadTunnelSettings();

			// Restore configuration from database
			if (settings.subdomain !== undefined) {
				this.subdomain = settings.subdomain;
			}
			if (settings.enabled !== undefined) {
				this.isEnabled = settings.enabled;
			}
			// Note: URL is not restored since tunnel process needs to be restarted
			// after server restart

			logger.info('TUNNEL', 'Tunnel manager initialized from database settings');
		} catch (error) {
			logger.error('TUNNEL', `Failed to initialize tunnel manager: ${error.message}`);
		}
	}

	/**
	 * Start the LocalTunnel
	 * @returns {Promise<boolean>} Success status
	 */
	async start() {
		if (this.process && !this.process.killed) {
			logger.warn('TUNNEL', 'Tunnel is already running');
			return false;
		}

		try {
			const args = ['--port', this.port.toString()];
			if (this.subdomain) args.push('--subdomain', this.subdomain);

			logger.info('TUNNEL', `Starting LocalTunnel on port ${this.port}...`);
			this.process = spawn('npx', ['localtunnel', ...args], { stdio: 'pipe' });

			this.process.stdout.on('data', async (buf) => {
				const line = buf.toString().trim();
				logger.debug('TUNNEL', line);
				const url = this._extractUrl(line);
				if (url) {
					this.previousUrl = this.currentUrl;
					this.currentUrl = url;
					await this._saveTunnelSettings();
					logger.info('TUNNEL', `Public URL: ${url}`);

					// Update hosting context
					this.hostingContext.hasTunnel = true;
					this.hostingContext.mode = 'tunnel';
					this.hostingContext.isSecure = url.startsWith('https');

					// Trigger URL change handlers
					if (this.previousUrl !== url) {
						await this.onUrlChange(url);
					}

					// Broadcast status update to all connected clients
					if (this.io) {
						this.io.emit('tunnel.status', this.getEnhancedStatus());
						this.io.emit('tunnel.connected', { url });
					}

					// Emit URL changed event
					this.emit('url.changed', { previousUrl: this.previousUrl, currentUrl: url });
				}
			});

			this.process.stderr.on('data', (buf) => {
				logger.error('TUNNEL', buf.toString().trim());
			});

			this.process.on('exit', async (code, signal) => {
				logger.info('TUNNEL', `Process exited with code=${code} signal=${signal}`);
				await this._cleanup();
			});

			this.isEnabled = true;
			await this._saveTunnelSettings();
			return true;
		} catch (error) {
			logger.error('TUNNEL', `Failed to start tunnel: ${error.message}`);
			this.isEnabled = false;
			await this._saveTunnelSettings();
			return false;
		}
	}

	/**
	 * Stop the LocalTunnel
	 * @returns {Promise<boolean>} Success status
	 */
	async stop() {
		if (!this.process || this.process.killed) {
			logger.warn('TUNNEL', 'Tunnel is not running');
			return false;
		}

		try {
			this.process.kill();
			await this._cleanup();
			logger.info('TUNNEL', 'Tunnel stopped');
			return true;
		} catch (error) {
			logger.error('TUNNEL', `Failed to stop tunnel: ${error.message}`);
			return false;
		}
	}

	/**
	 * Get tunnel status
	 * @returns {object} Status information
	 */
	getStatus() {
		return {
			enabled: this.isEnabled,
			running: this.process && !this.process.killed,
			url: this.currentUrl,
			port: this.port,
			subdomain: this.subdomain
		};
	}

	/**
	 * Get enhanced status with security and compatibility information
	 * @returns {object} Enhanced status information
	 */
	getEnhancedStatus() {
		const basicStatus = this.getStatus();
		return {
			...basicStatus,
			hostingContext: this.getHostingContext(),
			security: this.getSecurityStatus(),
			compatibility: this.getCompatibilityStatus(),
			recommendations: this.getSecurityRecommendations()
		};
	}

	/**
	 * Update tunnel configuration
	 * @param {object} config - Configuration updates
	 * @returns {Promise<boolean>} Success status
	 */
	async updateConfig(config) {
		try {
			if (config.subdomain !== undefined) {
				this.subdomain = config.subdomain;
				logger.info('TUNNEL', `Subdomain updated to: ${this.subdomain || '(default)'}`);
			}
			if (config.enabled !== undefined) {
				this.isEnabled = config.enabled;
			}
			await this._saveTunnelSettings();
			return true;
		} catch (error) {
			logger.error('TUNNEL', `Failed to update config: ${error.message}`);
			return false;
		}
	}

	/**
	 * Get current public URL
	 * @returns {string|null} Current URL or null if not available
	 */
	getPublicUrl() {
		if (!this.isEnabled || !this.currentUrl) {
			return null;
		}
		return this.currentUrl;
	}

	/**
	 * Extract URL from LocalTunnel output
	 * @private
	 */
	_extractUrl(line) {
		const match = line.match(/your url is:\s*(https?:\/\/[^\s]+)/i);
		return match ? match[1] : null;
	}

	/**
	 * Save tunnel settings to database
	 * @private
	 */
	async _saveTunnelSettings() {
		try {
			if (!this.database) {
				logger.warn('TUNNEL', 'No database available for saving settings');
				return;
			}

			const tunnelSettings = {
				enabled: this.isEnabled,
				subdomain: this.subdomain,
				url: this.currentUrl,
				port: this.port,
				lastUpdated: Date.now()
			};

			await this.database.setSettingsForCategory(
				'tunnel',
				tunnelSettings,
				'LocalTunnel configuration and status'
			);
		} catch (error) {
			logger.error('TUNNEL', `Failed to save tunnel settings: ${error.message}`);
		}
	}

	/**
	 * Load tunnel settings from database
	 * @private
	 */
	async _loadTunnelSettings() {
		try {
			if (!this.database) {
				logger.warn('TUNNEL', 'No database available for loading settings');
				return {};
			}

			return await this.database.getSettingsByCategory('tunnel');
		} catch (error) {
			logger.error('TUNNEL', `Failed to load tunnel settings: ${error.message}`);
			return {};
		}
	}

	/**
	 * Cleanup tunnel state
	 * @private
	 */
	async _cleanup() {
		const hadUrl = this.currentUrl !== null;

		this.isEnabled = false;
		this.previousUrl = this.currentUrl;
		this.currentUrl = null;
		this.process = null;

		// Update hosting context
		this.hostingContext.hasTunnel = false;
		this.hostingContext.mode = 'lan';

		// Rollback security policies if tunnel was active
		if (hadUrl) {
			await this.rollbackSecurityPolicies();
		}

		await this._saveTunnelSettings();

		// Broadcast disconnection
		if (this.io) {
			this.io.emit('tunnel.disconnected', { reason: 'tunnel_stopped' });
			this.io.emit('tunnel.status', this.getEnhancedStatus());
		}

		// Emit disconnected event
		this.emit('tunnel.disconnected');
	}

	// ===== Security Policy Integration Hooks =====

	/**
	 * Register security policy manager hook
	 * @param {SecurityPolicyManager} securityManager
	 */
	registerSecurityHook(securityManager) {
		this.securityHooks.push(securityManager);
		logger.info('TUNNEL', 'Security policy hook registered');
	}

	/**
	 * Register OAuth manager hook
	 * @param {OAuthManager} oauthManager
	 */
	registerOAuthHook(oauthManager) {
		this.oauthHooks.push(oauthManager);
		logger.info('TUNNEL', 'OAuth hook registered');
	}

	/**
	 * Register WebAuthn/Auth manager hook
	 * @param {AuthManager} authManager
	 */
	registerWebAuthnHook(authManager) {
		this.webauthnHooks.push(authManager);
		logger.info('TUNNEL', 'WebAuthn hook registered');
	}

	// ===== URL Change Handlers =====

	/**
	 * Handle URL changes and trigger all registered hooks
	 * @param {string} newUrl - The new tunnel URL
	 */
	async onUrlChange(newUrl) {
		logger.info('TUNNEL', `Handling URL change to: ${newUrl}`);

		// Store original policies before changes
		if (!this.originalSecurityPolicies && this.database) {
			this.originalSecurityPolicies = await this.database.getSettingsByCategory('security');
		}

		// Broadcast starting updates
		if (this.io) {
			this.io.emit('security.updating', { reason: 'tunnel_url_changed', url: newUrl });
		}

		try {
			// Update all registered components
			await this.performAtomicUpdate(newUrl);

			// Broadcast completion
			if (this.io) {
				this.io.emit('security.updated', { url: newUrl, success: true });
			}
		} catch (error) {
			logger.error('TUNNEL', `Failed to update configurations: ${error.message}`);

			// Broadcast error
			if (this.io) {
				this.io.emit('security.update_failed', { error: error.message });
			}
		}
	}

	/**
	 * Perform atomic update of all configurations
	 * @param {string} url - The new tunnel URL
	 */
	async performAtomicUpdate(url) {
		const updates = [];

		// Update security policies
		for (const hook of this.securityHooks) {
			try {
				if (hook.updateTunnelOrigins) {
					updates.push(hook.updateTunnelOrigins({ url }));
				}
				if (hook.updateSecurityContext) {
					updates.push(hook.updateSecurityContext(this.getHostingContext()));
				}
			} catch (error) {
				logger.error('TUNNEL', `Security hook update failed: ${error.message}`);
			}
		}

		// Update OAuth redirect URIs
		for (const hook of this.oauthHooks) {
			try {
				if (hook.updateBaseUrl) {
					hook.updateBaseUrl(url);
				}
				if (hook.updateProviderRedirectUris) {
					updates.push(hook.updateProviderRedirectUris());
				}
			} catch (error) {
				logger.error('TUNNEL', `OAuth hook update failed: ${error.message}`);
			}
		}

		// Validate WebAuthn compatibility
		for (const hook of this.webauthnHooks) {
			try {
				if (hook.validateWebAuthnCompatibility) {
					const validation = await hook.validateWebAuthnCompatibility(url);
					if (!validation.compatible) {
						logger.warn('TUNNEL', `WebAuthn incompatibility: ${validation.reason}`);

						// Emit warning to clients
						if (this.io) {
							this.io.emit('security.warning', {
								type: 'webauthn',
								message: validation.reason,
								severity: 'warning'
							});
						}
					}
				}
			} catch (error) {
				logger.error('TUNNEL', `WebAuthn validation failed: ${error.message}`);
			}
		}

		// Wait for all updates to complete
		await Promise.allSettled(updates);
	}

	/**
	 * Rollback security policies to original state
	 */
	async rollbackSecurityPolicies() {
		if (!this.originalSecurityPolicies || !this.database) {
			return;
		}

		try {
			logger.info('TUNNEL', 'Rolling back security policies to pre-tunnel state');

			await this.database.setSettingsForCategory(
				'security',
				this.originalSecurityPolicies,
				'Rollback security policies after tunnel disconnection'
			);

			// Clear stored policies
			this.originalSecurityPolicies = null;

			// Notify hooks of rollback
			for (const hook of this.securityHooks) {
				if (hook.onTunnelDisconnected) {
					await hook.onTunnelDisconnected();
				}
			}
		} catch (error) {
			logger.error('TUNNEL', `Failed to rollback security policies: ${error.message}`);
		}
	}

	// ===== Status and Context Methods =====

	/**
	 * Get current hosting context
	 * @returns {object} Hosting context information
	 */
	getHostingContext() {
		return {
			...this.hostingContext,
			tunnelUrl: this.currentUrl
		};
	}

	/**
	 * Get security status
	 * @returns {object} Security configuration status
	 */
	getSecurityStatus() {
		return {
			cors: {
				configured: this.securityHooks.length > 0,
				updated: this.currentUrl !== null
			},
			cookies: {
				secure: this.hostingContext.isSecure
			},
			hsts: {
				enabled: this.hostingContext.isSecure
			}
		};
	}

	/**
	 * Get compatibility status for various auth methods
	 * @returns {object} Compatibility information
	 */
	getCompatibilityStatus() {
		return {
			webauthn: {
				available: false, // Not available over changing tunnel URLs
				reason: this.currentUrl ? 'Tunnel URLs change on restart' : 'No tunnel active'
			},
			oauth: {
				configured: this.oauthHooks.length > 0,
				redirectUrisUpdated: this.currentUrl !== null
			},
			passkeys: {
				available: false,
				reason: 'Requires stable domain name'
			}
		};
	}

	/**
	 * Get security recommendations based on current mode
	 * @returns {Array} List of security recommendations
	 */
	getSecurityRecommendations() {
		const recommendations = [];

		if (this.hostingContext.mode === 'tunnel') {
			recommendations.push({
				level: 'warning',
				message: 'WebAuthn not available over tunnel without stable domain',
				action: 'Consider using custom domain for WebAuthn support'
			});

			recommendations.push({
				level: 'info',
				message: 'Tunnel URLs may change on restart',
				action: 'Use subdomain option for more stable URLs'
			});
		}

		if (this.hostingContext.mode === 'lan') {
			recommendations.push({
				level: 'info',
				message: 'LAN-only mode - remote access disabled',
				action: 'Enable tunnel for remote access'
			});
		}

		if (!this.hostingContext.isSecure) {
			recommendations.push({
				level: 'warning',
				message: 'Running over HTTP - some features may be limited',
				action: 'Enable HTTPS with certificates or use tunnel'
			});
		}

		return recommendations;
	}

	/**
	 * Broadcast event to all connected clients
	 * @param {string} type - Event type
	 * @param {object} data - Event data
	 */
	broadcastEvent(type, data) {
		if (this.io) {
			this.io.emit(type, data);
		}
	}
}
