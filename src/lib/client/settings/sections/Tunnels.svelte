<script>
	import { io } from 'socket.io-client';
	import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';
	import Button from '$lib/client/shared/components/Button.svelte';
	import FormSection from '$lib/client/shared/components/FormSection.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	import LoadingSpinner from '$lib/client/shared/components/LoadingSpinner.svelte';

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
			fetchLocalTunnelStatus();
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
		if (!localSocket) return;

		localIsLoading = true;
		localError = null;

		// Get terminal key from localStorage using the correct key name
		const terminalKey = localStorage.getItem('dispatch-auth-token') || '';

		const event = localTunnelStatus.enabled
			? SOCKET_EVENTS.TUNNEL_DISABLE
			: SOCKET_EVENTS.TUNNEL_ENABLE;

		// Authenticate first
		localSocket.emit('auth', terminalKey, (authResponse) => {
			if (!authResponse?.success) {
				localIsLoading = false;
				localError = 'Authentication failed. Please check your terminal key.';
				return;
			}

			// Get the current port from window location
			const currentPort =
				window.location.port || (window.location.protocol === 'https:' ? '443' : '80');

			// Now toggle tunnel with port
			localSocket.emit(event, { port: currentPort }, (response) => {
				localIsLoading = false;
				if (response.success) {
					localTunnelStatus = response.status;
				} else {
					localError = response.error || 'Failed to toggle tunnel';
				}
			});
		});
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

		// Get terminal key from localStorage using the correct key name
		const terminalKey = localStorage.getItem('dispatch-auth-token') || '';

		// Authenticate first
		localSocket.emit('auth', terminalKey, (authResponse) => {
			if (!authResponse?.success) {
				isUpdatingConfig = false;
				localError = 'Authentication failed. Please check your terminal key.';
				return;
			}

			// Now update config
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
		});
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
			fetchVSCodeTunnelStatus();
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
		if (!vscodeSocket) return;

		vscodeIsLoading = true;
		vscodeError = null;
		deviceLoginUrl = '';

		// Get terminal key from localStorage
		const terminalKey = localStorage.getItem('dispatch-auth-token') || '';

		// Authenticate first
		vscodeSocket.emit('auth', terminalKey, (authResponse) => {
			if (!authResponse?.success) {
				vscodeIsLoading = false;
				vscodeError = 'Authentication failed. Please check your terminal key.';
				return;
			}

			const data = {};

			// Add optional parameters if provided
			if (nameInput.trim()) data.name = nameInput.trim();

			vscodeSocket.emit(SOCKET_EVENTS.VSCODE_TUNNEL_START, data, (response) => {
				vscodeIsLoading = false;
				if (response.success) {
					vscodeTunnelStatus = { running: true, state: response.state };
				} else {
					vscodeError = response.error || 'Failed to start tunnel';
				}
			});
		});
	}

	async function stopVSCodeTunnel() {
		if (!vscodeSocket) return;

		vscodeIsLoading = true;
		vscodeError = null;
		deviceLoginUrl = '';

		// Get terminal key from localStorage
		const terminalKey = localStorage.getItem('dispatch-auth-token') || '';

		// Authenticate first
		vscodeSocket.emit('auth', terminalKey, (authResponse) => {
			if (!authResponse?.success) {
				vscodeIsLoading = false;
				vscodeError = 'Authentication failed. Please check your terminal key.';
				return;
			}

			vscodeSocket.emit(SOCKET_EVENTS.VSCODE_TUNNEL_STOP, {}, (response) => {
				vscodeIsLoading = false;
				if (response.success) {
					vscodeTunnelStatus = { running: false, state: null };
				} else {
					vscodeError = response.error || 'Failed to stop tunnel';
				}
			});
		});
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
	<!-- LocalTunnel Section -->
	<section class="settings-section">
		<FormSection
			title="Public Tunnel (LocalTunnel)"
			description="Enable public URL access via LocalTunnel for external access"
		>
			{#if localError}
				<div class="error-message">
					<strong>Error:</strong>
					{localError}
				</div>
			{/if}

			<div class="tunnel-status">
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

	<!-- Divider -->
	<div class="section-divider"></div>

	<!-- VS Code Tunnel Section -->
	<section class="settings-section">
		<FormSection
			title="VS Code Remote Tunnel"
			description="Control VS Code Remote Tunnel access for development"
		>
			{#if vscodeError}
				<div class="error-message vscode-error">
					{vscodeError}
				</div>
			{/if}

			<div class="tunnel-status">
				<div class="status-item">
					<strong>Status:</strong>
					<span class="status-badge" class:running={vscodeTunnelStatus.running}>
						{vscodeTunnelStatus.running ? 'Running' : 'Stopped'}
					</span>
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
				<div class="device-login">
					<div class="login-label">Device Login Required:</div>
					<div class="login-url-wrapper">
						<Input value={deviceLoginUrl} readonly />
						<Button onclick={copyLoginUrl} variant="secondary" size="sm">Copy</Button>
					</div>
					<div class="login-note">
						Complete the device login in VS Code to activate the tunnel.
					</div>
				</div>
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
				<div class="tunnel-info">
					<p>
						<strong>First-time setup:</strong> When you start the tunnel for the first time, you'll
						need to authenticate with Microsoft/GitHub. A device login URL will appear above.
					</p>
					<p>
						<strong>VS Code Desktop:</strong> Install the "Remote - Tunnels" extension and connect
						using the tunnel name.
					</p>
				</div>
			{/if}
		</FormSection>
	</section>
</div>

<style>
	.tunnels-settings {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.settings-section {
		display: flex;
		flex-direction: column;
	}

	.section-divider {
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			rgba(46, 230, 107, 0.3),
			transparent
		);
		margin: var(--space-4) 0;
	}

	.error-message {
		color: #ff6347;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-md);
		font-size: var(--font-size-1);
	}

	.vscode-error {
		background: rgba(255, 99, 71, 0.1);
		border: 1px solid rgba(255, 99, 71, 0.3);
	}

	.tunnel-status {
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: var(--space-md);
		margin-bottom: var(--space-md);
	}

	.tunnel-config {
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: var(--space-md);
		margin-bottom: var(--space-md);
	}

	.config-section {
		margin-bottom: var(--space-sm);
	}

	.config-section:last-child {
		margin-bottom: 0;
	}

	.config-label {
		font-weight: 500;
		color: var(--text-muted);
		margin-bottom: var(--space-xs);
	}

	.config-input-wrapper {
		display: flex;
		gap: var(--space-sm);
		align-items: stretch;
		margin-bottom: var(--space-xs);
	}

	.config-input-wrapper :global(input) {
		flex: 1;
	}

	.config-help {
		font-size: var(--font-size-1);
		color: var(--text-muted);
		font-style: italic;
	}

	.config-row {
		margin-bottom: var(--space-sm);
	}

	.config-note {
		font-size: var(--font-size-sm);
		color: var(--text-muted);
		margin-top: var(--space-xs);
	}

	.status-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-xs);
	}

	.status-row:last-child {
		margin-bottom: 0;
	}

	.status-label {
		font-weight: 500;
		color: var(--text-muted);
	}

	.status-value {
		font-weight: 600;
	}

	.status-value.enabled {
		color: #4ade80;
	}

	.status-value.disabled {
		color: var(--text-muted);
	}

	.status-value.running {
		color: #4ade80;
	}

	.status-value.stopped {
		color: #f59e0b;
	}

	.status-item {
		display: flex;
		gap: var(--space-sm);
		margin-bottom: var(--space-xs);
	}

	.status-badge {
		padding: 2px var(--space-2);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		background: var(--bg-secondary);
		color: var(--text-muted);
	}

	.status-badge.running {
		background: rgba(34, 197, 94, 0.1);
		color: #22c55e;
	}

	.tunnel-url {
		margin-bottom: var(--space-md);
	}

	.url-label {
		font-weight: 500;
		color: var(--text-muted);
		margin-bottom: var(--space-xs);
	}

	.url-wrapper {
		display: flex;
		gap: var(--space-sm);
		align-items: stretch;
	}

	.url-wrapper :global(input) {
		flex: 1;
	}

	.device-login {
		margin-bottom: var(--space-md);
		padding: var(--space-sm);
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.3);
		border-radius: var(--radius-md);
	}

	.login-label {
		font-weight: 500;
		color: #3b82f6;
		margin-bottom: var(--space-xs);
	}

	.login-url-wrapper {
		display: flex;
		gap: var(--space-sm);
		align-items: stretch;
		margin-bottom: var(--space-xs);
	}

	.login-url-wrapper :global(input) {
		flex: 1;
	}

	.login-note {
		font-size: var(--font-size-sm);
		color: #3b82f6;
	}

	.tunnel-actions {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.tunnel-info {
		padding: var(--space-sm);
		background: var(--bg-secondary);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		color: var(--text-muted);
	}

	.tunnel-info p {
		margin-bottom: var(--space-xs);
	}

	.tunnel-info p:last-child {
		margin-bottom: 0;
	}
</style>
