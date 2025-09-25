<script>
	import { io } from 'socket.io-client';
	import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';
	import Button from '../Button.svelte';
	import FormSection from '../FormSection.svelte';
	import Input from '../Input.svelte';
	import LoadingSpinner from '../LoadingSpinner.svelte';

	let socket = null;
	let tunnelStatus = $state({
		running: false,
		state: null
	});
	let isLoading = $state(false);
	let error = $state(null);
	let nameInput = $state('');
	let deviceLoginUrl = $state('');

	function connectSocket() {
		if (socket) return;

		const socketUrl = typeof window !== 'undefined' ? window.location.origin : '';
		socket = io(socketUrl, { transports: ['websocket', 'polling'] });

		socket.on(SOCKET_EVENTS.CONNECTION, () => {
			fetchTunnelStatus();
		});

		// Listen for tunnel status broadcasts
		socket.on(SOCKET_EVENTS.VSCODE_TUNNEL_STATUS, (status) => {
			tunnelStatus = status;
			if (status.error) {
				error = status.error;
			}
		});

		// Listen for device login URL
		socket.on(SOCKET_EVENTS.VSCODE_TUNNEL_LOGIN_URL, (data) => {
			deviceLoginUrl = data.url;
		});
	}

	function fetchTunnelStatus() {
		if (!socket) return;

		socket.emit(SOCKET_EVENTS.VSCODE_TUNNEL_STATUS, (response) => {
			if (response.success) {
				tunnelStatus = response.status;
				if (response.status.error) {
					error = response.status.error;
				}
			} else {
				error = response.error || 'Failed to get tunnel status';
			}
		});
	}

	async function startTunnel() {
		if (!socket) return;

		isLoading = true;
		error = null;
		deviceLoginUrl = '';

		// Get terminal key from localStorage
		const terminalKey = localStorage.getItem('dispatch-auth-key') || '';

		// Authenticate first
		socket.emit('auth', terminalKey, (authResponse) => {
			if (!authResponse?.success) {
				isLoading = false;
				error = 'Authentication failed. Please check your terminal key.';
				return;
			}

			const data = {};

			// Add optional parameters if provided
			if (nameInput.trim()) data.name = nameInput.trim();

			socket.emit(SOCKET_EVENTS.VSCODE_TUNNEL_START, data, (response) => {
				isLoading = false;
				if (response.success) {
					tunnelStatus = { running: true, state: response.state };
				} else {
					error = response.error || 'Failed to start tunnel';
				}
			});
		});
	}

	async function stopTunnel() {
		if (!socket) return;

		isLoading = true;
		error = null;
		deviceLoginUrl = '';

		// Get terminal key from localStorage
		const terminalKey = localStorage.getItem('dispatch-auth-key') || '';

		// Authenticate first
		socket.emit('auth', terminalKey, (authResponse) => {
			if (!authResponse?.success) {
				isLoading = false;
				error = 'Authentication failed. Please check your terminal key.';
				return;
			}

			socket.emit(SOCKET_EVENTS.VSCODE_TUNNEL_STOP, {}, (response) => {
				isLoading = false;
				if (response.success) {
					tunnelStatus = { running: false, state: null };
				} else {
					error = response.error || 'Failed to stop tunnel';
				}
			});
		});
	}

	async function copyUrlToClipboard() {
		if (tunnelStatus.state?.openUrl) {
			try {
				await navigator.clipboard.writeText(tunnelStatus.state.openUrl);
			} catch (err) {
				console.error('Failed to copy URL:', err);
			}
		}
	}

	function openTunnelUrl() {
		if (tunnelStatus.state?.openUrl) {
			window.open(tunnelStatus.state.openUrl, '_blank');
		}
	}

	function copyLoginUrl() {
		if (deviceLoginUrl) {
			navigator.clipboard.writeText(deviceLoginUrl);
		}
	}

	// Initialize socket connection
	if (typeof window !== 'undefined') {
		connectSocket();
	}
</script>

<div class="vscode-tunnel-control">
	<FormSection title="VS Code Remote Tunnel" description="Control VS Code Remote Tunnel access">
		{#if error}
			<div class="error-message">
				{error}
			</div>
		{/if}

		<div class="tunnel-status">
			<div class="status-item">
				<strong>Status:</strong>
				<span class="status-badge" class:running={tunnelStatus.running}>
					{tunnelStatus.running ? 'Running' : 'Stopped'}
				</span>
			</div>

			{#if tunnelStatus.running && tunnelStatus.state}
				<div class="status-item">
					<strong>Name:</strong> {tunnelStatus.state.name}
				</div>
				<div class="status-item">
					<strong>Folder:</strong> {tunnelStatus.state.folder}
				</div>
				<div class="status-item">
					<strong>PID:</strong> {tunnelStatus.state.pid}
				</div>
				<div class="status-item">
					<strong>Started:</strong> {new Date(tunnelStatus.state.startedAt).toLocaleString()}
				</div>
			{/if}
		</div>

		{#if !tunnelStatus.running}
			<div class="tunnel-config">
				<div class="config-row">
					<Input
						bind:value={nameInput}
						placeholder="Custom tunnel name (optional)"
						label="Tunnel Name"
					/>
				</div>
				<div class="config-note">
					Leave empty to use default: name will be "dispatch-[hostname]" and folder will be your workspace root.
				</div>
			</div>
		{/if}

		{#if tunnelStatus.running && tunnelStatus.state?.openUrl}
			<div class="tunnel-url">
				<div class="url-label">Open in VS Code Web:</div>
				<div class="url-wrapper">
					<Input value={tunnelStatus.state.openUrl} readonly />
					<Button onclick={copyUrlToClipboard} variant="secondary" size="sm">Copy</Button>
					<Button onclick={openTunnelUrl} variant="secondary" size="sm">Open</Button>
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
				onclick={tunnelStatus.running ? stopTunnel : startTunnel}
				variant={tunnelStatus.running ? 'danger' : 'primary'}
				disabled={isLoading}
				style="min-width: 120px;"
			>
				{#if isLoading}
					<LoadingSpinner size="sm" />
				{:else}
					{tunnelStatus.running ? 'Stop Tunnel' : 'Start Tunnel'}
				{/if}
			</Button>
		</div>

		{#if !tunnelStatus.running}
			<div class="tunnel-info">
				<p><strong>First-time setup:</strong> When you start the tunnel for the first time, you'll need to authenticate with Microsoft/GitHub. A device login URL will appear above.</p>
				<p><strong>VS Code Desktop:</strong> Install the "Remote - Tunnels" extension and connect using the tunnel name.</p>
			</div>
		{/if}
	</FormSection>
</div>

<style>
	.vscode-tunnel-control {
		max-width: 600px;
	}

	.error-message {
		background: rgba(255, 99, 71, 0.1);
		border: 1px solid rgba(255, 99, 71, 0.3);
		color: #ff6347;
		padding: var(--space-sm);
		border-radius: var(--border-radius);
		margin-bottom: var(--space-md);
	}

	.tunnel-status {
		margin-bottom: var(--space-md);
	}

	.status-item {
		display: flex;
		gap: var(--space-sm);
		margin-bottom: var(--space-xs);
	}

	.status-badge {
		padding: 2px 8px;
		border-radius: var(--border-radius-sm);
		font-size: var(--font-size-sm);
		background: var(--bg-secondary);
		color: var(--text-muted);
	}

	.status-badge.running {
		background: rgba(34, 197, 94, 0.1);
		color: #22c55e;
	}

	.tunnel-config {
		margin-bottom: var(--space-md);
	}

	.config-row {
		margin-bottom: var(--space-sm);
	}

	.config-note {
		font-size: var(--font-size-sm);
		color: var(--text-muted);
		margin-top: var(--space-xs);
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
		border-radius: var(--border-radius);
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
		margin-bottom: var(--space-md);
	}

	.tunnel-info {
		padding: var(--space-sm);
		background: var(--bg-secondary);
		border-radius: var(--border-radius);
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