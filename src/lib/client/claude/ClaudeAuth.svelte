<script>
	import { onMount, onDestroy } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	import LoadingSpinner from '$lib/client/shared/components/LoadingSpinner.svelte';
	import ErrorDisplay from '$lib/client/shared/components/ErrorDisplay.svelte';
	import IconCloudCheck from '../shared/components/Icons/IconCloudCheck.svelte';
	import IconCloudX from '../shared/components/Icons/IconCloudX.svelte';
	import IconKey from '../shared/components/Icons/IconKey.svelte';
	import IconExternalLink from '../shared/components/Icons/IconExternalLink.svelte';
	import { io } from 'socket.io-client';
	import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';
	import { STORAGE_CONFIG } from '$lib/shared/constants.js';
	import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';

	/**
	 * Claude Authentication Component
	 * Manages Claude (Anthropic) API authentication using OAuth flow
	 */

	// Authentication state
	let isAuthenticated = $state(false);
	let authStatus = $state('checking'); // 'checking' | 'authenticated' | 'not_authenticated' | 'error'
	let authError = $state('');
	let loading = $state(false);

	// OAuth flow state (WebSocket-based)
	let oauthUrl = $state('');
	let authCode = $state('');
	let showCodeInput = $state(false);
	// removed unused sessionId (was retained for API parity; not used in WS flow)
	let socket = $state();

	// Manual API key state
	let showManualAuth = $state(false);
	let apiKey = $state('');

	// Status messages
	let statusMessage = $state('');

	// Service container for configuration
	let container = null;
	let socketUrl = '';

	// Try to get service container for configuration
	try {
		container = useServiceContainer();
		socketUrl =
			container.config.socketUrl || (typeof window !== 'undefined' ? window.location.origin : '');
	} catch (e) {
		// Fallback if container is not available (not in context)
		socketUrl = typeof window !== 'undefined' ? window.location.origin : '';
	}

	onMount(async () => {
		await checkAuthStatus();

		// Initialize a general Socket.IO connection for auth events
		// Use configured URL or current origin for socket connection to support remote access
		socket = io(socketUrl, { autoConnect: true, reconnection: true });

		const handleAuthUrl = (payload) => {
			try {
				const url = String(payload?.url || '');
				oauthUrl = url;
				showCodeInput = true;
				statusMessage = payload?.instructions || 'Open the link, then paste the code here.';
				// Open OAuth URL in a new tab for convenience
				if (url) {
					try {
						window.open(url, '_blank', 'width=600,height=700');
					} catch {}
				}
			} catch (e) {
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

		socket.on(SOCKET_EVENTS.CLAUDE_AUTH_URL, handleAuthUrl);
		socket.on(SOCKET_EVENTS.CLAUDE_AUTH_COMPLETE, handleAuthComplete);
		socket.on(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, handleAuthError);

		onDestroy(() => {
			if (socket) {
				try {
					socket.off(SOCKET_EVENTS.CLAUDE_AUTH_URL, handleAuthUrl);
					socket.off(SOCKET_EVENTS.CLAUDE_AUTH_COMPLETE, handleAuthComplete);
					socket.off(SOCKET_EVENTS.CLAUDE_AUTH_ERROR, handleAuthError);
				} catch {}
				try {
					socket.disconnect();
				} catch {}
			}
		});
	});

	// Check current authentication status
	async function checkAuthStatus() {
		authStatus = 'checking';
		try {
			const response = await fetch('/api/claude/auth');
			const data = await response.json();

			if (response.ok) {
				isAuthenticated = data.authenticated;
				authStatus = data.authenticated ? 'authenticated' : 'not_authenticated';
				if (data.hint && !data.authenticated) {
					statusMessage = data.hint;
				}
			} else {
				authStatus = 'error';
				authError = data.error || 'Failed to check authentication status';
			}
		} catch (error) {
			console.error('Auth check failed:', error);
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
				// Use configured URL or current origin for socket connection to support remote access
				socket = io(socketUrl, { autoConnect: true, reconnection: true });
			}
			const key = localStorage.getItem(STORAGE_CONFIG.AUTH_TOKEN_KEY) || 'testkey12345';

			// Ensure socket is connected before emitting
			if (!socket.connected) {
				await new Promise((resolve) => {
					const onConnect = () => {
						try {
							socket.off('connect', onConnect);
						} catch {}
						// authenticate this socket context for consistency
						try {
							const authKey = key;
							socket.emit('auth', authKey, () => {});
						} catch {}
						resolve();
					};
					socket.on('connect', onConnect);
					// If already connecting, wait; otherwise, force connect
					if (!socket.connecting) socket.connect();
				});
			}

			socket.emit(SOCKET_EVENTS.CLAUDE_AUTH_START, { key });
			statusMessage = 'Requesting authorization URL...';
		} catch (error) {
			console.error('OAuth setup (WS) failed:', error);
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
		try {
			const key = localStorage.getItem(STORAGE_CONFIG.AUTH_TOKEN_KEY) || 'testkey12345';
			socket?.emit(SOCKET_EVENTS.CLAUDE_AUTH_CODE, { key, code: authCode.trim() });
			statusMessage = 'Submitting authorization code...';
		} catch (error) {
			console.error('Auth completion (WS) failed:', error);
			authError = 'Failed to submit authorization code';
		} finally {
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
				headers: { 'Content-Type': 'application/json' },
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
		} catch (error) {
			console.error('API key auth failed:', error);
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
				method: 'DELETE'
			});

			if (response.ok) {
				statusMessage = 'Signed out successfully';
				await checkAuthStatus();
			} else {
				const data = await response.json();
				authError = data.error || 'Failed to sign out';
			}
		} catch (error) {
			console.error('Sign out failed:', error);
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
</script>

<div class="claude-auth">
	<header class="panel-header">
		<h3 class="panel-title">Claude Authentication</h3>
		<p class="setting-description">
			Connect your Claude (Anthropic) account to enable AI-powered coding sessions.
		</p>
	</header>

	<div class="auth-content">
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
								If the popup was blocked, <a
									href={oauthUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="text-primary">click here to open manually</a
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
			<!-- Error State -->
			<ErrorDisplay error={authError} />
			<Button onclick={checkAuthStatus} variant="ghost" size="small">Retry</Button>
		{/if}

		<!-- Status Messages -->
		{#if statusMessage}
			<div class="status-message success">
				{statusMessage}
			</div>
		{/if}

		{#if authError}
			<div class="status-message error">
				{authError}
			</div>
		{/if}
	</div>
</div>
