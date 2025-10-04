<script>
	import { onMount } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import ConfirmationDialog from '$lib/client/shared/components/ConfirmationDialog.svelte';
	import { STORAGE_CONFIG } from '$lib/shared/constants.js';
	import IconTrash from '$lib/client/shared/components/Icons/IconTrash.svelte';
	import IconDownload from '$lib/client/shared/components/Icons/IconDownload.svelte';
	import IconUpload from '$lib/client/shared/components/Icons/IconUpload.svelte';
	import IconAlertTriangle from '$lib/client/shared/components/Icons/IconAlertTriangle.svelte';
	import IconCheck from '$lib/client/shared/components/Icons/IconCheck.svelte';

	/**
	 * Storage Settings Component
	 * Manages local storage, data export/import, and storage cleanup
	 */

	// Storage state
	let storageUsage = $state({
		used: 0,
		available: 0,
		percentage: 0,
		items: []
	});

	// UI state
	let showClearConfirm = $state(false);
	let clearType = $state('all'); // 'all' | 'sessions' | 'settings' | 'cache'
	let loading = $state(false);
	let statusMessage = $state('');

	// Load storage information on mount
	onMount(() => {
		calculateStorageUsage();
	});

	// Calculate current localStorage usage
	function calculateStorageUsage() {
		try {
			let totalSize = 0;
			const items = [];

			// Iterate through all localStorage items
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key) {
					const value = localStorage.getItem(key);
					const size = new Blob([value || '']).size;
					totalSize += size;

					// Categorize storage items
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

			// Sort by size (largest first)
			items.sort((a, b) => b.size - a.size);

			// Estimate available space (5MB typical localStorage limit)
			const estimatedLimit = 5 * 1024 * 1024; // 5MB
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

	// Format bytes to human readable
	function formatBytes(bytes) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	// Group storage items by category
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

	// Calculate category totals
	function getCategoryTotal(category) {
		return groupedItems[category]?.reduce((total, item) => total + item.size, 0) || 0;
	}

	// Clear specific storage type
	function clearStorage(type) {
		clearType = type;
		showClearConfirm = true;
	}

	// Confirm and execute storage clearing
	async function confirmClearStorage() {
		loading = true;
		statusMessage = '';

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

			statusMessage = `Cleared ${clearedCount} storage items`;
			calculateStorageUsage();

			// Auto-clear status after 3 seconds
			setTimeout(() => {
				statusMessage = '';
			}, 3000);
		} catch (error) {
			console.error('Failed to clear storage:', error);
			statusMessage = 'Failed to clear storage';
		} finally {
			loading = false;
			showClearConfirm = false;
		}
	}

	// Export storage data
	function exportData() {
		try {
			const exportData = {
				timestamp: new Date().toISOString(),
				version: '1.0',
				data: {}
			};

			// Export all localStorage data
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key) {
					exportData.data[key] = localStorage.getItem(key);
				}
			}

			// Create and download file
			const blob = new Blob([JSON.stringify(exportData, null, 2)], {
				type: 'application/json'
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `dispatch-data-${new Date().toISOString().split('T')[0]}.json`;
			a.click();
			URL.revokeObjectURL(url);

			statusMessage = 'Data exported successfully';
			setTimeout(() => {
				statusMessage = '';
			}, 3000);
		} catch (error) {
			console.error('Failed to export data:', error);
			statusMessage = 'Failed to export data';
		}
	}

	// Import storage data
	function importData() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = handleImportFile;
		input.click();
	}

	// Handle import file selection
	async function handleImportFile(event) {
		const file = event.target.files?.[0];
		if (!file) return;

		loading = true;
		statusMessage = '';

		try {
			const text = await file.text();
			const importData = JSON.parse(text);

			if (!importData.data || typeof importData.data !== 'object') {
				throw new Error('Invalid import file format');
			}

			// Import data
			let importedCount = 0;
			for (const [key, value] of Object.entries(importData.data)) {
				localStorage.setItem(key, value);
				importedCount++;
			}

			statusMessage = `Imported ${importedCount} storage items`;
			calculateStorageUsage();

			setTimeout(() => {
				statusMessage = '';
			}, 3000);
		} catch (error) {
			console.error('Failed to import data:', error);
			statusMessage = 'Failed to import data - invalid file format';
		} finally {
			loading = false;
		}
	}

	// Refresh storage calculation
	function refreshStorage() {
		calculateStorageUsage();
		statusMessage = 'Storage usage refreshed';
		setTimeout(() => {
			statusMessage = '';
		}, 2000);
	}

	// Get confirmation message for clear type
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

	// Get status color based on usage percentage
	const usageStatus = $derived(() => {
		if (storageUsage.percentage > 80) return 'critical';
		if (storageUsage.percentage > 60) return 'warning';
		return 'normal';
	});
</script>

<div class="storage-settings">
	<header class="settings-header">
		<h3 class="settings-title">Storage Management</h3>
		<p class="settings-description">
			Manage local storage, export your data, and clear cached information.
		</p>
	</header>

	<div class="settings-content">
		<!-- Storage Usage Overview -->
		<section class="settings-section">
			<h4 class="section-title">Storage Usage</h4>

			<div class="flex flex-col gap-4">
				<div class="usage-bar">
					<div class="usage-fill {usageStatus}" style="width: {storageUsage.percentage}%"></div>
				</div>

				<div class="flex gap-6 flex-wrap">
					<div class="stat">
						<span class="stat-label">Used:</span>
						<span class="stat-value">{formatBytes(storageUsage.used)}</span>
					</div>
					<div class="stat">
						<span class="stat-label">Percentage:</span>
						<span class="stat-value {usageStatus}">{storageUsage.percentage.toFixed(1)}%</span>
					</div>
					<div class="stat">
						<span class="stat-label">Items:</span>
						<span class="stat-value">{storageUsage.items.length}</span>
					</div>
				</div>

				<Button
					onclick={refreshStorage}
					variant="ghost"
					size="small"
					title="Refresh storage calculation"
				>
					<IconCheck size={16} />
					Refresh
				</Button>
			</div>

			{#if storageUsage.percentage > 80}
				<div class="usage-warning flex gap-3">
					<IconAlertTriangle size={20} />
					<span>Storage is nearly full. Consider clearing some data.</span>
				</div>
			{/if}
		</section>

		<!-- Storage Categories -->
		{#if Object.keys(groupedItems).length > 0}
			<section class="settings-section">
				<h4 class="section-title">Storage Breakdown</h4>

				<div class="flex-col">
					{#each Object.entries(groupedItems) as [category, items]}
						<div class="category-row flex flex-between">
							<div class="flex flex-col gap-1">
								<span class="category-name">{category}</span>
								<span class="category-count">{items.length} items</span>
							</div>
							<div class="category-size">
								{formatBytes(getCategoryTotal(category))}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Data Management -->
		<section class="settings-section">
			<h4 class="section-title">Data Management</h4>

			<div class="flex-col gap-4">
				<div class="action-group">
					<h5>Export & Import</h5>
					<p>Backup or restore your application data</p>
					<div class="flex gap-3 flex-wrap">
						<Button onclick={exportData} variant="ghost" size="small" disabled={loading}>
							<IconDownload size={16} />
							Export Data
						</Button>
						<Button onclick={importData} variant="ghost" size="small" disabled={loading}>
							<IconUpload size={16} />
							Import Data
						</Button>
					</div>
				</div>
			</div>
		</section>

		<!-- Clear Storage Options -->
		<section class="settings-section">
			<h4 class="section-title">Clear Storage</h4>

			<div class="flex-col">
				<div class="clear-option flex flex-between">
					<div class="flex flex-col gap-1">
						<span class="clear-title">Clear All Data</span>
						<p class="clear-description">
							Removes all stored data including settings, sessions, and cached assets.
						</p>
					</div>
					<Button
						onclick={() => clearStorage('all')}
						variant="ghost"
						size="small"
						disabled={loading}
					>
						<IconTrash size={16} />
						Clear All
					</Button>
				</div>

				<div class="clear-option flex flex-between">
					<div class="flex flex-col gap-1">
						<span class="clear-title">Clear Sessions</span>
						<p class="clear-description">Deletes session history and cached session data.</p>
					</div>
					<Button
						onclick={() => clearStorage('sessions')}
						variant="ghost"
						size="small"
						disabled={loading}
					>
						<IconTrash size={16} />
						Clear Sessions
					</Button>
				</div>

				<div class="clear-option flex flex-between">
					<div class="flex flex-col gap-1">
						<span class="clear-title">Clear Settings</span>
						<p class="clear-description">Resets application settings to their defaults.</p>
					</div>
					<Button
						onclick={() => clearStorage('settings')}
						variant="ghost"
						size="small"
						disabled={loading}
					>
						<IconTrash size={16} />
						Clear Settings
					</Button>
				</div>

				<div class="clear-option flex flex-between">
					<div class="flex flex-col gap-1">
						<span class="clear-title">Clear Cache</span>
						<p class="clear-description">Clears cached workspace and terminal data.</p>
					</div>
					<Button
						onclick={() => clearStorage('cache')}
						variant="ghost"
						size="small"
						disabled={loading}
					>
						<IconTrash size={16} />
						Clear Cache
					</Button>
				</div>
			</div>
		</section>
	</div>

	<footer class="settings-footer">
		<div
			class="status-message"
			class:success={statusMessage.includes('successfully') || statusMessage.includes('refreshed')}
			class:error={statusMessage.includes('Failed')}
			role={statusMessage ? 'status' : undefined}
		>
			{statusMessage}
		</div>
	</footer>

	<ConfirmationDialog
		open={showClearConfirm}
		title="Confirm Storage Clear"
		message={getClearMessage(clearType)}
		onCancel={() => (showClearConfirm = false)}
		onConfirm={confirmClearStorage}
		confirmLabel="Clear"
		confirmTone="danger"
		{loading}
	/>
</div>

<style>
	@import '$lib/client/shared/styles/settings.css';

	:global(.storage-settings .settings-content) {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.storage-settings {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.settings-header {
		border-bottom: 1px solid var(--primary-glow-30);
		padding-bottom: var(--space-4);
		margin-bottom: var(--space-4);
	}

	.settings-title {
		font-family: var(--font-mono);
		font-size: var(--font-size-4);
		color: var(--primary);
		margin: 0 0 var(--space-2) 0;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		text-shadow: 0 0 8px var(--primary-glow);
	}

	.settings-description {
		color: var(--muted);
		margin: 0;
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
	}

	.settings-section {
		background: var(--bg);
		padding: var(--space-5);
		border-radius: var(--radius-lg);
		border: 1px solid var(--primary-glow-20);
		box-shadow: 0 0 15px var(--primary-glow-10);
	}

	.section-title {
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: var(--font-size-1);
		margin-bottom: var(--space-3);
		color: var(--primary);
	}

	/* Storage usage bar */
	.usage-bar {
		width: 100%;
		height: 12px;
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

	/* Stats display */
	.stat {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.stat-label {
		font-size: var(--font-size-0);
		color: var(--muted);
		font-family: var(--font-mono);
	}

	.stat-value {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--text);
		font-weight: 600;
	}

	.stat-value.warning {
		color: var(--warn);
	}

	.stat-value.critical {
		color: var(--err);
	}

	/* Usage warning alert */
	.usage-warning {
		margin-top: var(--space-3);
		padding: var(--space-3);
		border-radius: var(--radius-xs);
		background: var(--err-dim);
		border: 1px solid var(--err);
		color: var(--err);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	/* Category breakdown */
	.category-row {
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--line);
	}

	.category-row:last-child {
		border-bottom: none;
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

	/* Action groups */
	.action-group h5 {
		margin: 0 0 var(--space-2) 0;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: var(--font-size-1);
		color: var(--primary);
	}

	.action-group p {
		margin: 0 0 var(--space-4) 0;
		color: var(--muted);
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
	}

	/* Clear options */
	.clear-option {
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--line);
	}

	.clear-option:last-child {
		border-bottom: none;
	}

	.clear-title {
		font-weight: 600;
		font-family: var(--font-mono);
		color: var(--text);
	}

	.clear-description {
		margin: 0;
		font-size: var(--font-size-1);
		color: var(--muted);
		font-family: var(--font-mono);
	}

	/* Footer */
	.settings-footer {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--primary-glow-20);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.status-message {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--muted);
		min-height: 24px;
	}

	.status-message.success {
		color: var(--ok);
	}

	.status-message.error {
		color: var(--err);
	}

	/* Utility classes for flex layout */
	.flex {
		display: flex;
	}

	.flex-col {
		flex-direction: column;
	}

	.flex-between {
		justify-content: space-between;
	}

	.flex-wrap {
		flex-wrap: wrap;
	}

	.gap-1 {
		gap: var(--space-1);
	}

	.gap-3 {
		gap: var(--space-3);
	}

	.gap-4 {
		gap: var(--space-4);
	}

	.gap-6 {
		gap: var(--space-6);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.settings-section {
			padding: var(--space-4);
		}

		.clear-option {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-3);
		}

		.settings-footer {
			flex-direction: column;
			gap: var(--space-3);
			align-items: flex-start;
		}
	}
</style>
