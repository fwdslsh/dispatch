<script>
import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '$lib/shared/utils/socket-events.js';

	let publicUrl = $state(null);
	let socket = null; // Not reactive - doesn't need to be
	let pollInterval = null; // Not reactive - doesn't need to be

	function connectSocket() {
		socket = io({ transports: ['websocket', 'polling'] }); // This is correct for direct socket usage
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

	// Use untrack to prevent creating dependencies on state changes
	$effect(() => {
		connectSocket();
		// Poll every 5 seconds to check for URL updates
		pollInterval = setInterval(pollPublicUrl, 5000);

		// Cleanup function
		return () => {
			if (pollInterval) {
				clearInterval(pollInterval);
				pollInterval = null;
			}
			if (socket) {
				socket.disconnect();
				socket = null;
			}
		};
	});
</script>

{#if publicUrl}
	<div class="public-url-container">
		<!-- <div class="public-url-label">Public URL:</div> -->
		<div class="public-url-wrapper">
			<button class="public-url-link" onclick={openInNewTab} title="Click to open in new tab">
				{publicUrl}
			</button>
			<button
				class="copy-button"
				onclick={copyToClipboard}
				title="Copy to clipboard"
				aria-label="Copy URL to clipboard"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
					<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
				</svg>
			</button>
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

	.public-url-link {
		flex: 1;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--secondary);
		border-radius: 0;
		padding: var(--space-xs) var(--space-md);
		color: var(--text-muted);
		font-family: monospace;
		font-size: 0.8rem;
		text-align: left;
		cursor: pointer;
		transition: all 0.3s ease;
		word-break: break-all;
	}

	.public-url-link:hover {
		background: rgba(255, 255, 255, 0.05);
		border-color: var(--secondary);
		color: var(--secondary);
		transform: none;
		text-shadow:
			0 0 10px var(--secondary),
			0 0 20px var(--secondary-muted);
	}

	.public-url-link:active {
	}

	.copy-button {
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--secondary);
		border-radius: 0;
		border-left: none;
		border-collapse: collapse;
		padding: var(--space-xs);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.3s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		height: 32px;
	}

	.copy-button:hover {
		transform: none;
		color: var(--secondary-muted);
		svg {
			text-shadow:
				0 0 10px var(--secondary),
				0 0 20px var(--secondary-muted);
			filter: drop-shadow(3px 5px 2px rgb(0 0 0 / 0.4));
		}
	}

	.copy-button:active {
	}

	.copy-button svg {
		width: 14px;
		height: 14px;
	}

	@media (max-width: 768px) {
		.public-url-container {
			padding: var(--space-sm);
			margin: 0;
			background: rgba(26, 26, 26, 0.9);
			border: 1px solid rgba(0, 255, 136, 0.15);
			border-radius: 6px;
		}

		.public-url-wrapper {
			flex-direction: row; /* Keep horizontal layout */
			align-items: center;
			gap: 0; /* No gap, buttons connect */
		}

		.public-url-link {
			text-align: left;
			font-size: 0.75rem;
			padding: var(--space-xs);
			white-space: nowrap; /* Prevent wrapping */
			overflow: hidden; /* Hide overflow */
			text-overflow: ellipsis; /* Add ... for long URLs */
			word-break: normal; /* Don't break words */
		}

		.copy-button {
			flex-shrink: 0; /* Prevent button from shrinking */
			margin-top: 0;
		}
	}
</style>
