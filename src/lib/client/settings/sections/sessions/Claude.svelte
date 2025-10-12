<script>
	import { onMount, onDestroy } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	import LoadingSpinner from '$lib/client/shared/components/LoadingSpinner.svelte';
	import ErrorDisplay from '$lib/client/shared/components/ErrorDisplay.svelte';
	import IconCloudCheck from '$lib/client/shared/components/Icons/IconCloudCheck.svelte';
	import IconCloudX from '$lib/client/shared/components/Icons/IconCloudX.svelte';
	import IconKey from '$lib/client/shared/components/Icons/IconKey.svelte';
	import IconExternalLink from '$lib/client/shared/components/Icons/IconExternalLink.svelte';
	import ClaudeSettings from '$lib/client/claude/ClaudeSettings.svelte';
	import { io } from 'socket.io-client';
	import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';
	import { STORAGE_CONFIG } from '$lib/shared/constants.js';
	import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { getAuthHeaders } from '$lib/shared/api-helpers.js';
	import { settingsService } from '$lib/client/shared/services/SettingsService.svelte.js';

	/**
	 * Claude Settings Component
	 * Combines authentication and default settings for Claude sessions
	 */

	// Authentication state
	let authStatus = $state('checking'); // 'checking' | 'authenticated' | 'not_authenticated' | 'error'
	let authError = $state('');
	let loading = $state(false);

	// OAuth flow state (WebSocket-based)
	let oauthUrl = $state('');
	let authCode = $state('');
	let showCodeInput = $state(false);
	let socket = $state();

	// Manual API key state
	let showManualAuth = $state(false);
	let apiKey = $state('');

	// Status messages
	let statusMessage = $state('');

	// Service container for configuration
	let socketUrl = '';

	// Settings state (for Defaults section)
	let settings = $state({});
	let saveStatus = $state('');
	let saving = $state(false);

	// Try to get service container for configuration
	try {
		const container = useServiceContainer();
		socketUrl =
			container.config.socketUrl || (typeof window !== 'undefined' ? window.location.origin : '');
	} catch (_e) {
		// Fallback if container is not available (not in context)
		socketUrl = typeof window !== 'undefined' ? window.location.origin : '';
	}

	// === Authentication Handlers ===

	const handleAuthUrl = (payload) => {
		try {
			const url = String(payload?.url || '');
			oauthUrl = url;
			showCodeInput = true;
			statusMessage = payload?.instructions || 'Open the link, then paste the code here.';
			loading = false; // Stop loading spinner
			// Open OAuth URL in a new tab for convenience
			if (url) {
				try {
					window.open(url, '_blank', 'width=600,height=700');
				} catch {
					// Popup blocked - user can still click the link
				}
			}
		} catch (_e) {
			authError = 'Failed to start authentication.';
		}
	};

	const handleAuthComplete = () => {
		showCodeInput = false;
		authCode = '';
		oauthUrl = '';
		statusMessage = 'Authentication completed successfully!';
		checkAuthStatus();
	};

	const handleAuthError = (payload) => {
		authError = payload?.error || 'Authentication failed.';
		showCodeInput = true; // allow retry by keeping input visible
	};

	onMount(async () => {
		await checkAuthStatus();

		// Initialize a general Socket.IO connection for auth events
		// CRITICAL: Use autoConnect: false and register listeners first to prevent race condition
		socket = io(socketUrl, { autoConnect: false, reconnection: true });

		socket.on(SOCKET_EVENTS.CLAUDE_AUTH_URL, handleAuthUrl);
		socket.on(SOCKET_EVENTS.CLAUDE_AUTH_COMPLETE, handleAuthComplete);
		socket.on(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, handleAuthError);

		// Connect after listeners are registered
		socket.connect();

		// Load Claude settings
		if (!settingsService.isLoaded) {
			await settingsService.loadServerSettings();
		}
		updateSettingsFromService();
	});

	onDestroy(() => {
		if (socket) {
			try {
				socket.off(SOCKET_EVENTS.CLAUDE_AUTH_URL, handleAuthUrl);
				socket.off(SOCKET_EVENTS.CLAUDE_AUTH_COMPLETE, handleAuthComplete);
				socket.off(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, handleAuthError);
			} catch {
				// Event listener cleanup failed - non-critical
			}
			try {
				socket.disconnect();
			} catch {
				// Socket disconnect failed - non-critical
			}
		}
	});

	// Check current authentication status
	async function checkAuthStatus() {
		authStatus = 'checking';
		try {
			const response = await fetch('/api/claude/auth', {
				headers: getAuthHeaders()
			});
			const data = await response.json();

			if (response.ok) {
				authStatus = data.authenticated ? 'authenticated' : 'not_authenticated';
				if (data.hint && !data.authenticated) {
					statusMessage = data.hint;
				}
			} else {
				authStatus = 'error';
				authError = data.error || 'Failed to check authentication status';
			}
		} catch (_error) {
			authStatus = 'error';
			authError = 'Unable to connect to authentication service';
		}
	}

	// Start OAuth authentication flow (WebSocket)
	async function startOAuthFlow() {
		if (loading) return;
		loading = true;
		authError = '';
		statusMessage = '';
		try {
			if (!socket) {
				// CRITICAL: Create socket with autoConnect: false to prevent race condition
				// Register listeners BEFORE connecting to ensure no events are missed
				socket = io(socketUrl, { autoConnect: false, reconnection: true });

				// Register event listeners immediately after socket creation
				// This prevents race condition where events might be emitted before listeners are attached
				socket.on(SOCKET_EVENTS.CLAUDE_AUTH_URL, handleAuthUrl);
				socket.on(SOCKET_EVENTS.CLAUDE_AUTH_COMPLETE, handleAuthComplete);
				socket.on(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, handleAuthError);

				// NOW connect after listeners are ready
				socket.connect();
			}

			const key = localStorage.getItem(STORAGE_CONFIG.AUTH_TOKEN_KEY);

			// Ensure socket is connected before emitting
			if (!socket.connected) {
				await new Promise((resolve) => {
					const onConnect = () => {
						try {
							socket.off('connect', onConnect);
						} catch {
							// Event listener removal failed - non-critical
						}
						// authenticate this socket context for consistency
						try {
							const authKey = key;
							socket.emit('auth', authKey, () => {
								// Auth callback - intentionally empty
							});
						} catch {
							// Socket auth failed - will retry on next connection
						}
						resolve();
					};
					socket.on('connect', onConnect);
					// If already connecting, wait; otherwise, force connect
					if (!socket.connecting) socket.connect();
				});
			}

			// Fix: Send { apiKey } instead of { key } to match server expectations
			// Server expects { apiKey, terminalKey } in socket-setup.js lines 375-376

			statusMessage = 'Requesting authorization URL...';

			// BUG FIX #2: Add timeout protection to prevent infinite waiting
			const timeoutId = setTimeout(() => {
				if (loading && !oauthUrl) {
					loading = false;
					authError = 'Authentication request timed out. Please try again.';
					statusMessage = '';
				}
			}, 30000); // 30 second timeout

			// BUG FIX #1: Add callback handler to catch server errors
			socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_START, { apiKey: key }, (response) => {
				clearTimeout(timeoutId);
				if (response && !response.success) {
					loading = false;
					// Server might send 'error' or 'message' field
					authError = response.error || response.message || 'Failed to start authentication';
					statusMessage = '';
				}
			});
		} catch (_error) {
			authError = 'Failed to start authentication process';
		} finally {
			loading = false;
		}
	}

	// Complete OAuth authentication with authorization code (WebSocket)
	async function completeAuth() {
		if (!authCode.trim() || loading) return;
		loading = true;
		authError = '';
		statusMessage = '';

		// Add timeout protection - UI shouldn't hang if server never responds
		const timeoutId = setTimeout(() => {
			if (loading) {
				loading = false;
				authError = 'Code submission timed out. Please try again.';
				statusMessage = '';
			}
		}, 30000); // 30 second timeout

		try {
			// Fix: Send { apiKey, code } instead of { key, code }
			// Server expects apiKey in socket-setup.js
			const key = localStorage.getItem(STORAGE_CONFIG.AUTH_TOKEN_KEY);
			socket?.emit(
				SOCKET_EVENTS.CLAUDE_AUTH_CODE,
				{ apiKey: key, code: authCode.trim() },
				(response) => {
					clearTimeout(timeoutId);
					if (response && !response.success) {
						loading = false;
						authError = response.error || response.message || 'Failed to submit code';
						statusMessage = '';
					}
					// On success, handleAuthComplete will be called via socket event
				}
			);
			statusMessage = 'Submitting authorization code...';
		} catch (_error) {
			clearTimeout(timeoutId);
			authError = 'Failed to submit authorization code';
			loading = false;
		}
	}

	// Manual API key authentication (fallback)
	async function authenticateWithApiKey() {
		if (!apiKey.trim() || loading) return;

		loading = true;
		authError = '';
		statusMessage = '';

		try {
			const response = await fetch('/api/claude/auth', {
				method: 'POST',
				headers: getAuthHeaders(),
				body: JSON.stringify({
					apiKey: apiKey.trim()
				})
			});

			const data = await response.json();

			if (response.ok && data.success) {
				statusMessage = 'API key authentication successful!';
				apiKey = '';
				showManualAuth = false;
				await checkAuthStatus();
			} else {
				authError = data.error || 'Invalid API key';
			}
		} catch (_error) {
			authError = 'Failed to authenticate with API key';
		} finally {
			loading = false;
		}
	}

	// Sign out
	async function signOut() {
		if (loading) return;

		loading = true;
		authError = '';
		statusMessage = '';

		try {
			const response = await fetch('/api/claude/auth', {
				method: 'DELETE',
				headers: getAuthHeaders()
			});

			if (response.ok) {
				statusMessage = 'Signed out successfully';
				await checkAuthStatus();
			} else {
				const data = await response.json();
				authError = data.error || 'Failed to sign out';
			}
		} catch (_error) {
			authError = 'Failed to sign out';
		} finally {
			loading = false;
		}
	}

	// Cancel current flow
	function cancelFlow() {
		showCodeInput = false;
		showManualAuth = false;
		authCode = '';
		apiKey = '';
		oauthUrl = '';
		authError = '';
		statusMessage = '';
	}

	// === Settings Handlers ===

	// Load settings from the service into our local state
	function updateSettingsFromService() {
		settings = {
			model: settingsService.get('claude.model', ''),
			customSystemPrompt: settingsService.get('claude.customSystemPrompt', ''),
			appendSystemPrompt: settingsService.get('claude.appendSystemPrompt', ''),
			maxTurns: settingsService.get('claude.maxTurns', null),
			maxThinkingTokens: settingsService.get('claude.maxThinkingTokens', null),
			fallbackModel: settingsService.get('claude.fallbackModel', ''),
			includePartialMessages: settingsService.get('claude.includePartialMessages', false),
			continueConversation: settingsService.get('claude.continueConversation', false),
			permissionMode: settingsService.get('claude.permissionMode', 'default'),
			executable: settingsService.get('claude.executable', 'auto'),
			executableArgs: settingsService.get('claude.executableArgs', ''),
			allowedTools: settingsService.get('claude.allowedTools', ''),
			disallowedTools: settingsService.get('claude.disallowedTools', ''),
			additionalDirectories: settingsService.get('claude.additionalDirectories', ''),
			strictMcpConfig: settingsService.get('claude.strictMcpConfig', false)
		};
	}

	// Save settings using the new service
	async function saveSettings() {
		if (saving) return;

		saving = true;
		saveStatus = '';

		try {
			// Save all Claude settings as client overrides (localStorage)
			Object.entries(settings).forEach(([key, value]) => {
				settingsService.setClientOverride(`claude.${key}`, value);
			});

			saveStatus = 'Claude settings saved successfully';
			setTimeout(() => {
				saveStatus = '';
			}, 3000);
		} catch (_error) {
			saveStatus = 'Failed to save Claude settings';
		} finally {
			saving = false;
		}
	}

	// Reset to server defaults
	async function resetToDefaults() {
		settingsService.resetClientOverridesForCategory('claude');
		updateSettingsFromService();

		saveStatus = 'Claude settings reset to defaults';
		setTimeout(() => {
			saveStatus = '';
		}, 3000);
	}
</script>

<div class="claude-settings">
	<div class="section-header">
		<h3>CLAUDE</h3>
		<p class="section-description">
			Connect your Claude (Anthropic) account and configure default settings for AI-powered coding
			sessions.
		</p>
	</div>
	<!-- Authentication Section -->
	<h4>AUTHENTICATION</h4>
	<p class="subsection-description">
		Connect your Claude account to enable AI-powered features and coding assistance.
	</p>
	{#if authStatus === 'checking'}
		<div class="status-card status-card--checking">
			<LoadingSpinner size="small" />
			<span>Checking authentication status...</span>
		</div>
	{:else if authStatus === 'authenticated'}
		<!-- Authenticated State -->
		<div class="status-card status-card--authenticated">
			<IconCloudCheck size={24} />
			<div class="status-info">
				<h4>Connected to Claude</h4>
				<p>Your Claude account is authenticated and ready to use.</p>
			</div>
			<Button onclick={signOut} variant="ghost" size="small" disabled={loading}>Sign Out</Button>
		</div>
	{:else if authStatus === 'not_authenticated'}
		<!-- Not Authenticated State -->
		<div class="status-card status-card--not-authenticated">
			<IconCloudX size={24} />
			<div class="status-info">
				<h4>Claude Not Connected</h4>
				<p>Connect your Claude account to access AI-powered features.</p>
				{#if statusMessage}
					<p class="status-hint">{statusMessage}</p>
				{/if}
			</div>
		</div>

		{#if !showCodeInput && !showManualAuth}
			<!-- Authentication Options -->
			<div class="flow-setup">
				<div class="flow-steps">
					<div class="flow-step">
						<div class="step-number">1</div>
						<div class="step-content">
							<h5 class="step-title">Recommended: OAuth Authentication</h5>
							<p class="step-description">
								Secure authentication through Anthropic's official OAuth flow.
							</p>
							<Button onclick={startOAuthFlow} variant="primary" disabled={loading} {loading}>
								<IconExternalLink size={16} />
								Login with Claude
							</Button>
						</div>
					</div>

					<div class="flex-center gap-2 m-2">
						<div class="flex-grow bg-surface-border" style="height: 1px;"></div>
						<span class="text-muted font-mono text-sm">or</span>
						<div class="flex-grow bg-surface-border" style="height: 1px;"></div>
					</div>

					<div class="flow-step">
						<div class="step-number">2</div>
						<div class="step-content">
							<h5 class="step-title">Manual: API Key</h5>
							<p class="step-description">Enter your Claude API key directly (less secure).</p>
							<Button onclick={() => (showManualAuth = true)} variant="ghost" size="small">
								<IconKey size={16} />
								Use API Key
							</Button>
						</div>
					</div>
				</div>
			</div>
		{:else if showCodeInput}
			<!-- OAuth Code Input -->
			<div class="flow-setup">
				<h4 class="step-title">Complete Authentication</h4>
				<p class="step-description">
					After authorizing in the popup window, paste the authorization code below:
				</p>

				<div class="form-wrapper">
					<Input
						bind:value={authCode}
						placeholder="Paste authorization code here"
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
					/>
				</div>

				<div class="flow-actions">
					<Button onclick={cancelFlow} variant="ghost" size="small">Cancel</Button>
					<Button
						onclick={completeAuth}
						variant="primary"
						disabled={!authCode.trim() || loading}
						{loading}
					>
						Complete Authentication
					</Button>
				</div>

				{#if oauthUrl}
					<div class="status-message">
						<p>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							If the popup was blocked,
							<a href={oauthUrl} target="_blank" rel="noopener noreferrer" class="text-primary"
								>click here to open manually</a
							>.
						</p>
					</div>
				{/if}
			</div>
		{:else if showManualAuth}
			<!-- Manual API Key Input -->
			<div class="flow-setup">
				<h4 class="step-title">API Key Authentication</h4>
				<p class="step-description">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					Enter your Claude API key. You can find this in your
					<a
						href="https://console.anthropic.com/"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary">Anthropic Console</a
					>.
				</p>

				<div class="form-wrapper">
					<Input
						bind:value={apiKey}
						type="password"
						placeholder="sk-ant-..."
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
					/>
				</div>

				<div class="flow-actions">
					<Button onclick={cancelFlow} variant="ghost" size="small">Cancel</Button>
					<Button
						onclick={authenticateWithApiKey}
						variant="primary"
						disabled={!apiKey.trim() || loading}
						{loading}
					>
						Authenticate
					</Button>
				</div>
			</div>
		{/if}
	{:else if authStatus === 'error'}
		<ErrorDisplay message={authError} />
	{/if}

	{#if authError && authStatus !== 'error'}
		<ErrorDisplay message={authError} />
	{/if}

	{#if statusMessage && authStatus === 'authenticated'}
		<div class="status-footer" role="status">{statusMessage}</div>
	{/if}

	<!-- Session Defaults Section -->
	<h4>SESSION DEFAULTS</h4>
	<p class="subsection-description">
		Configure default settings for new Claude sessions. These settings will be used as defaults when
		creating new Claude sessions, but can be overridden per session.
	</p>
	<ClaudeSettings bind:settings mode="global" />

	<!-- Settings Footer -->
	<footer class="settings-footer">
		<div
			class="settings-footer__status"
			class:settings-footer__status--success={saveStatus.includes('success')}
			class:settings-footer__status--error={saveStatus.includes('Failed')}
		>
			{saveStatus}
		</div>
		<div class="settings-footer__actions">
			<Button onclick={resetToDefaults} variant="ghost" size="small" disabled={saving}>
				Reset Defaults
			</Button>
			<Button
				onclick={saveSettings}
				variant="primary"
				size="small"
				disabled={saving}
				loading={saving}
			>
				{saving ? 'Saving...' : 'Save Settings'}
			</Button>
		</div>
	</footer>
</div>

<style>
	.status-card {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		border: 1px solid var(--primary-glow-20);
		box-shadow: 0 0 20px var(--primary-glow-10);
	}

	.status-card--checking {
		background: color-mix(in oklab, var(--text) 2%, transparent);
	}

	.status-card--authenticated {
		background: linear-gradient(135deg, var(--primary-glow-15), var(--primary-glow));
	}

	.status-card--not-authenticated {
		background: color-mix(in oklab, var(--text) 2%, transparent);
	}

	.status-info h4 {
		margin: 0 0 var(--space-1) 0;
		font-family: var(--font-mono);
		font-size: 1.1rem;
	}

	.status-info p {
		margin: 0;
		color: var(--muted);
	}

	.status-hint {
		color: var(--primary-bright);
		margin-top: var(--space-2);
	}

	.flow-setup {
		background: color-mix(in oklab, var(--text) 2%, transparent);
		border: 1px solid var(--primary-glow-15);
		border-radius: var(--radius-lg);
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.flow-steps {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.flow-step {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}

	.step-number {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-full);
		background: var(--primary-glow-15);
		color: var(--primary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-family: var(--font-mono);
	}

	.step-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.step-title {
		margin: 0;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.95rem;
	}

	.step-description {
		margin: 0;
		color: var(--muted);
		font-size: 0.9rem;
	}

	.form-wrapper {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.flow-actions {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.status-message {
		padding: var(--space-3);
		background: color-mix(in oklab, var(--text) 2%, transparent);
		border-radius: var(--radius);
		border: 1px solid var(--primary-glow-15);
	}

	.status-footer {
		margin-top: auto;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--primary);
	}

	@media (max-width: 768px) {
		.flow-setup {
			padding: var(--space-4);
		}

		.flow-actions {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
