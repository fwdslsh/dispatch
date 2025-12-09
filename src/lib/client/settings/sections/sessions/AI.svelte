<script>
	import { onMount } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import LoadingSpinner from '$lib/client/shared/components/LoadingSpinner.svelte';
	import ErrorDisplay from '$lib/client/shared/components/ErrorDisplay.svelte';
	import IconCloudCheck from '$lib/client/shared/components/Icons/IconCloudCheck.svelte';
	import IconCloudX from '$lib/client/shared/components/Icons/IconCloudX.svelte';
	import AISettings from '$lib/client/ai/AISettings.svelte';
	import { getAuthHeaders } from '$lib/shared/api-helpers.js';
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
	let serverStatus = $state(null);
	let serverLoading = $state(false);
	let serverError = $state('');
	let statusMessage = $state('');

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
		if (!settingsService.isLoaded) {
			await settingsService.loadServerSettings();
		}
		updateSettingsFromService();
	});

	function updateSettingsFromService() {
		settings = {
			baseUrl: settingsService.get('ai.baseUrl', 'http://localhost:4096'),
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

	async function checkServerStatus() {
		try {
			const response = await fetch('/api/opencode/server', {
				headers: getAuthHeaders()
			});
			if (response.ok) {
				serverStatus = await response.json();
				if (serverStatus.port !== undefined) {
					serverConfig.port = serverStatus.port;
				}
				if (serverStatus.enabled !== undefined) {
					serverConfig.autoStart = serverStatus.enabled;
				}
			}
		} catch (error) {
			log.error('Failed to check server status:', error);
		}
	}

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
				statusMessage = 'OpenCode server started';
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
				statusMessage = 'OpenCode server stopped';
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

	async function updateServerConfig() {
		if (configSaving) return;
		configSaving = true;
		serverError = '';

		try {
			const response = await fetch('/api/opencode/server', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
				body: JSON.stringify({
					port: serverConfig.port,
					enabled: serverConfig.autoStart
				})
			});
			if (response.ok) {
				serverStatus = await response.json();
				statusMessage = 'Configuration saved';
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

<div class="ai-settings-section">
	<div class="section-header">
		<h3>AI ASSISTANT</h3>
		<p class="section-description">
			Configure AI-powered coding assistance. Powered by OpenCode for intelligent code generation,
			analysis, and refactoring.
		</p>
	</div>

	<!-- OpenCode Server Management -->
	<h4>OPENCODE SERVER</h4>
	<p class="subsection-description">Manage the OpenCode server that powers AI sessions.</p>

	{#if serverStatus}
		{#if serverStatus.error && serverStatus.status === 'error'}
			<div class="error-banner">
				<ErrorDisplay message={serverStatus.error} />
				<p class="help-text">Update the port and try again.</p>
			</div>
		{/if}

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
			</div>

			<div class="form-group">
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={serverConfig.autoStart} disabled={configSaving} />
					<span>Auto-start when Dispatch loads</span>
				</label>
			</div>

			<div class="config-actions">
				<Button
					onclick={updateServerConfig}
					variant="primary"
					size="small"
					disabled={configSaving || (serverStatus.running && serverStatus.status === 'running')}
					loading={configSaving}
				>
					Save Configuration
				</Button>
			</div>
		</div>

		{#if statusMessage}
			<div class="status-message">{statusMessage}</div>
		{/if}

		<div class="server-controls">
			<div class="server-status">
				<div class="status-indicator" class:active={serverStatus.running}></div>
				<span>
					{serverStatus.running ? 'Running' : 'Stopped'}
					{#if serverStatus.url}
						- {serverStatus.url}{/if}
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
			<ErrorDisplay message={serverError} />
		{/if}
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

	.status-indicator {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--text-muted);
	}

	.status-indicator.active {
		background: var(--primary);
		box-shadow: 0 0 8px var(--primary-glow);
	}

	.status-message {
		padding: var(--space-2) var(--space-3);
		background: color-mix(in oklab, var(--primary) 10%, transparent);
		border-radius: var(--radius);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		margin-bottom: var(--space-3);
	}

	.error-banner {
		background: var(--surface);
		border: 1px solid var(--error);
		border-radius: var(--radius);
		padding: var(--space-3);
		margin-bottom: var(--space-3);
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
