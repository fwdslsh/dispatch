<script>
	import { io } from 'socket.io-client';
	import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';
	import Button from '$lib/client/shared/components/Button.svelte';
	import FormSection from '$lib/client/shared/components/FormSection.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	import LoadingSpinner from '$lib/client/shared/components/LoadingSpinner.svelte';
	import StatusBadge from '$lib/client/shared/components/StatusBadge.svelte';
	import InfoBox from '$lib/client/shared/components/InfoBox.svelte';

	/**
	 * Tunnels Settings Component
	 * Combines LocalTunnel and VS Code Remote Tunnel controls
	 */

	// === LocalTunnel State ===
	let localSocket = null;
	let localTunnelStatus = $state({
		enabled: false,
		running: false,
		url: null,
		port:
			typeof window !== 'undefined'
				? window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
				: null,
		subdomain: ''
	});
	let localIsLoading = $state(false);
	let localError = $state(null);
	let subdomainInput = $state('');
	let isUpdatingConfig = $state(false);

	// === VS Code Tunnel State ===
	let vscodeSocket = null;
	let vscodeTunnelStatus = $state({
		running: false,
		state: null
	});
	let vscodeIsLoading = $state(false);
	let vscodeError = $state(null);
	let nameInput = $state('');
	let deviceLoginUrl = $state('');

	// === LocalTunnel Functions ===

	function connectLocalSocket() {
		if (localSocket) return;

		const socketUrl = typeof window !== 'undefined' ? window.location.origin : '';
		localSocket = io(socketUrl, { transports: ['websocket', 'polling'] });

		localSocket.on(SOCKET_EVENTS.CONNECTION, () => {
			// Authenticate via session cookie before making requests
			localSocket.emit('client:hello', {}, (response) => {
				if (response?.success) {
					console.log('[Tunnels] LocalTunnel socket authenticated');
					fetchLocalTunnelStatus();
				} else {
					console.error('[Tunnels] LocalTunnel authentication failed:', response?.error);
					localError = 'Authentication failed - please refresh the page';
				}
			});
		});

		// Listen for tunnel status broadcasts
		localSocket.on(SOCKET_EVENTS.TUNNEL_STATUS, (status) => {
			localTunnelStatus = status;
			// Update the subdomain input field with current value
			subdomainInput = status.subdomain || '';
		});
	}

	function fetchLocalTunnelStatus() {
		if (!localSocket) return;

		localSocket.emit(SOCKET_EVENTS.TUNNEL_STATUS, (response) => {
			if (response.success) {
				localTunnelStatus = response.status;
				// Update the subdomain input field with current value
				subdomainInput = localTunnelStatus.subdomain || '';
			} else {
				localError = response.error || 'Failed to get tunnel status';
			}
		});
	}

	async function toggleLocalTunnel() {
		if (!localSocket || localIsLoading) return; // Prevent double-clicks during loading

		localIsLoading = true;
		localError = null;

		const event = localTunnelStatus.enabled
			? SOCKET_EVENTS.TUNNEL_STOP
			: SOCKET_EVENTS.TUNNEL_START;

		// Get the current port from window location
		const currentPort =
			window.location.port || (window.location.protocol === 'https:' ? '443' : '80');

		try {
			// Socket.IO authenticates via session cookie in handshake (no explicit auth needed)
			localSocket.emit(event, { port: currentPort }, (response) => {
				localIsLoading = false;
				if (response?.success) {
					localTunnelStatus = response.status;
					localError = null; // Clear any previous errors
				} else {
					localError = response?.error || 'Failed to toggle tunnel';
				}
			});
		} catch (err) {
			localIsLoading = false;
			localError = err.message || 'Failed to toggle tunnel';
		}
	}

	function copyLocalUrlToClipboard() {
		if (localTunnelStatus.url) {
			navigator.clipboard
				.writeText(localTunnelStatus.url)
				.then(() => {
					console.log('Tunnel URL copied to clipboard');
				})
				.catch((err) => {
					console.error('Failed to copy URL:', err);
				});
		}
	}

	async function updateSubdomain() {
		if (!localSocket) return;

		isUpdatingConfig = true;
		localError = null;

		// Socket.IO authenticates via session cookie in handshake (no explicit auth needed)
		localSocket.emit(
			SOCKET_EVENTS.TUNNEL_UPDATE_CONFIG,
			{ subdomain: subdomainInput },
			(response) => {
				isUpdatingConfig = false;
				if (response.success) {
					localTunnelStatus = response.status;
				} else {
					localError = response.error || 'Failed to update subdomain';
				}
			}
		);
	}

	function openLocalTunnelUrl() {
		if (localTunnelStatus.url) {
			window.open(localTunnelStatus.url, '_blank');
		}
	}

	// === VS Code Tunnel Functions ===

	function connectVSCodeSocket() {
		if (vscodeSocket) return;

		const socketUrl = typeof window !== 'undefined' ? window.location.origin : '';
		vscodeSocket = io(socketUrl, { transports: ['websocket', 'polling'] });

		vscodeSocket.on(SOCKET_EVENTS.CONNECTION, () => {
			// Authenticate via session cookie before making requests
			vscodeSocket.emit('client:hello', {}, (response) => {
				if (response?.success) {
					console.log('[Tunnels] VS Code socket authenticated');
					fetchVSCodeTunnelStatus();
				} else {
					console.error('[Tunnels] VS Code authentication failed:', response?.error);
					vscodeError = 'Authentication failed - please refresh the page';
				}
			});
		});

		// Listen for tunnel status broadcasts
		vscodeSocket.on(SOCKET_EVENTS.VSCODE_TUNNEL_STATUS, (status) => {
			vscodeTunnelStatus = status;
			if (status.error) {
				vscodeError = status.error;
			}
		});

		// Listen for device login URL
		vscodeSocket.on(SOCKET_EVENTS.VSCODE_TUNNEL_LOGIN_URL, (data) => {
			deviceLoginUrl = data.url;
		});
	}

	function fetchVSCodeTunnelStatus() {
		if (!vscodeSocket) return;

		vscodeSocket.emit(SOCKET_EVENTS.VSCODE_TUNNEL_STATUS, (response) => {
			if (response.success) {
				vscodeTunnelStatus = response.status;
				if (response.status.error) {
					vscodeError = response.status.error;
				}
			} else {
				vscodeError = response.error || 'Failed to get tunnel status';
			}
		});
	}

	async function startVSCodeTunnel() {
		if (!vscodeSocket || vscodeIsLoading) return; // Prevent double-clicks during loading

		vscodeIsLoading = true;
		vscodeError = null;
		deviceLoginUrl = '';

		const data = {};

		// Add optional parameters if provided
		if (nameInput.trim()) data.name = nameInput.trim();

		try {
			// Socket.IO authenticates via session cookie in handshake (no explicit auth needed)
			vscodeSocket.emit(SOCKET_EVENTS.VSCODE_TUNNEL_START, data, (response) => {
				vscodeIsLoading = false;
				if (response?.success) {
					vscodeTunnelStatus = { running: true, state: response.state };
					vscodeError = null; // Clear any previous errors
				} else {
					vscodeError = response?.error || 'Failed to start tunnel';
				}
			});
		} catch (err) {
			vscodeIsLoading = false;
			vscodeError = err.message || 'Failed to start tunnel';
		}
	}

	async function stopVSCodeTunnel() {
		if (!vscodeSocket || vscodeIsLoading) return; // Prevent double-clicks during loading

		vscodeIsLoading = true;
		vscodeError = null;
		deviceLoginUrl = '';

		try {
			// Socket.IO authenticates via session cookie in handshake (no explicit auth needed)
			vscodeSocket.emit(SOCKET_EVENTS.VSCODE_TUNNEL_STOP, {}, (response) => {
				vscodeIsLoading = false;
				if (response?.success) {
					// Update status from response (backend provides current state)
					vscodeTunnelStatus = response.status;
					vscodeError = null; // Clear any previous errors
				} else {
					vscodeError = response?.error || 'Failed to stop tunnel';
				}
			});
		} catch (err) {
			vscodeIsLoading = false;
			vscodeError = err.message || 'Failed to stop tunnel';
		}
	}

	async function copyVSCodeUrlToClipboard() {
		if (vscodeTunnelStatus.state?.openUrl) {
			try {
				await navigator.clipboard.writeText(vscodeTunnelStatus.state.openUrl);
			} catch (err) {
				console.error('Failed to copy URL:', err);
			}
		}
	}

	function openVSCodeTunnelUrl() {
		if (vscodeTunnelStatus.state?.openUrl) {
			window.open(vscodeTunnelStatus.state.openUrl, '_blank');
		}
	}

	function copyLoginUrl() {
		if (deviceLoginUrl) {
			navigator.clipboard.writeText(deviceLoginUrl);
		}
	}

	// === Initialization ===

	// Initialize socket connections
	$effect(() => {
		connectLocalSocket();
		connectVSCodeSocket();

		return () => {
			if (localSocket) {
				localSocket.disconnect();
				localSocket = null;
			}
			if (vscodeSocket) {
				vscodeSocket.disconnect();
				vscodeSocket = null;
			}
		};
	});
</script>

<div class="tunnels-settings">
	<div class="settings-header">
		<h3>Connectivity</h3>
		<p class="section-subtitle">
			Enable remote access to your development environment through LocalTunnel or VS Code Remote
			Tunnels.
		</p>
	</div>

	<!-- LocalTunnel Section -->
	<section class="settings-section">
		<h4>LocalTunnel</h4>
		<p class="subsection-description">
			Create a public URL for your local development server using LocalTunnel. Perfect for quick
			demos and testing webhooks.
		</p>

		<FormSection
			title="Public Tunnel Configuration"
			description="Enable public URL access via LocalTunnel for external access"
		>
			{#if localError}
				<InfoBox variant="error">
					{localError}
				</InfoBox>
			{/if}

			<div class="tunnel-status" data-section="localtunnel">
				<div class="status-row">
					<span class="status-label">Status:</span>
					<span
						class="status-value"
						class:enabled={localTunnelStatus.enabled}
						class:disabled={!localTunnelStatus.enabled}
					>
						{localTunnelStatus.enabled ? 'Enabled' : 'Disabled'}
					</span>
				</div>

				{#if localTunnelStatus.enabled}
					<div class="status-row">
						<span class="status-label">Running:</span>
						<span
							class="status-value"
							class:running={localTunnelStatus.running}
							class:stopped={!localTunnelStatus.running}
						>
							{localTunnelStatus.running ? 'Yes' : 'No'}
						</span>
					</div>
				{/if}

				<div class="status-row">
					<span class="status-label">Port:</span>
					<span class="status-value">{localTunnelStatus.port || 'N/A'}</span>
				</div>

				{#if localTunnelStatus.subdomain}
					<div class="status-row">
						<span class="status-label">Subdomain:</span>
						<span class="status-value">{localTunnelStatus.subdomain}</span>
					</div>
				{/if}
			</div>

			<div class="tunnel-config">
				<div class="config-section">
					<div class="config-label">Subdomain (optional):</div>
					<div class="config-input-wrapper">
						<Input
							bind:value={subdomainInput}
							placeholder="Enter custom subdomain or leave empty for random"
							class="input-monospace"
						/>
						<Button
							onclick={updateSubdomain}
							variant="secondary"
							size="sm"
							disabled={isUpdatingConfig || subdomainInput === (localTunnelStatus.subdomain || '')}
						>
							{#if isUpdatingConfig}
								<LoadingSpinner size="sm" />
							{:else}
								Update
							{/if}
						</Button>
					</div>
					<div class="config-help">
						Custom subdomain for your tunnel URL (e.g., "myapp" for myapp.loca.lt)
					</div>
				</div>
			</div>

			{#if localTunnelStatus.url}
				<div class="tunnel-url">
					<div class="url-label">Public URL:</div>
					<div class="url-wrapper">
						<Input value={localTunnelStatus.url} readonly={true} class="input-monospace" />
						<Button onclick={copyLocalUrlToClipboard} variant="secondary" size="sm">Copy</Button>
						<Button onclick={openLocalTunnelUrl} variant="secondary" size="sm">Open</Button>
					</div>
				</div>
			{/if}

			<div class="tunnel-actions">
				<Button
					onclick={toggleLocalTunnel}
					variant={localTunnelStatus.enabled ? 'danger' : 'primary'}
					disabled={localIsLoading}
					class="tunnel-action-button"
				>
					{#if localIsLoading}
						<LoadingSpinner size="sm" />
					{:else}
						{localTunnelStatus.enabled ? 'Disable Tunnel' : 'Enable Tunnel'}
					{/if}
				</Button>
			</div>
		</FormSection>
	</section>

	<!-- VS Code Tunnel Section -->
	<section class="settings-section">
		<h4>VS Code Remote Tunnel</h4>
		<p class="subsection-description">
			Connect to this workspace remotely using VS Code Desktop or vscode.dev in your browser.
		</p>

		<FormSection
			title="VS Code Tunnel Configuration"
			description="Control VS Code Remote Tunnel access for development"
		>
			{#if vscodeError}
				<InfoBox variant="error">
					{vscodeError}
				</InfoBox>
			{/if}

			<div class="tunnel-status" data-section="vscode">
				<div class="status-item">
					<strong>Status:</strong>
					<StatusBadge variant={vscodeTunnelStatus.running ? 'active' : 'inactive'}>
						{vscodeTunnelStatus.running ? 'Running' : 'Stopped'}
					</StatusBadge>
				</div>

				{#if vscodeTunnelStatus.running && vscodeTunnelStatus.state}
					<div class="status-item">
						<strong>Name:</strong>
						{vscodeTunnelStatus.state.name}
					</div>
					<div class="status-item">
						<strong>Folder:</strong>
						{vscodeTunnelStatus.state.folder}
					</div>
					<div class="status-item">
						<strong>PID:</strong>
						{vscodeTunnelStatus.state.pid}
					</div>
					<div class="status-item">
						<strong>Started:</strong>
						{new Date(vscodeTunnelStatus.state.startedAt).toLocaleString()}
					</div>
				{/if}
			</div>

			{#if !vscodeTunnelStatus.running}
				<div class="tunnel-config">
					<div class="config-row">
						<Input
							bind:value={nameInput}
							placeholder="Custom tunnel name (optional)"
							label="Tunnel Name"
						/>
					</div>
					<div class="config-note">
						Leave empty to use default: name will be "dispatch-[hostname]" and folder will be your
						workspace root.
					</div>
				</div>
			{/if}

			{#if vscodeTunnelStatus.running && vscodeTunnelStatus.state?.openUrl}
				<div class="tunnel-url">
					<div class="url-label">Open in VS Code Web:</div>
					<div class="url-wrapper">
						<Input value={vscodeTunnelStatus.state.openUrl} readonly />
						<Button onclick={copyVSCodeUrlToClipboard} variant="secondary" size="sm">Copy</Button>
						<Button onclick={openVSCodeTunnelUrl} variant="secondary" size="sm">Open</Button>
					</div>
				</div>
			{/if}

			{#if deviceLoginUrl}
				<InfoBox variant="info" title="Device Login Required">
					<div class="login-url-wrapper">
						<Input value={deviceLoginUrl} readonly />
						<Button onclick={copyLoginUrl} variant="secondary" size="sm">Copy</Button>
					</div>
					<p style="margin: var(--space-2) 0 0 0; font-size: var(--font-size-1);">
						Complete the device login in VS Code to activate the tunnel.
					</p>
				</InfoBox>
			{/if}

			<div class="tunnel-actions">
				<Button
					onclick={vscodeTunnelStatus.running ? stopVSCodeTunnel : startVSCodeTunnel}
					variant={vscodeTunnelStatus.running ? 'danger' : 'primary'}
					disabled={vscodeIsLoading}
					class="tunnel-action-button"
				>
					{#if vscodeIsLoading}
						<LoadingSpinner size="sm" />
					{:else}
						{vscodeTunnelStatus.running ? 'Stop Tunnel' : 'Start Tunnel'}
					{/if}
				</Button>
			</div>

			{#if !vscodeTunnelStatus.running}
				<InfoBox variant="info">
					<p style="margin: 0 0 var(--space-2) 0;">
						<strong>First-time setup:</strong> When you start the tunnel for the first time, you'll need
						to authenticate with Microsoft/GitHub. A device login URL will appear above.
					</p>
					<p style="margin: 0;">
						<strong>VS Code Desktop:</strong> Install the "Remote - Tunnels" extension and connect using
						the tunnel name.
					</p>
				</InfoBox>
			{/if}
		</FormSection>
	</section>
</div>

<style>
	/* Import shared settings styles - most styles now in settings.css */

	/* Component-specific styles */
	.config-row {
		margin-bottom: var(--space-2);
	}

	.config-note {
		font-size: var(--font-size-1);
		color: var(--muted);
		margin-top: var(--space-2);
	}

	.status-value.stopped {
		color: var(--warn);
	}

	.status-item {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	/* Login URL wrapper for InfoBox content */
	.login-url-wrapper {
		display: flex;
		gap: var(--space-2);
		align-items: stretch;
		margin-bottom: var(--space-2);
	}

	.login-url-wrapper :global(input) {
		flex: 1;
	}
</style>
