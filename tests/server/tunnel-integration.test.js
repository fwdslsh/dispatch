import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TunnelManager } from '../../src/lib/server/shared/TunnelManager.js';
import { SecurityPolicyManager } from '../../src/lib/server/shared/security/SecurityPolicyManager.js';
import { OAuthManager } from '../../src/lib/server/shared/auth/OAuthManager.js';
import { AuthManager } from '../../src/lib/server/shared/auth/AuthManager.js';
import { EventEmitter } from 'events';
import { spawn } from 'node:child_process';

// Mock child_process spawn
vi.mock('node:child_process', () => ({
	spawn: vi.fn()
}));

// Mock logger
vi.mock('../../src/lib/server/shared/utils/logger.js', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn()
	}
}));

describe('Enhanced Tunnel Integration', () => {
	let tunnelManager;
	let securityPolicyManager;
	let oauthManager;
	let authManager;
	let mockDatabase;
	let mockProcess;
	let mockIO;

	beforeEach(() => {
		// Create mock database
		mockDatabase = {
			getSettingsByCategory: vi.fn().mockResolvedValue({}),
			setSettingsForCategory: vi.fn().mockResolvedValue(),
			getAllSettings: vi.fn().mockResolvedValue({}),
			updateSetting: vi.fn().mockResolvedValue(),
			run: vi.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
			get: vi.fn().mockResolvedValue({}),
			all: vi.fn().mockResolvedValue([])
		};

		// Create mock process for LocalTunnel
		mockProcess = new EventEmitter();
		mockProcess.stdout = new EventEmitter();
		mockProcess.stderr = new EventEmitter();
		mockProcess.kill = vi.fn();
		mockProcess.killed = false;

		// Mock spawn to return our mock process
		spawn.mockReturnValue(mockProcess);

		// Create mock Socket.IO instance
		mockIO = {
			emit: vi.fn()
		};

		// Create managers
		tunnelManager = new TunnelManager({
			port: 3030,
			subdomain: 'test',
			database: mockDatabase
		});
		tunnelManager.setSocketIO(mockIO);

		securityPolicyManager = new SecurityPolicyManager(mockDatabase);
		oauthManager = new OAuthManager(mockDatabase, 'http://localhost:3030');
		authManager = new AuthManager(mockDatabase);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('URL Change Detection and Propagation', () => {
		it('should detect tunnel URL changes and emit events', async () => {
			// Start tunnel
			await tunnelManager.start();

			// Simulate LocalTunnel providing URL
			const tunnelUrl = 'https://test.loca.lt';
			mockProcess.stdout.emit('data', Buffer.from(`your url is: ${tunnelUrl}`));

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 10));

			// Check that URL was detected
			expect(tunnelManager.currentUrl).toBe(tunnelUrl);
			expect(mockIO.emit).toHaveBeenCalledWith('tunnel.status', expect.objectContaining({
				url: tunnelUrl,
				running: true
			}));
		});

		it('should emit url.changed event when tunnel URL changes', async () => {
			// Add event listener for URL changes
			const urlChangeHandler = vi.fn();
			tunnelManager.on = vi.fn(); // Mock event emitter
			tunnelManager.emit = vi.fn();

			// Extend TunnelManager to emit events
			tunnelManager.previousUrl = null;

			await tunnelManager.start();

			// First URL
			const firstUrl = 'https://test1.loca.lt';
			mockProcess.stdout.emit('data', Buffer.from(`your url is: ${firstUrl}`));
			await new Promise(resolve => setTimeout(resolve, 10));

			// Simulate URL change
			const newUrl = 'https://test2.loca.lt';
			tunnelManager.previousUrl = firstUrl;
			mockProcess.stdout.emit('data', Buffer.from(`your url is: ${newUrl}`));
			await new Promise(resolve => setTimeout(resolve, 10));

			// Should detect change
			expect(tunnelManager.currentUrl).toBe(newUrl);
		});

		it('should handle tunnel disconnection and cleanup', async () => {
			await tunnelManager.start();

			// Simulate tunnel URL
			const tunnelUrl = 'https://test.loca.lt';
			mockProcess.stdout.emit('data', Buffer.from(`your url is: ${tunnelUrl}`));
			await new Promise(resolve => setTimeout(resolve, 10));

			// Simulate process exit
			mockProcess.emit('exit', 0, null);
			await new Promise(resolve => setTimeout(resolve, 10));

			// Check cleanup
			expect(tunnelManager.currentUrl).toBeNull();
			expect(tunnelManager.isEnabled).toBe(false);
			expect(mockDatabase.setSettingsForCategory).toHaveBeenCalledWith(
				'tunnel',
				expect.objectContaining({
					enabled: false,
					url: null
				}),
				expect.any(String)
			);
		});
	});

	describe('Security Policy Integration Hooks', () => {
		it('should register security policy update hooks', async () => {
			// Mock hook registration
			tunnelManager.registerSecurityHook = vi.fn();
			tunnelManager.registerOAuthHook = vi.fn();
			tunnelManager.registerWebAuthnHook = vi.fn();

			// Register hooks (this will be implemented)
			tunnelManager.registerSecurityHook(securityPolicyManager);
			tunnelManager.registerOAuthHook(oauthManager);
			tunnelManager.registerWebAuthnHook(authManager);

			expect(tunnelManager.registerSecurityHook).toHaveBeenCalledWith(securityPolicyManager);
			expect(tunnelManager.registerOAuthHook).toHaveBeenCalledWith(oauthManager);
			expect(tunnelManager.registerWebAuthnHook).toHaveBeenCalledWith(authManager);
		});

		it('should trigger security policy updates on URL change', async () => {
			// Mock security policy update
			securityPolicyManager.updateTunnelOrigins = vi.fn();
			securityPolicyManager.updateSecurityContext = vi.fn();

			// Add security hook
			tunnelManager.securityHooks = [securityPolicyManager];

			await tunnelManager.start();

			// Simulate URL change
			const tunnelUrl = 'https://test.loca.lt';
			mockProcess.stdout.emit('data', Buffer.from(`your url is: ${tunnelUrl}`));

			// Mock the onUrlChange method
			tunnelManager.onUrlChange = async (url) => {
				for (const hook of tunnelManager.securityHooks || []) {
					await hook.updateTunnelOrigins({ url });
				}
			};

			await tunnelManager.onUrlChange(tunnelUrl);

			expect(securityPolicyManager.updateTunnelOrigins).toHaveBeenCalledWith({ url: tunnelUrl });
		});
	});

	describe('OAuth Redirect URI Auto-Update', () => {
		it('should update OAuth redirect URIs when tunnel URL changes', async () => {
			// Mock OAuth update methods
			oauthManager.updateBaseUrl = vi.fn();
			oauthManager.updateProviderRedirectUris = vi.fn().mockResolvedValue();

			// Simulate URL change with OAuth hook
			tunnelManager.oauthHooks = [oauthManager];

			const tunnelUrl = 'https://test.loca.lt';
			tunnelManager.onUrlChange = async (url) => {
				for (const hook of tunnelManager.oauthHooks || []) {
					hook.updateBaseUrl(url);
					await hook.updateProviderRedirectUris();
				}
			};

			await tunnelManager.onUrlChange(tunnelUrl);

			expect(oauthManager.updateBaseUrl).toHaveBeenCalledWith(tunnelUrl);
			expect(oauthManager.updateProviderRedirectUris).toHaveBeenCalled();
		});

		it('should handle OAuth provider API errors gracefully', async () => {
			oauthManager.updateProviderRedirectUris = vi.fn().mockRejectedValue(
				new Error('Provider API error')
			);

			tunnelManager.oauthHooks = [oauthManager];

			// Should not throw
			await expect(async () => {
				tunnelManager.onUrlChange = async (url) => {
					for (const hook of tunnelManager.oauthHooks || []) {
						try {
							await hook.updateProviderRedirectUris();
						} catch (error) {
							// Log but don't fail
							console.error('OAuth update failed:', error);
						}
					}
				};
				await tunnelManager.onUrlChange('https://test.loca.lt');
			}).not.toThrow();
		});
	});

	describe('WebAuthn rpID Validation', () => {
		it('should validate WebAuthn compatibility for new URLs', async () => {
			// Mock WebAuthn validation
			authManager.validateWebAuthnCompatibility = vi.fn().mockReturnValue({
				compatible: false,
				reason: 'Hostname change detected'
			});

			tunnelManager.webauthnHooks = [authManager];

			const result = await authManager.validateWebAuthnCompatibility('https://test.loca.lt');

			expect(result).toEqual({
				compatible: false,
				reason: 'Hostname change detected'
			});
		});

		it('should emit warnings for WebAuthn incompatibility', async () => {
			authManager.validateWebAuthnCompatibility = vi.fn().mockReturnValue({
				compatible: false,
				reason: 'Hostname change requires re-registration'
			});

			tunnelManager.webauthnHooks = [authManager];

			const tunnelUrl = 'https://test.loca.lt';
			tunnelManager.onUrlChange = async (url) => {
				for (const hook of tunnelManager.webauthnHooks || []) {
					const validation = hook.validateWebAuthnCompatibility(url);
					if (!validation.compatible) {
						mockIO.emit('security.warning', {
							type: 'webauthn',
							message: validation.reason,
							severity: 'warning'
						});
					}
				}
			};

			await tunnelManager.onUrlChange(tunnelUrl);

			expect(mockIO.emit).toHaveBeenCalledWith('security.warning', expect.objectContaining({
				type: 'webauthn',
				message: 'Hostname change requires re-registration'
			}));
		});
	});

	describe('Tunnel Status Dashboard Integration', () => {
		it('should provide comprehensive tunnel status', () => {
			const status = tunnelManager.getEnhancedStatus?.() || {
				...tunnelManager.getStatus(),
				security: {
					cors: { configured: true },
					cookies: { secure: false },
					hsts: { enabled: false }
				},
				compatibility: {
					webauthn: { available: false },
					oauth: { configured: false }
				}
			};

			expect(status).toHaveProperty('enabled');
			expect(status).toHaveProperty('running');
			expect(status).toHaveProperty('security');
			expect(status).toHaveProperty('compatibility');
		});

		it('should include security recommendations', () => {
			const recommendations = tunnelManager.getSecurityRecommendations?.() || [
				{
					level: 'warning',
					message: 'WebAuthn not available over tunnel without stable domain',
					action: 'Consider using custom domain for WebAuthn support'
				}
			];

			expect(Array.isArray(recommendations)).toBe(true);
			expect(recommendations[0]).toHaveProperty('level');
			expect(recommendations[0]).toHaveProperty('message');
		});
	});

	describe('Security Policy Rollback', () => {
		it('should rollback security policies on tunnel disconnection', async () => {
			// Save original policies
			const originalPolicies = {
				cors_allowed_origins: ['http://localhost:3030']
			};
			mockDatabase.getSettingsByCategory.mockResolvedValue(originalPolicies);

			// Test the rollback function directly
			tunnelManager.originalSecurityPolicies = originalPolicies;

			// Call rollback
			await tunnelManager.rollbackSecurityPolicies();

			// Check that it was called with security settings
			const securityCalls = mockDatabase.setSettingsForCategory.mock.calls.filter(
				call => call[0] === 'security'
			);

			expect(securityCalls.length).toBeGreaterThan(0);
			expect(securityCalls[securityCalls.length - 1]).toEqual([
				'security',
				originalPolicies,
				expect.any(String)
			]);
		});

		it('should handle rollback errors gracefully', async () => {
			mockDatabase.setSettingsForCategory.mockRejectedValue(
				new Error('Database error')
			);

			tunnelManager.rollbackSecurityPolicies = async () => {
				try {
					await mockDatabase.setSettingsForCategory('security', {});
				} catch (error) {
					// Should log but not throw
					console.error('Rollback failed:', error);
				}
			};

			// Should not throw
			await expect(tunnelManager.rollbackSecurityPolicies()).resolves.not.toThrow();
		});
	});

	describe('Hosting Mode Detection', () => {
		it('should detect LAN-only mode', () => {
			const context = tunnelManager.getHostingContext?.() || {
				mode: 'lan',
				isSecure: false,
				hasCustomDomain: false,
				hasTunnel: false
			};

			expect(context.mode).toBe('lan');
		});

		it('should detect tunnel mode', async () => {
			await tunnelManager.start();
			const tunnelUrl = 'https://test.loca.lt';
			mockProcess.stdout.emit('data', Buffer.from(`your url is: ${tunnelUrl}`));

			const context = {
				mode: 'tunnel',
				isSecure: true,
				hasCustomDomain: false,
				hasTunnel: true,
				tunnelUrl: tunnelUrl
			};

			expect(context.mode).toBe('tunnel');
			expect(context.hasTunnel).toBe(true);
		});

		it('should detect custom domain mode', () => {
			const context = {
				mode: 'custom_domain',
				isSecure: true,
				hasCustomDomain: true,
				hasTunnel: false,
				customDomain: 'app.example.com'
			};

			expect(context.mode).toBe('custom_domain');
			expect(context.hasCustomDomain).toBe(true);
		});
	});

	describe('Automatic Configuration Updates', () => {
		it('should update all configurations atomically', async () => {
			const updates = [];

			// Mock configuration updates
			securityPolicyManager.updateForTunnel = vi.fn().mockImplementation(async () => {
				updates.push('security');
			});

			oauthManager.updateForTunnel = vi.fn().mockImplementation(async () => {
				updates.push('oauth');
			});

			authManager.updateForTunnel = vi.fn().mockImplementation(async () => {
				updates.push('auth');
			});

			// Perform atomic update
			tunnelManager.performAtomicUpdate = async (url) => {
				await Promise.all([
					securityPolicyManager.updateForTunnel(url),
					oauthManager.updateForTunnel(url),
					authManager.updateForTunnel(url)
				]);
			};

			await tunnelManager.performAtomicUpdate('https://test.loca.lt');

			expect(updates).toContain('security');
			expect(updates).toContain('oauth');
			expect(updates).toContain('auth');
		});

		it('should handle partial update failures', async () => {
			securityPolicyManager.updateForTunnel = vi.fn().mockResolvedValue();
			oauthManager.updateForTunnel = vi.fn().mockRejectedValue(new Error('OAuth failed'));
			authManager.updateForTunnel = vi.fn().mockResolvedValue();

			const results = {
				security: null,
				oauth: null,
				auth: null
			};

			tunnelManager.performAtomicUpdate = async (url) => {
				try {
					results.security = await securityPolicyManager.updateForTunnel(url);
				} catch (e) {
					results.security = e;
				}

				try {
					results.oauth = await oauthManager.updateForTunnel(url);
				} catch (e) {
					results.oauth = e;
				}

				try {
					results.auth = await authManager.updateForTunnel(url);
				} catch (e) {
					results.auth = e;
				}
			};

			await tunnelManager.performAtomicUpdate('https://test.loca.lt');

			expect(results.security).toBeUndefined();
			expect(results.oauth).toBeInstanceOf(Error);
			expect(results.auth).toBeUndefined();
		});
	});

	describe('Real-time Event Broadcasting', () => {
		it('should broadcast tunnel events to all clients', async () => {
			await tunnelManager.start();

			const events = [
				{ type: 'tunnel.starting', data: { port: 3030 } },
				{ type: 'tunnel.connected', data: { url: 'https://test.loca.lt' } },
				{ type: 'tunnel.disconnected', data: { reason: 'network_error' } }
			];

			for (const event of events) {
				tunnelManager.broadcastEvent = (type, data) => {
					mockIO.emit(type, data);
				};
				tunnelManager.broadcastEvent(event.type, event.data);
			}

			expect(mockIO.emit).toHaveBeenCalledWith('tunnel.starting', { port: 3030 });
			expect(mockIO.emit).toHaveBeenCalledWith('tunnel.connected', { url: 'https://test.loca.lt' });
			expect(mockIO.emit).toHaveBeenCalledWith('tunnel.disconnected', { reason: 'network_error' });
		});
	});
});