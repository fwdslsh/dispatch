<script>
	import { onMount } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	import { settingsService } from '$lib/client/shared/services/SettingsService.js';

	/**
	 * Workspace Environment Variables Settings Component
	 * Manages workspace-level environment variables that apply to all sessions
	 */

	// Environment variables state - array of {key, value} objects for easy editing
	let envVariables = $state([]);

	// Feedback state
	let saveStatus = $state('');
	let saving = $state(false);

	// Load settings on mount
	onMount(async () => {
		// Wait for settings service to load
		if (!settingsService.isLoaded) {
			await settingsService.loadServerSettings();
		}

		// Load workspace environment variables using the get method
		const envVarsObject = settingsService.get('workspace.envVariables', {});

		// Convert object to array format for editing
		envVariables = Object.entries(envVarsObject).map(([key, value]) => ({ key, value }));

		// Add an empty row if none exist
		if (envVariables.length === 0) {
			envVariables.push({ key: '', value: '' });
		}
	});

	// Add a new environment variable row
	function addEnvVariable() {
		envVariables.push({ key: '', value: '' });
	}

	// Remove an environment variable row
	function removeEnvVariable(index) {
		envVariables.splice(index, 1);
		// Ensure at least one empty row exists
		if (envVariables.length === 0) {
			envVariables.push({ key: '', value: '' });
		}
	}

	// Save environment variables
	async function saveEnvVariables() {
		if (saving) return;

		saving = true;
		saveStatus = '';

		try {
			// Filter out empty entries and convert to object
			const envVarsObject = {};
			envVariables
				.filter(({ key, value }) => key.trim() !== '')
				.forEach(({ key, value }) => {
					envVarsObject[key.trim()] = value;
				});

			// Save to server
			const response = await fetch('/api/settings/workspace', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					envVariables: envVarsObject
				})
			});

			if (!response.ok) {
				throw new Error(`Server error: ${response.status}`);
			}

			// Update settings service cache
			await settingsService.loadServerSettings();

			saveStatus = 'Environment variables saved successfully';
			setTimeout(() => {
				saveStatus = '';
			}, 3000);
		} catch (error) {
			console.error('Failed to save environment variables:', error);
			saveStatus = 'Failed to save environment variables';
			setTimeout(() => {
				saveStatus = '';
			}, 5000);
		} finally {
			saving = false;
		}
	}

	// Reset to defaults
	function resetToDefaults() {
		envVariables = [{ key: '', value: '' }];
		saveStatus = '';
	}

	// Handle key input validation
	function validateEnvVarKey(key) {
		// Environment variable names should be valid identifiers
		return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
	}
</script>

<div class="workspace-env-settings flex-col gap-4">
	<header class="settings-header">
		<h3>Workspace Environment Variables</h3>
		<p class="settings-description">
			Define environment variables that will be available to all sessions (PTY, Claude, etc.) in
			this workspace. These variables are merged with system environment variables, with
			session-specific variables taking highest precedence.
		</p>
	</header>

	<div class="env-variables-section flex-col gap-3">
		<div class="section-header flex-between">
			<h4>Environment Variables</h4>
			<Button onclick={addEnvVariable} variant="ghost" size="small">+ Add Variable</Button>
		</div>

		<div class="env-variables-list flex-col gap-2">
			{#each envVariables as envVar, index}
				<div class="env-variable-row flex gap-2 align-center">
					<div class="env-key-input flex-1">
						<Input
							bind:value={envVar.key}
							placeholder="Variable name (e.g., NODE_ENV, API_KEY)"
							class="env-input {envVar.key && !validateEnvVarKey(envVar.key) ? 'invalid' : ''}"
						/>
						{#if envVar.key && !validateEnvVarKey(envVar.key)}
							<span class="validation-error">Invalid variable name</span>
						{/if}
					</div>

					<span class="env-equals">=</span>

					<div class="env-value-input flex-1">
						<Input bind:value={envVar.value} placeholder="Value" class="env-input" />
					</div>

					<Button
						onclick={() => removeEnvVariable(index)}
						variant="ghost"
						size="small"
						disabled={envVariables.length === 1}
						aria-label="Remove environment variable"
					>
						✕
					</Button>
				</div>
			{/each}
		</div>

		<div class="env-help">
			<h5>Examples:</h5>
			<ul>
				<li><code>NODE_ENV</code> = <code>development</code></li>
				<li><code>API_KEY</code> = <code>your-api-key-here</code></li>
				<li><code>DEBUG</code> = <code>app:*</code></li>
			</ul>
		</div>
	</div>

	<!-- Actions -->
	<footer class="settings-footer flex-between gap-4">
		<div
			class="save-status"
			class:success={saveStatus.includes('success')}
			class:error={saveStatus.includes('Failed')}
		>
			{saveStatus}
		</div>
		<div class="flex gap-3">
			<Button onclick={resetToDefaults} variant="ghost" size="small" disabled={saving}>
				Reset
			</Button>
			<Button onclick={saveEnvVariables} disabled={saving}>
				{saving ? 'Saving...' : 'Save Changes'}
			</Button>
		</div>
	</footer>
</div>

<style>
	.workspace-env-settings {
		height: 100%;
		overflow-y: auto;
		padding: var(--space-4);
	}

	.settings-header h3 {
		color: var(--primary);
		font-weight: 700;
		margin-bottom: var(--space-2);
	}

	.settings-description {
		color: var(--primary-muted);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.section-header h4 {
		color: var(--primary);
		font-weight: 600;
		margin: 0;
	}

	.env-variable-row {
		padding: var(--space-2);
		border: 1px solid var(--primary-dim);
		border-radius: var(--radius-sm);
		background: var(--surface-secondary);
	}

	.env-equals {
		color: var(--primary-muted);
		font-weight: 600;
		min-width: 20px;
		text-align: center;
	}

	.env-input {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
	}

	.env-input.invalid {
		border-color: var(--error);
	}

	.validation-error {
		color: var(--error);
		font-size: var(--text-xs);
		margin-top: var(--space-1);
		display: block;
	}

	.env-help {
		padding: var(--space-3);
		background: var(--surface-tertiary);
		border-radius: var(--radius-sm);
		border: 1px solid var(--primary-dim);
	}

	.env-help h5 {
		color: var(--primary);
		font-size: var(--text-sm);
		font-weight: 600;
		margin: 0 0 var(--space-2) 0;
	}

	.env-help ul {
		margin: 0;
		padding-left: var(--space-4);
		color: var(--primary-muted);
		font-size: var(--text-sm);
	}

	.env-help li {
		margin-bottom: var(--space-1);
	}

	.env-help code {
		background: var(--surface-secondary);
		padding: 2px 4px;
		border-radius: 2px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}

	.settings-footer {
		margin-top: auto;
		padding-top: var(--space-4);
		border-top: 1px solid var(--primary-dim);
	}

	.save-status {
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.save-status.success {
		color: var(--success);
	}

	.save-status.error {
		color: var(--error);
	}
</style>
