<script>
	import { onMount, getContext } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import ConfirmationDialog from '$lib/client/shared/components/ConfirmationDialog.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	import { STORAGE_CONFIG } from '$lib/shared/constants.js';
	import { RetentionPolicyViewModel } from '$lib/client/state/RetentionPolicyViewModel.svelte.js';
	import IconTrash from '$lib/client/shared/components/Icons/IconTrash.svelte';
	import IconDownload from '$lib/client/shared/components/Icons/IconDownload.svelte';
	import IconUpload from '$lib/client/shared/components/Icons/IconUpload.svelte';
	import IconAlertTriangle from '$lib/client/shared/components/Icons/IconAlertTriangle.svelte';
	import IconCheck from '$lib/client/shared/components/Icons/IconCheck.svelte';
	import MetricCard from '$lib/client/shared/components/MetricCard.svelte';
	import InfoBox from '$lib/client/shared/components/InfoBox.svelte';
	import SettingsFormSection from '$lib/client/shared/components/SettingsFormSection.svelte';

	/**
	 * Data Management Component
	 * Combines browser storage management and server-side data retention policies
	 */

	// === Browser Storage State ===
	let storageUsage = $state({
		used: 0,
		available: 0,
		percentage: 0,
		items: []
	});

	let showClearConfirm = $state(false);
	let clearType = $state('all');
	let storageLoading = $state(false);
	let storageStatusMessage = $state('');

	// === Data Retention State ===
	const serviceContainer = getContext('services');
	let viewModel = $state(null);

	// === Initialize ===

	onMount(async () => {
		// Initialize browser storage
		calculateStorageUsage();

		// Initialize retention policy
		try {
			if (!serviceContainer) {
				throw new Error('Service container not available');
			}

			const settingsService = await serviceContainer.get('settingsService');
			if (!settingsService) {
				throw new Error('Settings service not available');
			}

			// Create RetentionPolicyViewModel with SettingsService
			// Note: authKey parameter removed - API uses session cookies
			viewModel = new RetentionPolicyViewModel(settingsService);
			await viewModel.loadPolicy();
		} catch (error) {
			console.error('Failed to initialize retention settings:', error);
		}
	});

	// === Browser Storage Functions ===

	function calculateStorageUsage() {
		try {
			let totalSize = 0;
			const items = [];

			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key) {
					const value = localStorage.getItem(key);
					const size = new Blob([value || '']).size;
					totalSize += size;

					let category = 'other';
					if (key.includes('dispatch-session')) category = 'sessions';
					else if (key.includes('dispatch-settings') || key.includes('dispatch-theme'))
						category = 'settings';
					else if (key.includes('dispatch-projects') || key.includes('dispatch-workspace'))
						category = 'workspace';
					else if (key.includes('dispatch-terminal')) category = 'terminal';
					else if (key.includes('dispatch')) category = 'app';

					items.push({
						key,
						size,
						category,
						sizeFormatted: formatBytes(size)
					});
				}
			}

			items.sort((a, b) => b.size - a.size);

			const estimatedLimit = 5 * 1024 * 1024;
			const percentage = Math.min((totalSize / estimatedLimit) * 100, 100);

			storageUsage = {
				used: totalSize,
				available: estimatedLimit - totalSize,
				percentage,
				items
			};
		} catch (error) {
			console.error('Failed to calculate storage usage:', error);
			storageUsage = {
				used: 0,
				available: 0,
				percentage: 0,
				items: []
			};
		}
	}

	function formatBytes(bytes) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	const groupedItems = $derived(() => {
		const groups = {};
		storageUsage.items.forEach((item) => {
			if (!groups[item.category]) {
				groups[item.category] = [];
			}
			groups[item.category].push(item);
		});
		return groups;
	});

	function getCategoryTotal(category) {
		return groupedItems[category]?.reduce((total, item) => total + item.size, 0) || 0;
	}

	function clearStorage(type) {
		clearType = type;
		showClearConfirm = true;
	}

	async function confirmClearStorage() {
		storageLoading = true;
		storageStatusMessage = '';

		try {
			let clearedCount = 0;

			switch (clearType) {
				case 'all':
					localStorage.clear();
					clearedCount = storageUsage.items.length;
					break;

				case 'sessions':
					storageUsage.items
						.filter((item) => item.category === 'sessions')
						.forEach((item) => {
							localStorage.removeItem(item.key);
							clearedCount++;
						});
					break;

				case 'settings':
					storageUsage.items
						.filter((item) => item.category === 'settings')
						.forEach((item) => {
							localStorage.removeItem(item.key);
							clearedCount++;
						});
					break;

				case 'cache':
					storageUsage.items
						.filter((item) => ['workspace', 'terminal', 'other'].includes(item.category))
						.forEach((item) => {
							localStorage.removeItem(item.key);
							clearedCount++;
						});
					break;
			}

			storageStatusMessage = `Cleared ${clearedCount} storage items`;
			calculateStorageUsage();

			setTimeout(() => {
				storageStatusMessage = '';
			}, 3000);
		} catch (error) {
			console.error('Failed to clear storage:', error);
			storageStatusMessage = 'Failed to clear storage';
		} finally {
			storageLoading = false;
			showClearConfirm = false;
		}
	}

	function exportData() {
		try {
			const exportData = {
				timestamp: new Date().toISOString(),
				version: '1.0',
				data: {}
			};

			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key) {
					exportData.data[key] = localStorage.getItem(key);
				}
			}

			const blob = new Blob([JSON.stringify(exportData, null, 2)], {
				type: 'application/json'
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `dispatch-data-${new Date().toISOString().split('T')[0]}.json`;
			a.click();
			URL.revokeObjectURL(url);

			storageStatusMessage = 'Data exported successfully';
			setTimeout(() => {
				storageStatusMessage = '';
			}, 3000);
		} catch (error) {
			console.error('Failed to export data:', error);
			storageStatusMessage = 'Failed to export data';
		}
	}

	function importData() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = handleImportFile;
		input.click();
	}

	async function handleImportFile(event) {
		const file = event.target.files?.[0];
		if (!file) return;

		storageLoading = true;
		storageStatusMessage = '';

		try {
			const text = await file.text();
			const importData = JSON.parse(text);

			if (!importData.data || typeof importData.data !== 'object') {
				throw new Error('Invalid import file format');
			}

			let importedCount = 0;
			for (const [key, value] of Object.entries(importData.data)) {
				localStorage.setItem(key, value);
				importedCount++;
			}

			storageStatusMessage = `Imported ${importedCount} storage items`;
			calculateStorageUsage();

			setTimeout(() => {
				storageStatusMessage = '';
			}, 3000);
		} catch (error) {
			console.error('Failed to import data:', error);
			storageStatusMessage = 'Failed to import data - invalid file format';
		} finally {
			storageLoading = false;
		}
	}

	function refreshStorage() {
		calculateStorageUsage();
		storageStatusMessage = 'Storage usage refreshed';
		setTimeout(() => {
			storageStatusMessage = '';
		}, 2000);
	}

	function getClearMessage(type) {
		switch (type) {
			case 'all':
				return 'This will permanently delete ALL local data including settings, sessions, and workspace history. This action cannot be undone.';
			case 'sessions':
				return 'This will delete all saved session data and history. Active sessions will not be affected.';
			case 'settings':
				return 'This will reset all application settings to defaults.';
			case 'cache':
				return 'This will clear cached data and temporary files. Settings and sessions will be preserved.';
			default:
				return 'Are you sure you want to proceed?';
		}
	}

	const usageStatus = $derived(() => {
		if (storageUsage.percentage > 80) return 'critical';
		if (storageUsage.percentage > 60) return 'warning';
		return 'normal';
	});

	// === Data Retention Functions ===

	async function handleSave(e) {
		e.preventDefault();
		if (!viewModel) return;
		try {
			await viewModel.savePolicy();
		} catch (error) {
			console.error('Failed to save retention policy:', error);
		}
	}

	async function handlePreview() {
		if (!viewModel) return;
		await viewModel.generatePreview();
	}

	function handleResetToDefaults() {
		if (!viewModel) return;
		viewModel.resetToDefaults();
	}

	function handleResetToOriginal() {
		if (!viewModel) return;
		viewModel.resetToOriginal();
	}

	function getValidationError(field) {
		if (!viewModel) return null;
		if (field === 'sessionDays') {
			if (viewModel.sessionDays < 1) return 'Minimum 1 day';
			if (viewModel.sessionDays > 365) return 'Maximum 365 days';
		}
		if (field === 'logDays') {
			if (viewModel.logDays < 1) return 'Minimum 1 day';
			if (viewModel.logDays > 90) return 'Maximum 90 days';
		}
		return null;
	}
</script>

<div class="data-management">
	<header class="settings-header">
		<h3 class="settings-title">Data & Storage</h3>
		<p class="settings-description">
			Manage browser storage, data retention policies, and backup/restore settings.
		</p>
	</header>

	<div>
		<!-- Browser Storage Section -->
		<section class="settings-section">
			<div class="section-header">
				<h4 class="section-title">Browser Storage</h4>
				<p class="section-subtitle">
					Manages local browser data (settings, session history, cache). This data is stored in your
					browser and persists between visits.
				</p>
			</div>

			<!-- Storage Usage -->
			<div class="subsection">
				<h5 class="subsection-title">Current Usage</h5>

				<div class="usage-bar">
					<div class="usage-fill {usageStatus}" style="width: {storageUsage.percentage}%"></div>
				</div>

				<div class="metric-grid">
					<MetricCard value={formatBytes(storageUsage.used)} label="Used" />
					<MetricCard value="{storageUsage.percentage.toFixed(1)}%" label="Usage" />
					<MetricCard value={storageUsage.items.length} label="Items" />
				</div>

				{#if storageUsage.percentage > 80}
					<InfoBox variant="warning">Storage is nearly full. Consider clearing some data.</InfoBox>
				{/if}

				<Button onclick={refreshStorage} variant="ghost" size="small">
					<IconCheck size={16} />
					Refresh
				</Button>
			</div>

			<!-- Storage Breakdown -->
			{#if Object.keys(groupedItems).length > 0}
				<div class="subsection">
					<h5 class="subsection-title">Breakdown by Category</h5>

					{#each Object.entries(groupedItems) as [category, items]}
						<div class="category-row">
							<div class="category-info">
								<span class="category-name">{category}</span>
								<span class="category-count">{items.length} items</span>
							</div>
							<div class="category-size">
								{formatBytes(getCategoryTotal(category))}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Export/Import -->
			<div class="subsection">
				<h5 class="subsection-title">Backup & Restore</h5>
				<p class="subsection-description">
					Export your browser data to a file or restore from a previous backup.
				</p>

				<div class="button-group">
					<Button onclick={exportData} variant="ghost" size="small" disabled={storageLoading}>
						<IconDownload size={16} />
						Export Data
					</Button>
					<Button onclick={importData} variant="ghost" size="small" disabled={storageLoading}>
						<IconUpload size={16} />
						Import Data
					</Button>
				</div>
			</div>

			<!-- Clear Storage -->
			<div class="subsection">
				<h5 class="subsection-title">Clear Browser Data</h5>
				<p class="subsection-description">Remove specific types of browser data.</p>

				<div class="clear-options">
					<div class="clear-option">
						<div class="clear-info">
							<span class="clear-title">All Data</span>
							<p class="clear-description">
								Removes all stored data including settings, sessions, and cached assets.
							</p>
						</div>
						<Button
							onclick={() => clearStorage('all')}
							variant="ghost"
							size="small"
							disabled={storageLoading}
						>
							<IconTrash size={16} />
							Clear All
						</Button>
					</div>

					<div class="clear-option">
						<div class="clear-info">
							<span class="clear-title">Sessions</span>
							<p class="clear-description">Deletes session history and cached session data.</p>
						</div>
						<Button
							onclick={() => clearStorage('sessions')}
							variant="ghost"
							size="small"
							disabled={storageLoading}
						>
							<IconTrash size={16} />
							Clear
						</Button>
					</div>

					<div class="clear-option">
						<div class="clear-info">
							<span class="clear-title">Settings</span>
							<p class="clear-description">Resets application settings to their defaults.</p>
						</div>
						<Button
							onclick={() => clearStorage('settings')}
							variant="ghost"
							size="small"
							disabled={storageLoading}
						>
							<IconTrash size={16} />
							Clear
						</Button>
					</div>

					<div class="clear-option">
						<div class="clear-info">
							<span class="clear-title">Cache</span>
							<p class="clear-description">Clears cached workspace and terminal data.</p>
						</div>
						<Button
							onclick={() => clearStorage('cache')}
							variant="ghost"
							size="small"
							disabled={storageLoading}
						>
							<IconTrash size={16} />
							Clear
						</Button>
					</div>
				</div>
			</div>

			{#if storageStatusMessage}
				<div
					class="status-message"
					class:success={storageStatusMessage.includes('successfully') ||
						storageStatusMessage.includes('refreshed')}
					class:error={storageStatusMessage.includes('Failed')}
				>
					{storageStatusMessage}
				</div>
			{/if}
		</section>

		<!-- Data Retention Section -->
		<section class="settings-section">
			<div class="section-header">
				<h4 class="section-title">Server Data Retention</h4>
				<p class="section-subtitle">
					Controls how long session data and logs are kept in the database before automatic cleanup.
					This affects server storage, not browser data.
				</p>
			</div>

			{#if !viewModel || viewModel.isLoading}
				<div class="loading-indicator">
					<div class="spinner"></div>
					<span>Loading retention policy...</span>
				</div>
			{:else}
				<form class="retention-form" onsubmit={handleSave}>
					<!-- Session Retention -->
					<div class="form-group">
						<label for="session-days" class="form-label">
							Session Data Retention
							<span class="form-help">Number of days to keep completed session data</span>
						</label>
						<div class="input-group">
							<input
								id="session-days"
								type="number"
								class="form-input"
								class:error={getValidationError('sessionDays')}
								bind:value={viewModel.sessionDays}
								min="1"
								max="365"
								required
							/>
							<span class="input-suffix">days</span>
						</div>
						{#if getValidationError('sessionDays')}
							<div class="error-text">{getValidationError('sessionDays')}</div>
						{/if}
					</div>

					<!-- Log Retention -->
					<div class="form-group">
						<label for="log-days" class="form-label">
							Log Retention
							<span class="form-help">Number of days to keep application log entries</span>
						</label>
						<div class="input-group">
							<input
								id="log-days"
								type="number"
								class="form-input"
								class:error={getValidationError('logDays')}
								bind:value={viewModel.logDays}
								min="1"
								max="90"
								required
							/>
							<span class="input-suffix">days</span>
						</div>
						{#if getValidationError('logDays')}
							<div class="error-text">{getValidationError('logDays')}</div>
						{/if}
					</div>

					<!-- Auto Cleanup -->
					<div class="form-group">
						<label class="checkbox-container">
							<input type="checkbox" bind:checked={viewModel.autoCleanup} />
							<span class="checkmark"></span>
							<span class="checkbox-label">
								Enable automatic cleanup
								<span class="form-help"
									>Automatically delete old data based on retention policy</span
								>
							</span>
						</label>
					</div>

					<!-- Preview -->
					<div class="preview-section">
						<Button
							type="button"
							variant="secondary"
							onclick={handlePreview}
							disabled={!viewModel.isValid || viewModel.isGeneratingPreview}
							loading={viewModel.isGeneratingPreview}
						>
							{viewModel.isGeneratingPreview ? 'Generating Preview...' : 'Preview Changes'}
						</Button>

						{#if viewModel.previewSummary}
							<div class="preview-result">
								<h6>Preview Summary</h6>
								<p>{viewModel.previewSummary}</p>
							</div>
						{/if}
					</div>

					<!-- Actions -->
					<div class="form-actions">
						<Button
							type="button"
							variant="ghost"
							size="small"
							onclick={handleResetToDefaults}
							disabled={viewModel.isSaving}
						>
							Reset to Defaults
						</Button>

						{#if viewModel.hasChanges}
							<Button
								type="button"
								variant="ghost"
								size="small"
								onclick={handleResetToOriginal}
								disabled={viewModel.isSaving}
							>
								Discard Changes
							</Button>
						{/if}

						<Button
							type="submit"
							variant="primary"
							size="small"
							disabled={!viewModel.canSave}
							loading={viewModel.isSaving}
						>
							{viewModel.isSaving ? 'Saving...' : 'Save Policy'}
						</Button>
					</div>
				</form>

				<!-- Retention Errors/Warnings -->
				{#if viewModel.error}
					<InfoBox variant="error" title="Error">
						{viewModel.error}
					</InfoBox>
				{/if}

				{#if viewModel.hasChanges}
					<InfoBox variant="warning" title="Unsaved Changes">
						You have unsaved changes to your retention policy.
					</InfoBox>
				{/if}
			{/if}
		</section>
	</div>

	<ConfirmationDialog
		open={showClearConfirm}
		title="Confirm Storage Clear"
		message={getClearMessage(clearType)}
		onCancel={() => (showClearConfirm = false)}
		onConfirm={confirmClearStorage}
		confirmLabel="Clear"
		confirmTone="danger"
		loading={storageLoading}
	/>
</div>

<style>
	.section-subtitle {
		color: var(--muted);
		margin: 0;
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
		line-height: 1.5;
	}

	.subsection {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.subsection-title {
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: var(--font-size-1);
		margin: 0;
		color: var(--text);
	}

	.subsection-description {
		color: var(--muted);
		margin: 0;
		font-size: var(--font-size-0);
		font-family: var(--font-mono);
	}

	/* Storage Usage */
	.usage-bar {
		width: 100%;
		height: var(--font-size-0);
		background: color-mix(in oklab, var(--text) 5%, transparent);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.usage-fill {
		height: 100%;
		border-radius: var(--radius-full);
		transition: width 0.3s ease;
	}

	.usage-fill.normal {
		background: linear-gradient(90deg, var(--primary-glow-60) 0%, var(--primary) 100%);
	}

	.usage-fill.warning {
		background: linear-gradient(
			90deg,
			color-mix(in oklab, var(--warn) 60%, transparent) 0%,
			var(--warn) 100%
		);
	}

	.usage-fill.critical {
		background: linear-gradient(
			90deg,
			color-mix(in oklab, var(--err) 60%, transparent) 0%,
			var(--err) 100%
		);
	}

	/* Usage bar remains component-specific */

	/* Categories */
	.category-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--line);
	}

	.category-row:last-child {
		border-bottom: none;
	}

	.category-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.category-name {
		font-weight: 600;
		text-transform: capitalize;
		font-family: var(--font-mono);
		color: var(--text);
	}

	.category-count {
		font-size: var(--font-size-0);
		color: var(--muted);
		font-family: var(--font-mono);
	}

	.category-size {
		font-family: var(--font-mono);
		color: var(--primary);
		font-weight: 600;
	}

	/* Buttons */
	.button-group {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	/* Clear Options */
	.clear-options {
		display: flex;
		flex-direction: column;
	}

	.clear-option {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--line);
	}

	.clear-option:last-child {
		border-bottom: none;
	}

	.clear-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.clear-title {
		font-weight: 600;
		font-family: var(--font-mono);
		color: var(--text);
	}

	.clear-description {
		margin: 0;
		font-size: var(--font-size-0);
		color: var(--muted);
		font-family: var(--font-mono);
	}

	/* Retention Form */
	.retention-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.form-label {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--text);
		font-weight: 500;
	}

	.form-help {
		display: block;
		font-size: var(--font-size-0);
		color: var(--muted);
		margin-top: var(--space-1);
		font-weight: normal;
	}

	.input-group {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.form-input {
		flex: 1;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--bg);
		color: var(--text);
		font-family: var(--font-mono);
	}

	.form-input.error {
		border-color: var(--err);
	}

	.input-suffix {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--muted);
	}

	.error-text {
		color: var(--err);
		font-size: var(--font-size-0);
		font-family: var(--font-mono);
	}

	.checkbox-container {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
	}

	.checkbox-label {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--text);
	}

	.preview-section {
		margin: var(--space-4) 0;
		padding: var(--space-4);
		background: var(--surface-primary-98);
		border: 1px solid var(--primary-glow-15);
		border-radius: var(--radius-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.preview-result {
		padding: var(--space-3);
		background: var(--elev);
		border-radius: var(--radius-xs);
		border-left: 3px solid var(--primary);
	}

	.preview-result h6 {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--primary);
		margin: 0 0 var(--space-2) 0;
	}

	.preview-result p {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--text);
		margin: 0;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--line);
	}

	/* Messages */
	.status-message {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		padding: var(--space-2);
	}

	.status-message.success {
		color: var(--ok);
	}

	.status-message.error {
		color: var(--err);
	}

	.loading-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		padding: var(--space-6);
		color: var(--muted);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.clear-option {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-3);
		}

		.form-actions {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
