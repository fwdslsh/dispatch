<script>
	import { onMount } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import LoadingSpinner from '$lib/client/shared/components/LoadingSpinner.svelte';
	import AISettings from '$lib/client/ai/AISettings.svelte';
	import { settingsService } from '$lib/client/shared/services/SettingsService.svelte.js';
	import { createLogger } from '$lib/client/shared/utils/logger.js';

	const log = createLogger('ai-settings');

	/**
	 * AI Settings Section
	 * Settings page section for AI (OpenCode) configuration
	 *
	 * v2.0 Hard Fork: OpenCode-first architecture
	 * @file src/lib/client/settings/sections/sessions/AI.svelte
	 */

	// Server state
	let serverStatus = $state({
		enabled: false,
		running: false,
		status: 'stopped',
		hostname: 'localhost',
		port: 4096,
		url: null,
		error: null
	});
	let serverLoading = $state(true);
	let serverActionLoading = $state(false);
	let serverError = $state(null);

	// Form state for server config
	let configPort = $state(4096);
	let configAutoStart = $state(false);

	// Settings state
	let settings = $state({});
	let saveStatus = $state('');
	let saving = $state(false);

	onMount(async () => {
		// Load server status
		await loadServerStatus();

		// Load AI settings
		if (!settingsService.isLoaded) {
			await settingsService.loadServerSettings();
		}
		updateSettingsFromService();
	});

	async function loadServerStatus() {
		serverLoading = true;
		serverError = null;
		try {
			const response = await fetch('/api/opencode/server');
			if (!response.ok) {
				throw new Error(`Failed to load server status: ${response.statusText}`);
			}
			serverStatus = await response.json();
			configPort = serverStatus.port;
			configAutoStart = serverStatus.enabled;
		} catch (err) {
			serverError = err.message;
			log.error('Failed to load server status:', err);
		} finally {
			serverLoading = false;
		}
	}

	async function startServer() {
		serverActionLoading = true;
		serverError = null;
		try {
			const response = await fetch('/api/opencode/server', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'start',
					port: configPort
				})
			});
			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.error || `Failed to start server: ${response.statusText}`);
			}
			const data = await response.json();
			serverStatus = data.status;
		} catch (err) {
			serverError = err.message;
			log.error('Failed to start server:', err);
		} finally {
			serverActionLoading = false;
		}
	}

	async function stopServer() {
		serverActionLoading = true;
		serverError = null;
		try {
			const response = await fetch('/api/opencode/server', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'stop' })
			});
			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.error || `Failed to stop server: ${response.statusText}`);
			}
			const data = await response.json();
			serverStatus = data.status;
		} catch (err) {
			serverError = err.message;
			log.error('Failed to stop server:', err);
		} finally {
			serverActionLoading = false;
		}
	}

	async function updateServerConfig() {
		serverActionLoading = true;
		serverError = null;
		try {
			const response = await fetch('/api/opencode/server', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					port: configPort,
					enabled: configAutoStart
				})
			});
			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.error || `Failed to update config: ${response.statusText}`);
			}
			const data = await response.json();
			serverStatus = data.status;
			saveStatus = 'Server configuration saved';
			setTimeout(() => {
				saveStatus = '';
			}, 3000);
		} catch (err) {
			serverError = err.message;
			log.error('Failed to update server config:', err);
		} finally {
			serverActionLoading = false;
		}
	}

	function updateSettingsFromService() {
		settings = {
			baseUrl: settingsService.get('ai.baseUrl', `http://localhost:${configPort}`),
			model: settingsService.get('ai.model', 'claude-sonnet-4-20250514'),
			provider: settingsService.get('ai.provider', 'anthropic'),
			timeout: settingsService.get('ai.timeout', 60000),
			maxRetries: settingsService.get('ai.maxRetries', 2)
		};
	}

	async function saveSettings() {
		if (saving) return;
		saving = true;
		saveStatus = '';

		try {
			// Update baseUrl to match server port
			settings.baseUrl = `http://localhost:${configPort}`;

			Object.entries(settings).forEach(([key, value]) => {
				settingsService.setClientOverride(`ai.${key}`, value);
			});
			saveStatus = 'AI settings saved successfully';
			setTimeout(() => {
				saveStatus = '';
			}, 3000);
		} catch (error) {
			saveStatus = 'Failed to save AI settings';
		} finally {
			saving = false;
		}
	}

	async function resetToDefaults() {
		settingsService.resetClientOverridesForCategory('ai');
		updateSettingsFromService();
		saveStatus = 'AI settings reset to defaults';
		setTimeout(() => {
			saveStatus = '';
		}, 3000);
	}

	function getStatusColor(status) {
		switch (status) {
			case 'running':
				return 'var(--color-success, #22c55e)';
			case 'starting':
				return 'var(--color-warning, #f59e0b)';
			case 'error':
				return 'var(--color-error, #ef4444)';
			default:
				return 'var(--text-muted)';
		}
	}
</script>

<div class="ai-settings-section">
	<div class="section-header">
		<h3>AI ASSISTANT</h3>
		<p class="section-description">
			Configure AI-powered coding assistance. Powered by OpenCode for intelligent code generation,
			analysis, and refactoring.
		</p>
	</div>

	<!-- OpenCode Server Controls -->
	<h4>OPENCODE SERVER</h4>
	<p class="subsection-description">
		Manage the OpenCode server that powers AI sessions.
	</p>

	{#if serverLoading}
		<div class="loading-box">
			<LoadingSpinner size="small" />
			<span>Loading server status...</span>
		</div>
	{:else}
		<!-- Server Status -->
		<div class="server-controls">
			<div class="server-status">
				<span
					class="status-indicator"
					class:active={serverStatus.running}
					style="background: {getStatusColor(serverStatus.status)}"
				></span>
				<span class="status-text">
					{#if serverStatus.running}
						Running at <a href={serverStatus.url} target="_blank" rel="noopener">{serverStatus.url}</a>
					{:else if serverStatus.status === 'starting'}
						Starting...
					{:else if serverStatus.status === 'error'}
						Error
					{:else}
						Stopped
					{/if}
				</span>
			</div>
			<div class="server-actions">
				{#if serverStatus.running}
					<Button
						onclick={stopServer}
						variant="ghost"
						size="small"
						disabled={serverActionLoading}
					>
						{serverActionLoading ? 'Stopping...' : 'Stop Server'}
					</Button>
				{:else}
					<Button
						onclick={startServer}
						variant="primary"
						size="small"
						disabled={serverActionLoading}
					>
						{serverActionLoading ? 'Starting...' : 'Start Server'}
					</Button>
				{/if}
			</div>
		</div>

		{#if serverError}
			<div class="error-banner">
				<strong>Error:</strong> {serverError}
			</div>
		{/if}

		{#if serverStatus.error}
			<div class="error-banner">
				<strong>Server Error:</strong> {serverStatus.error}
			</div>
		{/if}

		<!-- Server Configuration -->
		<div class="config-section">
			<div class="form-group">
				<label for="server-port">Server Port</label>
				<input
					id="server-port"
					type="number"
					class="port-input"
					bind:value={configPort}
					min="1024"
					max="65535"
					disabled={serverStatus.running || serverActionLoading}
				/>
				<p class="help-text">
					Port for the OpenCode server (default: 4096). Restart required after changing.
				</p>
			</div>

			<div class="form-group">
				<label class="checkbox-label">
					<input
						type="checkbox"
						bind:checked={configAutoStart}
						disabled={serverActionLoading}
					/>
					<span>Auto-start server when Dispatch starts</span>
				</label>
				<p class="help-text">
					When enabled, the OpenCode server will automatically start when Dispatch launches.
				</p>
			</div>

			<div class="config-actions">
				<Button
					onclick={updateServerConfig}
					variant="ghost"
					size="small"
					disabled={serverActionLoading}
				>
					{serverActionLoading ? 'Saving...' : 'Save Server Config'}
				</Button>
			</div>
		</div>
	{/if}

	<!-- Session Defaults -->
	<h4>SESSION DEFAULTS</h4>
	<p class="subsection-description">Default settings for new AI sessions.</p>

	<AISettings bind:settings mode="global" />

	<footer class="settings-footer">
		<div class="settings-footer__status" class:success={saveStatus.includes('success')}>
			{saveStatus}
		</div>
		<div class="settings-footer__actions">
			<Button onclick={resetToDefaults} variant="ghost" size="small" disabled={saving}>
				Reset Defaults
			</Button>
			<Button
				onclick={saveSettings}
				variant="primary"
				size="small"
				disabled={saving}
				loading={saving}
			>
				Save Settings
			</Button>
		</div>
	</footer>
</div>

<style>
	.ai-settings-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.section-header h3 {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 1rem;
		letter-spacing: 0.1em;
	}

	.section-description,
	.subsection-description {
		margin: var(--space-2) 0;
		color: var(--muted);
		font-size: 0.875rem;
	}

	.loading-box {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4);
		background: var(--bg-panel);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius);
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}

	h4 {
		margin: var(--space-4) 0 var(--space-2);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		letter-spacing: 0.05em;
		color: var(--text);
	}

	.config-section {
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		margin-bottom: var(--space-3);
	}

	.form-group {
		margin-bottom: var(--space-3);
	}

	.form-group label {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--text);
		margin-bottom: var(--space-2);
	}

	.port-input {
		width: 120px;
		padding: var(--space-2) var(--space-3);
		background: var(--bg);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius);
		color: var(--text);
		font-family: var(--font-mono);
	}

	.port-input:focus {
		outline: none;
		border-color: var(--primary);
	}

	.port-input:disabled {
		opacity: 0.5;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
	}

	.checkbox-label input {
		width: 18px;
		height: 18px;
		accent-color: var(--primary);
	}

	.config-actions {
		margin-top: var(--space-3);
	}

	.server-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3);
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius);
		margin-bottom: var(--space-3);
	}

	.server-status {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}

	.server-status a {
		color: var(--primary);
		text-decoration: none;
	}

	.server-status a:hover {
		text-decoration: underline;
	}

	.status-indicator {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--text-muted);
	}

	.status-indicator.active {
		box-shadow: 0 0 8px currentColor;
	}

	.error-banner {
		background: color-mix(in oklab, var(--color-error, #ef4444) 10%, var(--surface));
		border: 1px solid var(--color-error, #ef4444);
		border-radius: var(--radius);
		padding: var(--space-3);
		margin-bottom: var(--space-3);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--text);
	}

	.help-text {
		margin: var(--space-2) 0 0;
		font-size: 0.75rem;
		color: var(--muted);
	}

	.settings-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: var(--space-4);
		border-top: 1px solid var(--surface-border);
		margin-top: var(--space-4);
	}

	.settings-footer__status {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--muted);
	}

	.settings-footer__status.success {
		color: var(--primary);
	}

	.settings-footer__actions {
		display: flex;
		gap: var(--space-2);
	}
</style>
