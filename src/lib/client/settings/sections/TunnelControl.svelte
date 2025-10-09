<script>
	import { io } from 'socket.io-client';
	import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';
	import Button from '$lib/client/shared/components/Button.svelte';
	import FormSection from '$lib/client/shared/components/FormSection.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	import LoadingSpinner from '$lib/client/shared/components/LoadingSpinner.svelte';

	let socket = null;
	let tunnelStatus = $state({
		enabled: false,
		running: false,
		url: null,
		port:
			typeof window !== 'undefined'
				? window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
				: null,
		subdomain: ''
	});
	let isLoading = $state(false);
	let error = $state(null);
	let subdomainInput = $state('');
	let isUpdatingConfig = $state(false);

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
			// Update the subdomain input field with current value
			subdomainInput = status.subdomain || '';
		});
	}

	function fetchTunnelStatus() {
		if (!socket) return;

		socket.emit(SOCKET_EVENTS.TUNNEL_STATUS, (response) => {
			if (response.success) {
				tunnelStatus = response.status;
				// Update the subdomain input field with current value
				subdomainInput = tunnelStatus.subdomain || '';
			} else {
				error = response.error || 'Failed to get tunnel status';
			}
		});
	}

	async function toggleTunnel() {
		if (!socket) return;

		isLoading = true;
		error = null;

		const event = tunnelStatus.enabled ? SOCKET_EVENTS.TUNNEL_DISABLE : SOCKET_EVENTS.TUNNEL_ENABLE;

		// Get the current port from window location
		const currentPort =
			window.location.port || (window.location.protocol === 'https:' ? '443' : '80');

		// Socket.IO authenticates via session cookie in handshake (no explicit auth needed)
		socket.emit(event, { port: currentPort }, (response) => {
			isLoading = false;
			if (response.success) {
				tunnelStatus = response.status;
			} else {
				error = response.error || 'Failed to toggle tunnel';
			}
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

	async function updateSubdomain() {
		if (!socket) return;

		isUpdatingConfig = true;
		error = null;

		// Socket.IO authenticates via session cookie in handshake (no explicit auth needed)
		socket.emit(SOCKET_EVENTS.TUNNEL_UPDATE_CONFIG, { subdomain: subdomainInput }, (response) => {
			isUpdatingConfig = false;
			if (response.success) {
				tunnelStatus = response.status;
			} else {
				error = response.error || 'Failed to update subdomain';
			}
		});
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
						disabled={isUpdatingConfig || subdomainInput === (tunnelStatus.subdomain || '')}
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

		{#if tunnelStatus.url}
			<div class="tunnel-url">
				<div class="url-label">Public URL:</div>
				<div class="url-wrapper">
					<Input value={tunnelStatus.url} readonly={true} class="input-monospace" />
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
				class="tunnel-action-button"
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
	/* Import shared settings styles - most styles now in settings.css */

	.error-message {
		color: #ff6347;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		margin-bottom: var(--space-md);
		font-size: var(--font-size-1);
	}

	/* Component-specific status color overrides */
	.status-value.enabled {
		color: #4ade80;
	}

	.status-value.running {
		color: #4ade80;
	}

	.status-value.stopped {
		color: #f59e0b;
	}
</style>
