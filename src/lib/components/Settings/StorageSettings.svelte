<script>
	import { onMount } from 'svelte';
	import { Button, ConfirmationDialog } from '$lib/shared/components';
	import { STORAGE_CONFIG } from '$lib/shared/utils/constants.js';
	import {
		IconTrash,
		IconDownload,
		IconUpload,
		IconAlertTriangle,
		IconCheck
	} from '@tabler/icons-svelte';

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

			<div class="usage-overview">
				<div class="usage-bar">
					<div class="usage-fill {usageStatus}" style="width: {storageUsage.percentage}%"></div>
				</div>

				<div class="usage-stats">
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
				<div class="usage-warning">
					<IconAlertTriangle size={20} />
					<span>Storage is nearly full. Consider clearing some data.</span>
				</div>
			{/if}
		</section>

		<!-- Storage Categories -->
		{#if Object.keys(groupedItems).length > 0}
			<section class="settings-section">
				<h4 class="section-title">Storage Breakdown</h4>

				<div class="storage-categories">
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
			</section>
		{/if}

		<!-- Data Management -->
		<section class="settings-section">
			<h4 class="section-title">Data Management</h4>

			<div class="data-actions">
				<div class="action-group">
					<h5>Export & Import</h5>
					<p>Backup or restore your application data</p>
					<div class="action-buttons">
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

			<div class="clear-options">
				<div class="clear-option">
					<div class="option-info">
						<h5>Clear Cache</h5>
						<p>Remove temporary files and cached data</p>
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

				<div class="clear-option">
					<div class="option-info">
						<h5>Clear Sessions</h5>
						<p>Remove all saved session data and history</p>
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

				<div class="clear-option">
					<div class="option-info">
						<h5>Reset Settings</h5>
						<p>Reset all application settings to defaults</p>
					</div>
					<Button
						onclick={() => clearStorage('settings')}
						variant="ghost"
						size="small"
						disabled={loading}
					>
						<IconTrash size={16} />
						Reset Settings
					</Button>
				</div>

				<div class="clear-option dangerous">
					<div class="option-info">
						<h5>Clear All Data</h5>
						<p>Remove ALL local storage data - use with caution!</p>
					</div>
					<Button
						onclick={() => clearStorage('all')}
						variant="ghost"
						size="small"
						disabled={loading}
						class="danger-button"
					>
						<IconTrash size={16} />
						Clear All
					</Button>
				</div>
			</div>
		</section>
	</div>

	<!-- Status Messages -->
	{#if statusMessage}
		<div
			class="status-message"
			class:success={statusMessage.includes('success') ||
				statusMessage.includes('Cleared') ||
				statusMessage.includes('Imported') ||
				statusMessage.includes('Exported')}
		>
			{statusMessage}
		</div>
	{/if}
</div>

<!-- Confirmation Dialog -->
<ConfirmationDialog
	bind:show={showClearConfirm}
	title="Confirm Storage Clear"
	message={getClearMessage(clearType)}
	confirmText="Clear Storage"
	dangerous={clearType === 'all'}
	onconfirm={confirmClearStorage}
/>

<style>
	.storage-settings {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: var(--space-4);
	}

	.settings-header {
		border-bottom: 1px solid var(--primary-dim);
		padding-bottom: var(--space-4);
	}

	.settings-title {
		font-family: var(--font-mono);
		font-size: 1.4rem;
		color: var(--primary);
		margin: 0 0 var(--space-2) 0;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.settings-description {
		color: var(--text-muted);
		margin: 0;
		font-size: 0.9rem;
	}

	.settings-content {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.settings-section {
		border: 1px solid var(--primary-dim);
		border-radius: 4px;
		padding: var(--space-4);
		background: rgba(46, 230, 107, 0.02);
	}

	.section-title {
		font-family: var(--font-mono);
		font-size: 1.1rem;
		color: var(--text-primary);
		margin: 0 0 var(--space-4) 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid var(--primary-dim);
		padding-bottom: var(--space-2);
	}

	/* Storage Usage */
	.usage-overview {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.usage-bar {
		height: 8px;
		background: var(--bg-dark);
		border: 1px solid var(--primary-dim);
		border-radius: 4px;
		overflow: hidden;
		position: relative;
	}

	.usage-fill {
		height: 100%;
		transition: width 0.3s ease;
	}

	.usage-fill.normal {
		background: var(--primary);
	}

	.usage-fill.warning {
		background: var(--accent-amber);
	}

	.usage-fill.critical {
		background: var(--accent-red);
	}

	.usage-stats {
		display: flex;
		gap: var(--space-6);
		flex-wrap: wrap;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.stat-label {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.stat-value {
		font-family: var(--font-mono);
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.stat-value.warning {
		color: var(--accent-amber);
	}

	.stat-value.critical {
		color: var(--accent-red);
	}

	.usage-warning {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		background: rgba(255, 187, 0, 0.1);
		border: 1px solid var(--accent-amber);
		border-radius: 4px;
		color: var(--accent-amber);
		font-size: 0.9rem;
	}

	/* Storage Categories */
	.storage-categories {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.category-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-2) var(--space-3);
		background: var(--bg-dark);
		border: 1px solid var(--primary-dim);
		border-radius: 2px;
	}

	.category-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.category-name {
		font-family: var(--font-mono);
		font-size: 0.9rem;
		color: var(--text-primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.category-count {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.category-size {
		font-family: var(--font-mono);
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--primary);
	}

	/* Data Management */
	.data-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.action-group h5 {
		font-family: var(--font-mono);
		font-size: 1rem;
		color: var(--text-primary);
		margin: 0 0 var(--space-2) 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.action-group p {
		margin: 0 0 var(--space-3) 0;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.action-buttons {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	/* Clear Options */
	.clear-options {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.clear-option {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: var(--space-3);
		border: 1px solid var(--primary-dim);
		border-radius: 4px;
		background: rgba(46, 230, 107, 0.02);
	}

	.clear-option.dangerous {
		border-color: var(--accent-red);
		background: rgba(255, 59, 74, 0.05);
	}

	.option-info {
		flex: 1;
		margin-right: var(--space-4);
	}

	.option-info h5 {
		font-family: var(--font-mono);
		font-size: 0.95rem;
		color: var(--text-primary);
		margin: 0 0 var(--space-2) 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.option-info p {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	:global(.danger-button) {
		color: var(--accent-red) !important;
		border-color: var(--accent-red) !important;
	}

	:global(.danger-button:hover) {
		background: rgba(255, 59, 74, 0.1) !important;
	}

	.status-message {
		padding: var(--space-3);
		border-radius: 4px;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		background: rgba(255, 59, 74, 0.1);
		border: 1px solid var(--accent-red);
		color: var(--accent-red);
		margin-top: var(--space-4);
	}

	.status-message.success {
		background: rgba(46, 230, 107, 0.1);
		border-color: var(--primary);
		color: var(--primary);
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.usage-stats {
			gap: var(--space-4);
		}

		.clear-option {
			flex-direction: column;
			gap: var(--space-3);
		}

		.option-info {
			margin-right: 0;
		}

		.action-buttons {
			flex-direction: column;
		}
	}
</style>
