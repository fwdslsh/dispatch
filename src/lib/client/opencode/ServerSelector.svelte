<script>
	import { onMount } from 'svelte';

	/**
	 * @type {{
	 *   onServerChange?: (url: string) => void,
	 *   compact?: boolean
	 * }}
	 */
	let { onServerChange = () => {}, compact = false } = $props();

	let serverUrl = $state('http://localhost:4096');
	let connected = $state(false);
	let connecting = $state(false);
	let error = $state(null);
	let showInput = $state(false);

	async function loadSavedUrl() {
		try {
			const response = await fetch('/api/opencode/server');
			if (response.ok) {
				const data = await response.json();
				if (data.url) {
					serverUrl = data.url;
					connected = data.running;
					onServerChange(serverUrl);
				}
			}
		} catch (err) {
			console.warn('[ServerSelector] Failed to load server status:', err);
		}
	}

	async function connect() {
		if (!serverUrl.trim()) {
			error = 'Please enter a server URL';
			return;
		}

		try {
			new URL(serverUrl);
		} catch {
			error = 'Invalid URL format';
			return;
		}

		connecting = true;
		error = null;

		try {
			// Save the URL preference
			await fetch('/api/opencode/server', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					hostname: new URL(serverUrl).hostname,
					port: parseInt(new URL(serverUrl).port) || 4096
				})
			});

			connected = true;
			showInput = false;
			onServerChange(serverUrl);
		} catch (err) {
			error = err.message || 'Failed to connect';
		} finally {
			connecting = false;
		}
	}

	function disconnect() {
		connected = false;
		showInput = true;
	}

	function handleKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			connect();
		}
		if (e.key === 'Escape') {
			showInput = false;
		}
	}

	onMount(() => {
		loadSavedUrl();
	});
</script>

<div class="server-selector" class:compact>
	{#if showInput || !connected}
		<div class="input-group">
			<input
				type="url"
				bind:value={serverUrl}
				placeholder="http://localhost:4096"
				onkeydown={handleKeydown}
				disabled={connecting}
				class:error={!!error}
			/>
			<button
				class="connect-btn"
				onclick={connect}
				disabled={connecting || !serverUrl.trim()}
			>
				{connecting ? 'Connecting...' : 'Connect'}
			</button>
		</div>
		{#if error}
			<span class="error-text">{error}</span>
		{/if}
	{:else}
		<button class="server-display" onclick={() => (showInput = true)} title="Click to change server">
			<svg class="server-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<rect x="2" y="2" width="20" height="8" rx="2" ry="2" stroke-width="2" />
				<rect x="2" y="14" width="20" height="8" rx="2" ry="2" stroke-width="2" />
				<line x1="6" y1="6" x2="6.01" y2="6" stroke-width="2" stroke-linecap="round" />
				<line x1="6" y1="18" x2="6.01" y2="18" stroke-width="2" stroke-linecap="round" />
			</svg>
			<span class="server-url">{serverUrl}</span>
			<span class="status-dot" title="Connected"></span>
		</button>
	{/if}
</div>

<style>
	.server-selector {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.server-selector.compact {
		flex-direction: row;
		align-items: center;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	input {
		flex: 1;
		min-width: 0;
		width: 100%;
		padding: var(--space-2) var(--space-3);
		background: var(--bg);
		color: var(--text);
		border: 1px solid var(--primary-dim);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
		transition: all 0.2s ease;
	}

	input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px var(--primary-glow-25);
	}

	input.error {
		border-color: var(--color-error, #c33);
	}

	input:disabled {
		opacity: 0.6;
	}

	.connect-btn {
		padding: var(--space-2) var(--space-4);
		background: var(--primary);
		color: var(--bg);
		border: none;
		border-radius: var(--radius-sm);
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.connect-btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.connect-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-text {
		font-size: 0.75rem;
		color: var(--color-error, #c33);
	}

	.server-display {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--bg-dark);
		border: 1px solid var(--primary-dim);
		border-radius: var(--radius-sm);
		color: var(--text);
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.server-display:hover {
		border-color: var(--primary);
		background: var(--elev);
	}

	.server-icon {
		color: var(--primary);
		flex-shrink: 0;
	}

	.server-url {
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-success, #22c55e);
		flex-shrink: 0;
	}
</style>
