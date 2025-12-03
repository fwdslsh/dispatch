<script>
	import { onMount, onDestroy } from 'svelte';
	import { io } from 'socket.io-client';
	import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';
	import Button from './Button.svelte';

	let publicUrl = $state(null);
	let socket = null; // Not reactive - doesn't need to be
	let pollInterval = null; // Not reactive - doesn't need to be

	function connectSocket() {
		// Use current origin for socket connection to support remote access
		const socketUrl = typeof window !== 'undefined' ? window.location.origin : '';
		socket = io(socketUrl, { transports: ['websocket', 'polling'] });
		socket.on(SOCKET_EVENTS.CONNECTION, () => {
			pollPublicUrl();
		});
	}

	function pollPublicUrl() {
		if (socket) {
			socket.emit(SOCKET_EVENTS.GET_PUBLIC_URL, (resp) => {
				if (resp.ok) {
					publicUrl = resp.url;
				}
			});
		}
	}

	function copyToClipboard() {
		if (publicUrl) {
			navigator.clipboard
				.writeText(publicUrl)
				.then(() => {
					// Could add a toast notification here
					console.log('URL copied to clipboard');
				})
				.catch((err) => {
					console.error('Failed to copy: ', err);
				});
		}
	}

	function openInNewTab() {
		if (publicUrl) {
			window.open(publicUrl, '_blank');
		}
	}

	// Initialize socket connection and polling on mount
	onMount(() => {
		connectSocket();
		// Poll every 5 seconds to check for URL updates
		pollInterval = setInterval(pollPublicUrl, 5000);
	});

	onDestroy(() => {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
		if (socket) {
			socket.disconnect();
			socket = null;
		}
	});
</script>

{#if publicUrl}
	<div class="public-url-container">
		<!-- <div class="public-url-label">Public URL:</div> -->
		<div class="public-url-wrapper">
			<Button
				variant="ghost"
				augmented="none"
				onclick={openInNewTab}
				ariaLabel="Click to open in new tab"
				class="public-url-link"
			>
				{publicUrl}
			</Button>
			<Button
				variant="ghost"
				augmented="none"
				onclick={copyToClipboard}
				ariaLabel="Copy URL to clipboard"
				class="copy-button"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
					<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
				</svg>
			</Button>
		</div>
	</div>
{/if}

<style>
	.public-url-container {
		padding: var(--space-sm);
		margin: var(--space-sm) 0;
		backdrop-filter: blur(5px);
		opacity: 0.7;
		transition: opacity 0.3s ease;
	}

	.public-url-container:hover {
		opacity: 1;
	}

	.public-url-wrapper {
		display: flex;
		align-items: center;
		/* gap: var(--space-sm); */
	}

	@media (max-width: 768px) {
		.public-url-container {
			padding: var(--space-sm);
			margin: 0;
			background: rgba(26, 26, 26, 0.9);
			border: 1px solid rgba(0, 255, 136, 0.15);
			border-radius: var(--radius-sm);
		}

		.public-url-wrapper {
			flex-direction: row; /* Keep horizontal layout */
			align-items: center;
			gap: 0; /* No gap, buttons connect */
		}
	}
</style>
