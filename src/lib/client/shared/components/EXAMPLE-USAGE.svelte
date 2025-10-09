<script>
	/**
	 * Settings Component Library - Example Usage
	 * Demonstrates all shared components in a realistic settings page
	 */

	import StatusBadge from './StatusBadge.svelte';
	import MetricCard from './MetricCard.svelte';
	import InfoBox from './InfoBox.svelte';
	import SettingsFormSection from './SettingsFormSection.svelte';
	import EmptyState from './EmptyState.svelte';
	import Button from './Button.svelte';
	import Input from './Input.svelte';

	// Example state
	let serverStatus = 'active';
	let sessionCount = 12;
	let storageUsed = '1.2 MB';
	let activeConnections = 8;
	let customThemes = [];
	let apiKey = '';
	let saveStatus = '';

	function handleSave() {
		saveStatus = 'success';
		setTimeout(() => (saveStatus = ''), 3000);
	}

	function handleUploadTheme() {
		console.log('Upload theme clicked');
	}
</script>

<!-- Example 1: System Status Section -->
<SettingsFormSection
	title="System Status"
	subtitle="View current system metrics and health"
	variant="card"
>
	<!-- Status indicator -->
	<div class="flex items-center gap-2">
		<span class="form-label">Server Status:</span>
		<StatusBadge variant={serverStatus}>
			{serverStatus === 'active' ? 'Running' : 'Stopped'}
		</StatusBadge>
	</div>

	<!-- Metrics grid -->
	<div class="metric-grid">
		<MetricCard value={sessionCount} label="Total Sessions" description="Across all workspaces" />
		<MetricCard value={storageUsed} label="Storage Used" description="Browser local storage" />
		<MetricCard
			value={activeConnections}
			label="Active Connections"
			description="WebSocket clients"
		/>
	</div>

	<!-- Info box -->
	<InfoBox variant="info">
		Metrics are updated in real-time. Storage is limited to 10MB per domain in most browsers.
	</InfoBox>
</SettingsFormSection>

<div class="settings-divider"></div>

<!-- Example 2: Configuration Section -->
<SettingsFormSection title="API Configuration" subtitle="Configure external API access">
	<!-- Form fields using CSS classes -->
	<div class="form-group">
		<label class="form-label form-label--required">API Key</label>
		<Input type="password" bind:value={apiKey} placeholder="Enter your API key" />
		<span class="form-description">Your API key is stored securely in local storage</span>
	</div>

	<div class="form-group">
		<label class="form-label">Provider URL</label>
		<Input type="url" placeholder="https://api.example.com" />
		<span class="form-description">Optional: Override the default API endpoint</span>
	</div>

	<!-- Warning box -->
	<InfoBox variant="warning" title="Security Notice">
		API keys are stored locally in your browser. Clearing browser data will remove them.
	</InfoBox>
</SettingsFormSection>

<div class="settings-divider"></div>

<!-- Example 3: Theme Section with Empty State -->
<SettingsFormSection title="Custom Themes" subtitle="Upload and manage custom color themes">
	{#if customThemes.length === 0}
		<EmptyState
			icon="🎨"
			title="No Custom Themes"
			message="Upload a JSON theme file to get started"
		>
			<Button variant="primary" onclick={handleUploadTheme}>Upload Theme</Button>
		</EmptyState>
	{:else}
		<!-- Theme list would go here -->
		<div class="flex flex-col gap-3">
			{#each customThemes as theme}
				<div class="flex items-center justify-between p-3 bg-surface">
					<span>{theme.name}</span>
					<Button variant="ghost" size="sm">Remove</Button>
				</div>
			{/each}
		</div>
	{/if}

	<InfoBox variant="success">
		<strong>Tip:</strong> Export your current theme from Settings → Theme → Export to create a custom
		theme file.
	</InfoBox>
</SettingsFormSection>

<div class="settings-divider"></div>

<!-- Example 4: Advanced Options (Collapsed/Expanded Pattern) -->
<SettingsFormSection title="Advanced Options" subtitle="Power user settings">
	<div class="form-group">
		<label class="form-label">Debug Mode</label>
		<label class="flex items-center gap-2">
			<input type="checkbox" />
			<span class="text-sm">Enable verbose logging</span>
		</label>
		<span class="form-description">Logs will be visible in browser console</span>
	</div>

	<div class="form-group">
		<label class="form-label">Connection Timeout</label>
		<Input type="number" value="30000" />
		<span class="form-description">Timeout in milliseconds (default: 30000)</span>
	</div>

	<!-- Error state example -->
	<InfoBox variant="error">
		<strong>Validation Error:</strong> Timeout must be between 1000 and 60000 milliseconds.
	</InfoBox>
</SettingsFormSection>

<!-- Settings footer with save status -->
<div class="settings-footer">
	{#if saveStatus}
		<div class="settings-footer__status settings-footer__status--{saveStatus}">
			{saveStatus === 'success' ? '✓ Changes saved successfully' : ''}
		</div>
	{:else}
		<div class="settings-footer__status"></div>
	{/if}

	<div class="settings-footer__actions">
		<Button variant="ghost">Reset to Defaults</Button>
		<Button variant="primary" onclick={handleSave}>Save Changes</Button>
	</div>
</div>

<style>
	/* Component uses shared CSS from settings.css - no custom styles needed! */
	/* All spacing, colors, and layout come from design tokens */
</style>
