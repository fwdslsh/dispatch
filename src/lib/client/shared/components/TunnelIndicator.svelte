<script>
	import { io } from 'socket.io-client';
	import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';

	let socket = null;
	let tunnelStatus = $state({
		enabled: false,
		running: false,
		url: null,
		port: null
	});

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
			if (response?.success && response.status) {
				tunnelStatus = response.status;
			}
		});
	}

	async function handleClick() {
		if (!tunnelStatus.url) return;

		try {
			// Try modern clipboard API if available
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(tunnelStatus.url);
				console.log('Tunnel URL copied to clipboard');
			}
		} catch (err) {
			console.error('Failed to copy URL:', err);
			// User can manually select and copy the text
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

	// Derive display state
	const isActive = $derived(tunnelStatus.enabled && tunnelStatus.running && tunnelStatus.url);
	const statusText = $derived(() => {
		if (!tunnelStatus.enabled) return '';
		if (tunnelStatus.url) {
			// Extract just the subdomain and domain for cleaner display
			try {
				const url = new URL(tunnelStatus.url);
				return url.hostname;
			} catch {
				return tunnelStatus.url;
			}
		}
		if (tunnelStatus.running) return 'Tunnel Starting...';
		return 'Tunnel Enabled';
	});
</script>

{#if tunnelStatus.enabled}
	<button
		class="tunnel-indicator"
		class:active={isActive}
		class:starting={tunnelStatus.running && !tunnelStatus.url}
		onclick={handleClick}
		title={tunnelStatus.url ? `Click to copy: ${tunnelStatus.url}` : statusText()}
		aria-label={statusText()}
	>
		<span class="tunnel-icon">
			{#if isActive}
				<!-- Globe icon for active tunnel -->
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="2" y1="12" x2="22" y2="12"></line>
					<path
						d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
					></path>
				</svg>
			{:else}
				<!-- Loading spinner for starting -->
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="spinner"
				>
					<path
						d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
					/>
				</svg>
			{/if}
		</span>
		<span class="tunnel-text">{statusText()}</span>
	</button>
{/if}

<style>
	.tunnel-indicator {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--primary-dim);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-size: 0.85rem;
		font-family: var(--font-mono);
		cursor: text;
		transition: all 0.2s ease;
		user-select: text;
		-webkit-user-select: text;
		-moz-user-select: text;
		-ms-user-select: text;
	}

	.tunnel-indicator:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: var(--primary);
	}

	.tunnel-indicator.active {
		background: rgba(76, 222, 128, 0.1);
		border-color: #4ade80;
		color: #4ade80;
		cursor: pointer;
	}

	.tunnel-indicator.active:hover {
		background: rgba(76, 222, 128, 0.2);
	}

	.tunnel-indicator.starting {
		background: rgba(245, 158, 11, 0.1);
		border-color: #f59e0b;
		color: #f59e0b;
	}

	.tunnel-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--font-size-2);
		height: var(--font-size-2);
	}

	.spinner {
		animation: spin 2s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.tunnel-text {
		white-space: nowrap;
		user-select: text;
		-webkit-user-select: text;
		-moz-user-select: text;
		-ms-user-select: text;
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.tunnel-text {
			display: none;
		}

		.tunnel-indicator {
			padding: var(--space-1) var(--space-2);
		}
	}
</style>
