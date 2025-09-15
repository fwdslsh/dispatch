<script>
	import { onMount } from 'svelte';

	let showUpdateNotification = $state(false);
	let registration = null;

	onMount(() => {
		if ('serviceWorker' in navigator) {
			// Listen for service worker updates
			navigator.serviceWorker.ready.then((reg) => {
				registration = reg;

				// Check for updates periodically
				setInterval(() => {
					reg.update();
				}, 60000); // Check every minute

				// Listen for new service worker waiting
				reg.addEventListener('updatefound', () => {
					const newWorker = reg.installing;

					newWorker.addEventListener('statechange', () => {
						if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
							// New service worker is ready
							showUpdateNotification = true;
						}
					});
				});
			});

			// Listen for controller change (update activated)
			let refreshing = false;
			navigator.serviceWorker.addEventListener('controllerchange', () => {
				if (!refreshing) {
					refreshing = true;
					window.location.reload();
				}
			});
		}
	});

	function handleUpdate() {
		if (!registration || !registration.waiting) return;

		// Tell the service worker to skip waiting
		registration.waiting.postMessage({ type: 'SKIP_WAITING' });
		showUpdateNotification = false;
	}

	function dismissUpdate() {
		showUpdateNotification = false;
	}
</script>

{#if showUpdateNotification}
	<div class="pwa-update-notification" data-augmented-ui="tl-clip br-clip exe">
		<div class="notification-content">
			<div class="notification-icon">🔄</div>
			<div class="notification-text">
				<h3>Update Available</h3>
				<p>A new version of Dispatch is ready</p>
			</div>
			<div class="notification-actions">
				<button class="update-btn" onclick={handleUpdate} data-augmented-ui="tl-clip br-clip exe">
					Update Now
				</button>
				<button class="dismiss-btn" onclick={dismissUpdate}> Later </button>
			</div>
		</div>
	</div>
{/if}

<style>
	.pwa-update-notification {
		position: fixed;
		top: 20px;
		right: 20px;
		background: rgba(0, 0, 0, 0.95);
		border: 1px solid var(--aug-border-all);
		--aug-border-all: 1px;
		--aug-border-bg: var(--accent-cyan);
		padding: 1rem;
		z-index: 10000;
		max-width: 350px;
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.notification-content {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.notification-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.notification-text {
		flex: 1;
		min-width: 150px;
	}

	.notification-text h3 {
		margin: 0;
		font-size: 1rem;
		color: #00a8ff;
		font-family: 'Exo 2', sans-serif;
	}

	.notification-text p {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: #aaa;
	}

	.notification-actions {
		display: flex;
		gap: 0.5rem;
		width: 100%;
		margin-top: 0.5rem;
	}

	.update-btn,
	.dismiss-btn {
		padding: 0.4rem 0.8rem;
		border: none;
		background: transparent;
		color: white;
		cursor: pointer;
		font-family: 'Share Tech Mono', monospace;
		font-size: 0.85rem;
		transition: all 0.2s ease;
	}

	.update-btn {
		background: #00a8ff;
		--aug-border-all: 1px;
		--aug-border-bg: #00a8ff;
		flex: 1;
	}

	.update-btn:hover {
		filter: brightness(1.2);
	}

	.dismiss-btn {
		color: #777;
	}

	.dismiss-btn:hover {
		color: #aaa;
	}

	@media (max-width: 480px) {
		.pwa-update-notification {
			top: 10px;
			right: 10px;
			left: 10px;
			max-width: none;
		}
	}
</style>
