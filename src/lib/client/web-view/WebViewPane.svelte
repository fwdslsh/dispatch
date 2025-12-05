<script>
	import { onMount, onDestroy } from 'svelte';
	import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';

	// Props
	let { sessionId, workspacePath = '' } = $props();

	// State
	let currentUrl = $state('');
	let inputUrl = $state('');
	let iframeElement = $state(null);
	let loading = $state(false);
	let error = $state(null);

	// Initialize session
	onMount(async () => {
		try {
			// Attach to the session
			await runSessionClient.attach(sessionId);

			// Listen for navigation events from server
			runSessionClient.on('web-view:navigation', handleNavigationEvent);
			runSessionClient.on('web-view:system', handleSystemEvent);
			runSessionClient.on('web-view:error', handleErrorEvent);
		} catch (err) {
			console.error('[WebViewPane] Failed to initialize:', err);
			error = err.message;
		}
	});

	onDestroy(() => {
		runSessionClient.off('web-view:navigation', handleNavigationEvent);
		runSessionClient.off('web-view:system', handleSystemEvent);
		runSessionClient.off('web-view:error', handleErrorEvent);
	});

	function handleNavigationEvent(event) {
		if (event.payload?.url) {
			currentUrl = event.payload.url;
			inputUrl = event.payload.url;
		}
	}

	function handleSystemEvent(event) {
		console.log('[WebViewPane] System event:', event);
		if (event.type === 'initialized' && event.payload?.initialUrl) {
			currentUrl = event.payload.initialUrl;
			inputUrl = event.payload.initialUrl;
		}
	}

	function handleErrorEvent(event) {
		console.error('[WebViewPane] Error event:', event);
		error = event.payload?.message || 'Unknown error';
	}

	function navigateToUrl() {
		if (!inputUrl.trim()) return;

		let url = inputUrl.trim();

		// Add protocol if missing
		if (!url.match(/^https?:\/\//i)) {
			url = 'http://' + url;
		}

		// Validate URL format
		try {
			new URL(url);
		} catch (err) {
			error = 'Invalid URL format';
			return;
		}

		loading = true;
		error = null;

		// Send navigation command to server
		const command = JSON.stringify({ type: 'navigate', url });
		runSessionClient.sendInput(sessionId, command);

		// Update current URL
		currentUrl = url;
		inputUrl = url;
	}

	function handleKeydown(event) {
		if (event.key === 'Enter') {
			navigateToUrl();
		}
	}

	function handleIframeLoad() {
		loading = false;
	}

	function handleIframeError() {
		loading = false;
		error = 'Failed to load URL. The site may block iframe embedding or the URL may be invalid.';
	}

	function goBack() {
		if (iframeElement?.contentWindow) {
			iframeElement.contentWindow.history.back();
		}
	}

	function goForward() {
		if (iframeElement?.contentWindow) {
			iframeElement.contentWindow.history.forward();
		}
	}

	function refresh() {
		if (iframeElement) {
			loading = true;
			error = null;
			iframeElement.src = currentUrl;
		}
	}
</script>

<div class="web-view-container">
	<!-- Address Bar -->
	<div class="address-bar">
		<div class="nav-buttons">
			<button class="nav-button" onclick={goBack} title="Go back" disabled={loading}> ← </button>
			<button class="nav-button" onclick={goForward} title="Go forward" disabled={loading}>
				→
			</button>
			<button class="nav-button" onclick={refresh} title="Refresh" disabled={loading}> ↻ </button>
		</div>
		<input
			type="text"
			class="url-input"
			placeholder="Enter URL (e.g., http://localhost:5173 or https://example.com)"
			bind:value={inputUrl}
			onkeydown={handleKeydown}
			disabled={loading}
		/>
		<button class="go-button" onclick={navigateToUrl} disabled={loading || !inputUrl.trim()}>
			Go
		</button>
	</div>

	<!-- Error Display -->
	{#if error}
		<div class="error-banner">
			<span class="error-icon">⚠</span>
			<span class="error-text">{error}</span>
			<button class="error-close" onclick={() => (error = null)}>×</button>
		</div>
	{/if}

	<!-- Loading Indicator -->
	{#if loading}
		<div class="loading-overlay">
			<div class="loading-spinner"></div>
			<span>Loading...</span>
		</div>
	{/if}

	<!-- Web View Content -->
	<div class="iframe-container">
		{#if currentUrl}
			<iframe
				bind:this={iframeElement}
				src={currentUrl}
				title="Web View"
				class="web-iframe"
				onload={handleIframeLoad}
				onerror={handleIframeError}
				sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
			></iframe>
		{:else}
			<div class="empty-state">
				<div class="empty-icon">🌐</div>
				<h3>Web View</h3>
				<p>Enter a URL in the address bar above to get started</p>
				<p class="example-text">Try: http://localhost:5173</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.web-view-container {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		background: var(--bg-primary);
		overflow: hidden;
	}

	.address-bar {
		display: flex;
		gap: 8px;
		padding: 12px;
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-color);
		align-items: center;
	}

	.nav-buttons {
		display: flex;
		gap: 4px;
	}

	.nav-button {
		width: 32px;
		height: 32px;
		padding: 0;
		border: 1px solid var(--border-color);
		background: var(--bg-primary);
		color: var(--text-primary);
		border-radius: 4px;
		cursor: pointer;
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.nav-button:hover:not(:disabled) {
		background: var(--bg-hover);
		border-color: var(--accent-color);
	}

	.nav-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.url-input {
		flex: 1;
		height: 32px;
		padding: 0 12px;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 14px;
		font-family: inherit;
	}

	.url-input:focus {
		outline: none;
		border-color: var(--accent-color);
		box-shadow: 0 0 0 2px var(--accent-color-alpha);
	}

	.url-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.go-button {
		height: 32px;
		padding: 0 16px;
		border: 1px solid var(--accent-color);
		background: var(--accent-color);
		color: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.go-button:hover:not(:disabled) {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}

	.go-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px;
		background: var(--error-bg);
		color: var(--error-text);
		border-bottom: 1px solid var(--error-border);
	}

	.error-icon {
		font-size: 18px;
	}

	.error-text {
		flex: 1;
		font-size: 14px;
	}

	.error-close {
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--error-text);
		font-size: 20px;
		cursor: pointer;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.error-close:hover {
		background: rgba(0, 0, 0, 0.1);
	}

	.loading-overlay {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 24px;
		background: var(--bg-overlay);
		color: var(--text-primary);
		font-size: 14px;
		position: absolute;
		top: 60px;
		left: 0;
		right: 0;
		z-index: 10;
	}

	.loading-spinner {
		width: 24px;
		height: 24px;
		border: 3px solid var(--border-color);
		border-top-color: var(--accent-color);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.iframe-container {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	.web-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: white;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-secondary);
		text-align: center;
		padding: 24px;
	}

	.empty-icon {
		font-size: 64px;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-state h3 {
		margin: 0 0 8px 0;
		font-size: 20px;
		color: var(--text-primary);
	}

	.empty-state p {
		margin: 4px 0;
		font-size: 14px;
	}

	.example-text {
		margin-top: 16px !important;
		font-family: monospace;
		color: var(--accent-color);
		font-size: 13px;
	}
</style>
