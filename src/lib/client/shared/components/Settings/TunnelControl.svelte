<script>
	import { io } from 'socket.io-client';
	import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';
	import Button from '../Button.svelte';
	import FormSection from '../FormSection.svelte';
	import Input from '../Input.svelte';
	import LoadingSpinner from '../LoadingSpinner.svelte';

	let socket = null;
	let tunnelStatus = $state({
		enabled: false,
		running: false,
		url: null,
		port: null,
		subdomain: ''
	});
	let isLoading = $state(false);
	let error = $state(null);

	function connectSocket() {
		if (socket) return;

		const socketUrl = typeof window !== 'undefined' ? window.location.origin : '';
		socket = io(socketUrl, { transports: ['websocket', 'polling'] });

		socket.on(SOCKET_EVENTS.CONNECTION, () => {
			fetchTunnelStatus();
		});

		// Listen for tunnel status broadcasts
		socket.on(SOCKET_EVENTS.TUNNEL_STATUS, (status) => {
			tunnelStatus = status;
		});
	}

	function fetchTunnelStatus() {
		if (!socket) return;

		socket.emit(SOCKET_EVENTS.TUNNEL_STATUS, (response) => {
			if (response.success) {
				tunnelStatus = response.status;
			} else {
				error = response.error || 'Failed to get tunnel status';
			}
		});
	}

	async function toggleTunnel() {
		if (!socket) return;

		isLoading = true;
		error = null;

		// Get terminal key from localStorage (should match how other authenticated components work)
		const terminalKey = localStorage.getItem('terminalKey') || '';

		const event = tunnelStatus.enabled ? SOCKET_EVENTS.TUNNEL_DISABLE : SOCKET_EVENTS.TUNNEL_ENABLE;

		// Authenticate first
		socket.emit('auth', terminalKey, (authResponse) => {
			if (!authResponse?.success) {
				isLoading = false;
				error = 'Authentication failed. Please check your terminal key.';
				return;
			}

			// Now toggle tunnel
			socket.emit(event, {}, (response) => {
				isLoading = false;
				if (response.success) {
					tunnelStatus = response.status;
				} else {
					error = response.error || 'Failed to toggle tunnel';
				}
			});
		});
	}

	function copyUrlToClipboard() {
		if (tunnelStatus.url) {
			navigator.clipboard
				.writeText(tunnelStatus.url)
				.then(() => {
					// Could add toast notification
					console.log('Tunnel URL copied to clipboard');
				})
				.catch((err) => {
					console.error('Failed to copy URL:', err);
				});
		}
	}

	function openTunnelUrl() {
		if (tunnelStatus.url) {
			window.open(tunnelStatus.url, '_blank');
		}
	}

	// Initialize socket connection
	$effect(() => {
		connectSocket();

		return () => {
			if (socket) {
				socket.disconnect();
				socket = null;
			}
		};
	});
</script>

<div class="tunnel-control">
	<FormSection
		title="Public Tunnel Control"
		description="Enable or disable public URL access via LocalTunnel"
	>
		{#if error}
			<div class="error-message">
				<strong>Error:</strong>
				{error}
			</div>
		{/if}

		<div class="tunnel-status">
			<div class="status-row">
				<span class="status-label">Status:</span>
				<span
					class="status-value"
					class:enabled={tunnelStatus.enabled}
					class:disabled={!tunnelStatus.enabled}
				>
					{tunnelStatus.enabled ? 'Enabled' : 'Disabled'}
				</span>
			</div>

			{#if tunnelStatus.enabled}
				<div class="status-row">
					<span class="status-label">Running:</span>
					<span
						class="status-value"
						class:running={tunnelStatus.running}
						class:stopped={!tunnelStatus.running}
					>
						{tunnelStatus.running ? 'Yes' : 'No'}
					</span>
				</div>
			{/if}

			<div class="status-row">
				<span class="status-label">Port:</span>
				<span class="status-value">{tunnelStatus.port || 'N/A'}</span>
			</div>

			{#if tunnelStatus.subdomain}
				<div class="status-row">
					<span class="status-label">Subdomain:</span>
					<span class="status-value">{tunnelStatus.subdomain}</span>
				</div>
			{/if}
		</div>

		{#if tunnelStatus.url}
			<div class="tunnel-url">
				<div class="url-label">Public URL:</div>
				<div class="url-wrapper">
					<Input
						value={tunnelStatus.url}
						readonly={true}
						style="font-family: monospace; font-size: 0.9rem;"
					/>
					<Button onclick={copyUrlToClipboard} variant="secondary" size="sm">Copy</Button>
					<Button onclick={openTunnelUrl} variant="secondary" size="sm">Open</Button>
				</div>
			</div>
		{/if}

		<div class="tunnel-actions">
			<Button
				onclick={toggleTunnel}
				variant={tunnelStatus.enabled ? 'danger' : 'primary'}
				disabled={isLoading}
				style="min-width: 120px;"
			>
				{#if isLoading}
					<LoadingSpinner size="sm" />
				{:else}
					{tunnelStatus.enabled ? 'Disable Tunnel' : 'Enable Tunnel'}
				{/if}
			</Button>
		</div>
	</FormSection>
</div>

<style>
	.tunnel-control {
		max-width: 600px;
	}

	.error-message {
		background: rgba(255, 99, 71, 0.1);
		border: 1px solid rgba(255, 99, 71, 0.3);
		color: #ff6347;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-md);
		font-size: 0.9rem;
	}

	.tunnel-status {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-sm);
		padding: var(--space-md);
		margin-bottom: var(--space-md);
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

	.tunnel-actions {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}
</style>
