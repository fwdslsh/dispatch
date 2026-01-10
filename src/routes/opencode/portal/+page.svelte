<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import Shell from '$lib/client/shared/components/Shell.svelte';
	import WorkspaceHeader from '$lib/client/shared/components/workspace/WorkspaceHeader.svelte';
	import StatusBar from '$lib/client/shared/components/StatusBar.svelte';
	import OpenCodeServerManager from '$lib/server/opencode/OpenCodeServerManager.js';

	let opencodeUrl = $state('http://localhost:4096');
	let loading = $state(true);
	let error = $state(null);
	let iframeLoaded = $state(false);

	async function loadOpenCodeUrl() {
		if (!browser) return;

		try {
			const response = await fetch('/api/opencode/server/status');
			if (response.ok) {
				const status = await response.json();
				if (status.running && status.url) {
					opencodeUrl = status.url;
				}
			}
		} catch (err) {
			console.warn('[OpenCode Portal] Failed to fetch server status, using default URL:', err.message);
		}
	}

	function handleLogout() {
		window.location.href = '/login';
	}

	function handleIframeLoad() {
		loading = false;
		iframeLoaded = true;
	}

	function handleIframeError() {
		loading = false;
		error = 'Failed to load OpenCode interface. Please ensure the OpenCode server is running.';
	}

	onMount(async () => {
		await loadOpenCodeUrl();
	});
</script>

<svelte:head>
	<title>OpenCode Portal - Dispatch</title>
	<meta name="description" content="OpenCode AI-powered development interface" />
</svelte:head>

<Shell>
	{#snippet header()}
		<WorkspaceHeader onLogout={handleLogout} viewMode="opencode-portal" />
	{/snippet}

	<div class="opencode-portal-page">
		{#if loading && !iframeLoaded}
			<div class="loading-overlay">
				<div class="loading-content">
					<div class="spinner"></div>
					<p>Connecting to OpenCode...</p>
					<span class="loading-url">{opencodeUrl}</span>
				</div>
			</div>
		{/if}

		{#if error}
			<div class="error-container">
				<div class="error-content">
					<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<circle cx="12" cy="12" r="10" stroke-width="2" />
						<path d="M12 8v4m0 4h.01" stroke-width="2" stroke-linecap="round" />
					</svg>
					<h2>Connection Failed</h2>
					<p>{error}</p>
					<div class="error-url">Expected: {opencodeUrl}</div>
					<button class="retry-btn" onclick={() => { loading = true; error = null; loadOpenCodeUrl(); }}>
						Retry Connection
					</button>
				</div>
			</div>
		{:else}
			<iframe
				src={opencodeUrl}
				title="OpenCode Interface"
				class="opencode-iframe"
				class:loaded={iframeLoaded}
				onload={handleIframeLoad}
				onerror={handleIframeError}
				sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
			></iframe>
		{/if}
	</div>

	{#snippet footer()}
		<StatusBar />
	{/snippet}
</Shell>

<style>
	.opencode-portal-page {
		height: 100%;
		width: 100%;
		position: relative;
		background: var(--bg-dark);
		overflow: hidden;
	}

	.opencode-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--bg-dark);
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.opencode-iframe.loaded {
		opacity: 1;
	}

	.loading-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-dark);
		z-index: 10;
	}

	.loading-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-4);
		color: var(--text-secondary);
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid var(--border-primary);
		border-top-color: var(--primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-content p {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: 500;
		color: var(--text-primary);
	}

	.loading-url {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--text-muted);
		padding: var(--space-2) var(--space-4);
		background: var(--surface);
		border-radius: var(--radius-sm);
	}

	.error-container {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-8);
	}

	.error-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-4);
		max-width: 400px;
	}

	.error-content svg {
		color: var(--color-error, #c33);
		opacity: 0.7;
	}

	.error-content h2 {
		margin: 0;
		font-size: var(--font-size-xl);
		font-weight: 600;
		color: var(--text-primary);
	}

	.error-content p {
		margin: 0;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.error-url {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--text-muted);
		padding: var(--space-2) var(--space-4);
		background: var(--surface);
		border-radius: var(--radius-sm);
	}

	.retry-btn {
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-6);
		background: var(--primary);
		color: var(--bg);
		border: none;
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.retry-btn:hover {
		box-shadow: var(--shadow-md);
	}

	@media (max-width: 768px) {
		.loading-content,
		.error-content {
			padding: var(--space-4);
		}
	}
</style>
