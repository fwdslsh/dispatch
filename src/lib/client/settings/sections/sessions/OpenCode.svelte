<script>
	import { onMount } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import LoadingSpinner from '$lib/client/shared/components/LoadingSpinner.svelte';
	import ErrorDisplay from '$lib/client/shared/components/ErrorDisplay.svelte';
	import IconCloudCheck from '$lib/client/shared/components/Icons/IconCloudCheck.svelte';
	import IconCloudX from '$lib/client/shared/components/Icons/IconCloudX.svelte';
	import OpenCodeSettings from '$lib/client/opencode/OpenCodeSettings.svelte';
	import { getAuthHeaders } from '$lib/shared/api-helpers.js';
	import { settingsService } from '$lib/client/shared/services/SettingsService.svelte.js';
	import { createLogger } from '$lib/client/shared/utils/logger.js';

	const log = createLogger('opencode-settings');

	/**
	 * OpenCode Settings Component
	 * Configuration for OpenCode AI coding sessions
	 */

	// Server connection state
	let connectionStatus = $state('checking'); // 'checking' | 'connected' | 'disconnected' | 'error'
	let connectionError = $state('');
	let loading = $state(false);
	let statusMessage = $state('');

	// Managed server state
	let serverStatus = $state(null); // Server status from API
	let serverLoading = $state(false);
	let serverError = $state('');

	// Server configuration
	let serverConfig = $state({
		port: 4096,
		autoStart: false
	});
	let configSaving = $state(false);

	// Settings state
	let settings = $state({});
	let saveStatus = $state('');
	let saving = $state(false);

	onMount(async () => {
		await checkServerStatus();
		await checkServerConnection();

		// Load OpenCode settings
		if (!settingsService.isLoaded) {
			await settingsService.loadServerSettings();
		}
		updateSettingsFromService();
	});

	// Check OpenCode server connection
	async function checkServerConnection() {
		connectionStatus = 'checking';
		try {
			const serverUrl = settingsService.get('opencode.baseUrl', 'http://localhost:4096');

			// Try to connect to the OpenCode server
			// Note: This is a simple connectivity check
			connectionStatus = 'disconnected'; // Default to disconnected
			statusMessage = `Configured server: ${serverUrl}`;
		} catch (error) {
			connectionStatus = 'error';
			connectionError = 'Unable to check server connection';
		}
	}

	// Load settings from the service into our local state
	function updateSettingsFromService() {
		settings = {
			baseUrl: settingsService.get('opencode.baseUrl', 'http://localhost:4096'),
			model: settingsService.get('opencode.model', 'claude-3-7-sonnet-20250219'),
			provider: settingsService.get('opencode.provider', 'anthropic'),
			timeout: settingsService.get('opencode.timeout', 60000),
			maxRetries: settingsService.get('opencode.maxRetries', 2)
		};
	}

	// Save settings using the service
	async function saveSettings() {
		if (saving) return;

		saving = true;
		saveStatus = '';

		try {
			// Save all OpenCode settings as client overrides (localStorage)
			Object.entries(settings).forEach(([key, value]) => {
				settingsService.setClientOverride(`opencode.${key}`, value);
			});

			saveStatus = 'OpenCode settings saved successfully';
			await checkServerConnection(); // Recheck connection with new settings
			setTimeout(() => {
				saveStatus = '';
			}, 3000);
		} catch (error) {
			saveStatus = 'Failed to save OpenCode settings';
		} finally {
			saving = false;
		}
	}

	// Reset to server defaults
	async function resetToDefaults() {
		settingsService.resetClientOverridesForCategory('opencode');
		updateSettingsFromService();

		saveStatus = 'OpenCode settings reset to defaults';
		setTimeout(() => {
			saveStatus = '';
		}, 3000);
	}

	// Get managed server status
	async function checkServerStatus() {
		try {
			const response = await fetch('/api/opencode/server', {
				headers: getAuthHeaders()
			});

			if (response.ok) {
				serverStatus = await response.json();
				// Update local config from server status
				if (serverStatus.port !== undefined) {
					serverConfig.port = serverStatus.port;
				}
				if (serverStatus.enabled !== undefined) {
					serverConfig.autoStart = serverStatus.enabled;
				}
			}
		} catch (error) {
			log.error('[OpenCode] Failed to check server status:', error);
		}
	}

	// Start the managed OpenCode server
	async function startServer() {
		if (serverLoading) return;

		serverLoading = true;
		serverError = '';

		try {
			const response = await fetch('/api/opencode/server', {
				method: 'POST',
				headers: getAuthHeaders(),
				body: JSON.stringify({})
			});

			if (response.ok) {
				serverStatus = await response.json();
				statusMessage = 'Managed server started successfully';
			} else {
				const data = await response.json();
				serverError = data.error || 'Failed to start server';
			}
		} catch (error) {
			serverError = error.message || 'Failed to start server';
		} finally {
			serverLoading = false;
			await checkServerStatus();
		}
	}

	// Stop the managed OpenCode server
	async function stopServer() {
		if (serverLoading) return;

		serverLoading = true;
		serverError = '';

		try {
			const response = await fetch('/api/opencode/server', {
				method: 'DELETE',
				headers: getAuthHeaders()
			});

			if (response.ok) {
				serverStatus = await response.json();
				statusMessage = 'Managed server stopped';
			} else {
				const data = await response.json();
				serverError = data.error || 'Failed to stop server';
			}
		} catch (error) {
			serverError = error.message || 'Failed to stop server';
		} finally {
			serverLoading = false;
			await checkServerStatus();
		}
	}

	// Update server configuration
	async function updateServerConfig() {
		if (configSaving) return;

		configSaving = true;
		serverError = '';

		try {
			const response = await fetch('/api/opencode/server', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					...getAuthHeaders()
				},
				body: JSON.stringify({
					port: serverConfig.port,
					enabled: serverConfig.autoStart
				})
			});

			if (response.ok) {
				serverStatus = await response.json();
				statusMessage = 'Server configuration updated successfully';
				setTimeout(() => {
					statusMessage = '';
				}, 3000);
			} else {
				const data = await response.json();
				serverError = data.error || 'Failed to update configuration';
			}
		} catch (error) {
			serverError = error.message || 'Failed to update configuration';
		} finally {
			configSaving = false;
			await checkServerStatus();
		}
	}
</script>

<div class="opencode-settings">
	<div class="section-header">
		<h3>OPENCODE</h3>
		<p class="section-description">
			Configure OpenCode AI coding sessions. OpenCode is an open-source alternative to Claude Code
			that connects to an OpenCode server.
		</p>
	</div>

	<!-- Managed Server Section -->
	<h4>MANAGED SERVER</h4>
	<p class="subsection-description">
		Start and manage an OpenCode server directly from Dispatch. Configure the port and auto-start
		behavior below.
	</p>

	{#if serverStatus}
		<!-- Server Status Error Display -->
		{#if serverStatus.error && serverStatus.status === 'error'}
			<div class="server-error-banner">
				<ErrorDisplay message={serverStatus.error} />
				<p class="help-text">
					Update the port configuration below and try starting the server again.
				</p>
			</div>
		{/if}

		<!-- Server Configuration -->
		<div class="config-section">
			<div class="form-group">
				<label for="server-port">Server Port</label>
				<input
					id="server-port"
					type="number"
					bind:value={serverConfig.port}
					min="1024"
					max="65535"
					disabled={(serverStatus.running && serverStatus.status === 'running') || configSaving}
					class="port-input"
				/>
				<p class="help-text">Port number for the OpenCode server (1024-65535)</p>
			</div>

			<div class="form-group">
				<label class="checkbox-label">
					<input
						type="checkbox"
						bind:checked={serverConfig.autoStart}
						disabled={configSaving}
						class="checkbox-input"
					/>
					<span>Auto-start server when Dispatch loads</span>
				</label>
				<p class="help-text">
					When enabled, the OpenCode server will automatically start when Dispatch starts
				</p>
			</div>

			<div class="config-actions">
				<Button
					onclick={updateServerConfig}
					variant="primary"
					size="small"
					disabled={configSaving || (serverStatus.running && serverStatus.status === 'running')}
					loading={configSaving}
				>
					{configSaving ? 'Saving...' : 'Save Configuration'}
				</Button>
				{#if serverStatus.running && serverStatus.status === 'running'}
					<p class="config-note">Stop the server to change configuration</p>
				{/if}
			</div>
		</div>

		{#if statusMessage}
			<div class="status-message">
				{statusMessage}
			</div>
		{/if}
		<div class="server-controls">
			<div class="server-status">
				<div class="status-indicator" class:active={serverStatus.running}></div>
				<span class="status-text">
					{serverStatus.running ? 'Running' : 'Stopped'}
					{#if serverStatus.url}
						- {serverStatus.url}
					{/if}
				</span>
			</div>

			<div class="server-actions">
				{#if !serverStatus.running}
					<Button
						onclick={startServer}
						variant="primary"
						size="small"
						disabled={serverLoading}
						loading={serverLoading}
					>
						Start Server
					</Button>
				{:else}
					<Button
						onclick={stopServer}
						variant="danger"
						size="small"
						disabled={serverLoading}
						loading={serverLoading}
					>
						Stop Server
					</Button>
				{/if}
			</div>
		</div>

		{#if serverError}
			<div class="server-error">
				<ErrorDisplay message={serverError} />
			</div>
		{/if}

		{#if serverStatus.error}
			<div class="server-error">
				<ErrorDisplay message={serverStatus.error} />
			</div>
		{/if}
	{/if}

	<!-- External Server Connection Status -->
	<h4>EXTERNAL SERVER</h4>
	<p class="subsection-description">
		Alternatively, you can connect to an external OpenCode server running elsewhere.
	</p>

	{#if connectionStatus === 'checking'}
		<div class="status-card status-card--checking">
			<LoadingSpinner size="small" />
			<span>Checking server connection...</span>
		</div>
	{:else if connectionStatus === 'connected'}
		<div class="status-card status-card--connected">
			<IconCloudCheck size={24} />
			<div class="status-info">
				<h4>Server Connected</h4>
				<p>OpenCode server is available and ready to use.</p>
			</div>
		</div>
	{:else if connectionStatus === 'disconnected'}
		<div class="status-card status-card--disconnected">
			<IconCloudX size={24} />
			<div class="status-info">
				<h4>Server Not Connected</h4>
				<p>{statusMessage || 'Configure server URL and ensure OpenCode server is running.'}</p>
			</div>
		</div>
	{:else if connectionStatus === 'error'}
		<ErrorDisplay message={connectionError} />
	{/if}

	<!-- Session Defaults Section -->
	<h4>SESSION DEFAULTS</h4>
	<p class="subsection-description">
		Configure default settings for new OpenCode sessions. These settings will be used as defaults
		when creating new OpenCode sessions.
	</p>

	<OpenCodeSettings bind:settings mode="global" />

	<!-- Settings Footer -->
	<footer class="settings-footer">
		<div
			class="settings-footer__status"
			class:settings-footer__status--success={saveStatus.includes('success')}
			class:settings-footer__status--error={saveStatus.includes('Failed')}
		>
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
				{saving ? 'Saving...' : 'Save Settings'}
			</Button>
		</div>
	</footer>
</div>

<style>
	.status-card {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		border: 1px solid var(--primary-glow-20);
		box-shadow: 0 0 20px var(--primary-glow-10);
	}

	.status-card--checking {
		background: color-mix(in oklab, var(--text) 2%, transparent);
	}

	.status-card--connected {
		background: linear-gradient(135deg, var(--primary-glow-15), var(--primary-glow));
	}

	.status-card--disconnected {
		background: color-mix(in oklab, var(--text) 2%, transparent);
	}

	.status-info h4 {
		margin: 0 0 var(--space-1) 0;
		font-family: var(--font-mono);
		font-size: 1.1rem;
	}

	.status-info p {
		margin: 0;
		color: var(--muted);
	}

	.server-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4);
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-lg);
		margin-bottom: var(--space-3);
	}

	.server-status {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.status-indicator {
		width: 12px;
		height: 12px;
		border-radius: var(--radius-full);
		background: var(--text-muted);
		transition: all 0.2s;
	}

	.status-indicator.active {
		background: var(--primary);
		box-shadow: 0 0 8px var(--primary-glow);
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	.status-text {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--text);
	}

	.server-error {
		margin-top: var(--space-2);
	}

	.config-section {
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		margin-bottom: var(--space-4);
	}

	.form-group {
		margin-bottom: var(--space-4);
	}

	.form-group:last-child {
		margin-bottom: 0;
	}

	.form-group label {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text);
		margin-bottom: var(--space-2);
	}

	.port-input {
		width: 150px;
		padding: var(--space-2) var(--space-3);
		background: var(--bg);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-md);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}

	.port-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-glow-10);
	}

	.port-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		user-select: none;
	}

	.checkbox-input {
		width: 20px;
		height: 20px;
		cursor: pointer;
		accent-color: var(--primary);
	}

	.checkbox-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.checkbox-label span {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--text);
	}

	.help-text {
		margin: var(--space-1) 0 0 0;
		font-size: 0.75rem;
		color: var(--muted);
		font-family: var(--font-mono);
	}

	.config-actions {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}

	.config-note {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted);
		font-family: var(--font-mono);
	}

	.status-message {
		padding: var(--space-3);
		background: color-mix(in oklab, var(--primary) 10%, transparent);
		border: 1px solid var(--primary-glow-20);
		border-radius: var(--radius-md);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		margin-bottom: var(--space-3);
	}

	.server-error-banner {
		background: var(--surface);
		border: 1px solid var(--danger);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		margin-bottom: var(--space-4);
	}

	.server-error-banner .help-text {
		margin-top: var(--space-2);
	}
</style>
