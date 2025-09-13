<script>
	import { onMount } from 'svelte';
	import { Button, Input } from '$lib/shared/components';
	import { STORAGE_CONFIG } from '$lib/shared/utils/constants.js';
	import { IconFolder, IconFolderPlus, IconCheck } from '@tabler/icons-svelte';

	/**
	 * Workspace Settings Component
	 * Manages default working directory and workspace preferences
	 */

	// Workspace state
	let defaultWorkingDirectory = $state('');
	let workspaceRoot = $state('');
	let autoCreateProjects = $state(true);
	let rememberLastWorkspace = $state(true);
	let workspaceHistory = $state([]);

	// UI state
	let saveStatus = $state('');
	let saving = $state(false);
	let browsing = $state(false);

	// Load settings on mount
	onMount(async () => {
		await loadWorkspaceSettings();
		await loadWorkspaceInfo();
	});

	// Load workspace settings from localStorage
	async function loadWorkspaceSettings() {
		try {
			const storedSettings = localStorage.getItem(STORAGE_CONFIG.SETTINGS_KEY);
			if (storedSettings) {
				const settings = JSON.parse(storedSettings);
				defaultWorkingDirectory = settings.defaultWorkingDirectory || '';
				autoCreateProjects = settings.autoCreateProjects ?? true;
				rememberLastWorkspace = settings.rememberLastWorkspace ?? true;
			}

			// Load workspace history
			const historyKey = 'dispatch-workspace-history';
			const storedHistory = localStorage.getItem(historyKey);
			if (storedHistory) {
				workspaceHistory = JSON.parse(storedHistory).slice(0, 10); // Keep last 10
			}
		} catch (error) {
			console.warn('Failed to load workspace settings:', error);
		}
	}

	// Load current workspace information from API
	async function loadWorkspaceInfo() {
		try {
			const response = await fetch('/api/workspaces');
			if (response.ok) {
				const data = await response.json();
				// The API might return current workspace root or other info
				if (data.workspaceRoot) {
					workspaceRoot = data.workspaceRoot;
				}
			}
		} catch (error) {
			console.warn('Failed to load workspace info:', error);
		}
	}

	// Save workspace settings
	async function saveWorkspaceSettings() {
		if (saving) return;

		saving = true;
		saveStatus = '';

		try {
			// Get existing settings or create new
			const existingSettings = JSON.parse(
				localStorage.getItem(STORAGE_CONFIG.SETTINGS_KEY) || '{}'
			);

			// Update workspace-related settings
			const updatedSettings = {
				...existingSettings,
				defaultWorkingDirectory,
				autoCreateProjects,
				rememberLastWorkspace,
				lastUpdated: Date.now()
			};

			localStorage.setItem(STORAGE_CONFIG.SETTINGS_KEY, JSON.stringify(updatedSettings));

			saveStatus = 'Workspace settings saved successfully';
			setTimeout(() => {
				saveStatus = '';
			}, 3000);

		} catch (error) {
			console.error('Failed to save workspace settings:', error);
			saveStatus = 'Failed to save workspace settings';
		} finally {
			saving = false;
		}
	}

	// Browse for directory
	async function browseDirectory() {
		browsing = true;
		try {
			// Use the existing browse API endpoint
			const response = await fetch('/api/browse', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					path: defaultWorkingDirectory || workspaceRoot || '/home',
					action: 'browse'
				})
			});

			if (response.ok) {
				const data = await response.json();
				// For now, we'll just let users type the path manually
				// In a real implementation, this could open a directory picker modal
				saveStatus = 'Use the input field to enter your preferred directory path';
			}
		} catch (error) {
			console.error('Browse failed:', error);
			saveStatus = 'Directory browsing not available - enter path manually';
		} finally {
			browsing = false;
		}
	}

	// Set directory from history
	function setDirectoryFromHistory(path) {
		defaultWorkingDirectory = path;
		saveWorkspaceSettings();
	}

	// Validate directory path
	function validatePath(path) {
		if (!path) return true; // Empty is ok - will use system default
		
		// Basic path validation
		const isAbsolute = path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
		if (!isAbsolute) {
			return 'Path must be absolute (start with / on Unix or C:\\ on Windows)';
		}
		
		return true;
	}

	// Clear workspace history
	function clearHistory() {
		workspaceHistory = [];
		localStorage.removeItem('dispatch-workspace-history');
		saveStatus = 'Workspace history cleared';
		setTimeout(() => {
			saveStatus = '';
		}, 2000);
	}

	// Auto-save when settings change
	$effect(() => {
		if (defaultWorkingDirectory !== undefined) {
			const timeoutId = setTimeout(saveWorkspaceSettings, 1000);
			return () => clearTimeout(timeoutId);
		}
	});

	// Validation
	const pathValidation = $derived(validatePath(defaultWorkingDirectory));
	const isValidPath = $derived(pathValidation === true);
</script>

<div class="workspace-settings">
	<header class="settings-header">
		<h3 class="settings-title">Workspace Settings</h3>
		<p class="settings-description">
			Configure your default working directory and workspace preferences.
		</p>
	</header>

	<div class="settings-content">
		<!-- Default Working Directory -->
		<section class="settings-section">
			<h4 class="section-title">Default Working Directory</h4>
			
			<div class="input-group">
				<label for="working-dir" class="input-label">Directory Path</label>
				<div class="directory-input">
					<Input
						id="working-dir"
						bind:value={defaultWorkingDirectory}
						placeholder={workspaceRoot || '/home/user/projects'}
						class="path-input"
						error={!isValidPath ? pathValidation : ''}
					/>
					<Button
						onclick={browseDirectory}
						variant="ghost"
						size="small"
						disabled={browsing}
						title="Browse directories"
					>
						<IconFolder size={16} />
					</Button>
				</div>
				<p class="input-help">
					Default directory for new projects and workspaces. Leave empty to use system default.
				</p>
				{#if !isValidPath}
					<p class="validation-error">{pathValidation}</p>
				{/if}
			</div>

			{#if workspaceRoot}
				<div class="current-workspace">
					<strong>Current workspace root:</strong> <code>{workspaceRoot}</code>
				</div>
			{/if}
		</section>

		<!-- Workspace History -->
		{#if workspaceHistory.length > 0}
			<section class="settings-section">
				<h4 class="section-title">Recent Workspaces</h4>
				
				<div class="workspace-history">
					{#each workspaceHistory as workspace}
						<div class="history-item">
							<div class="workspace-path">
								<IconFolder size={16} />
								<code>{workspace}</code>
							</div>
							<Button
								onclick={() => setDirectoryFromHistory(workspace)}
								variant="ghost"
								size="small"
								title="Use this directory"
							>
								<IconCheck size={14} />
							</Button>
						</div>
					{/each}
				</div>

				<div class="history-actions">
					<Button
						onclick={clearHistory}
						variant="ghost"
						size="small"
					>
						Clear History
					</Button>
				</div>
			</section>
		{/if}

		<!-- Workspace Behavior -->
		<section class="settings-section">
			<h4 class="section-title">Workspace Behavior</h4>
			
			<div class="input-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={autoCreateProjects}
						class="checkbox-input"
					>
					<span class="checkbox-text">Auto-create project directories</span>
				</label>
				<p class="input-help">
					Automatically create directories for new projects if they don't exist
				</p>
			</div>

			<div class="input-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={rememberLastWorkspace}
						class="checkbox-input"
					>
					<span class="checkbox-text">Remember last workspace</span>
				</label>
				<p class="input-help">
					Automatically open the last used workspace on startup
				</p>
			</div>
		</section>

		<!-- Quick Actions -->
		<section class="settings-section">
			<h4 class="section-title">Quick Actions</h4>
			
			<div class="quick-actions">
				<Button
					onclick={() => defaultWorkingDirectory = '/home/user/projects'}
					variant="ghost"
					size="small"
				>
					<IconFolderPlus size={16} />
					Set to ~/projects
				</Button>
				
				<Button
					onclick={() => defaultWorkingDirectory = '/home/user/code'}
					variant="ghost"
					size="small"
				>
					<IconFolderPlus size={16} />
					Set to ~/code
				</Button>
				
				<Button
					onclick={() => defaultWorkingDirectory = ''}
					variant="ghost"
					size="small"
				>
					<IconFolder size={16} />
					Use System Default
				</Button>
			</div>
		</section>
	</div>

	<!-- Footer with save status -->
	<footer class="settings-footer">
		<div class="save-status" class:success={saveStatus.includes('success')} class:error={saveStatus.includes('Failed')}>
			{saveStatus}
		</div>
		<div class="settings-actions">
			<Button
				onclick={saveWorkspaceSettings}
				variant="primary"
				size="small"
				disabled={saving || !isValidPath}
				loading={saving}
			>
				{saving ? 'Saving...' : 'Save Settings'}
			</Button>
		</div>
	</footer>
</div>

<style>
	.workspace-settings {
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

	.input-group {
		margin-bottom: var(--space-4);
	}

	.input-group:last-child {
		margin-bottom: 0;
	}

	.input-label {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		color: var(--text-primary);
		margin-bottom: var(--space-2);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.directory-input {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
	}

	.path-input {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 0.9rem;
	}

	.current-workspace {
		margin-top: var(--space-3);
		padding: var(--space-3);
		background: var(--bg-dark);
		border: 1px solid var(--primary-dim);
		border-radius: 2px;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.current-workspace code {
		color: var(--primary);
		font-family: var(--font-mono);
	}

	.workspace-history {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
	}

	.history-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		background: var(--bg-dark);
		border: 1px solid var(--primary-dim);
		border-radius: 2px;
		font-size: 0.85rem;
	}

	.workspace-path {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text-muted);
		flex: 1;
		min-width: 0;
	}

	.workspace-path code {
		color: var(--text-primary);
		font-family: var(--font-mono);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.history-actions {
		display: flex;
		justify-content: flex-end;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		cursor: pointer;
		font-family: var(--font-mono);
		color: var(--text-primary);
	}

	.checkbox-input {
		width: 16px;
		height: 16px;
		border: 1px solid var(--primary-dim);
		background: var(--bg-dark);
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.checkbox-input:checked {
		background: var(--primary);
		border-color: var(--primary);
	}

	.checkbox-text {
		font-size: 0.9rem;
		user-select: none;
	}

	.input-help {
		margin: var(--space-2) 0 0 0;
		font-size: 0.8rem;
		color: var(--text-muted);
		font-style: italic;
	}

	.validation-error {
		margin: var(--space-2) 0 0 0;
		font-size: 0.8rem;
		color: var(--accent-red);
		font-family: var(--font-mono);
	}

	.quick-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.settings-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: var(--space-4);
		border-top: 1px solid var(--primary-dim);
		margin-top: auto;
	}

	.save-status {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		padding: var(--space-2) 0;
		min-height: 24px;
		display: flex;
		align-items: center;
	}

	.save-status.success {
		color: var(--primary);
	}

	.save-status.error {
		color: var(--accent-red);
	}

	.settings-actions {
		display: flex;
		gap: var(--space-3);
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.directory-input {
			flex-direction: column;
		}

		.settings-footer {
			flex-direction: column;
			gap: var(--space-3);
			align-items: stretch;
		}

		.settings-actions {
			justify-content: center;
		}

		.save-status {
			text-align: center;
		}

		.quick-actions {
			flex-direction: column;
		}

		.history-item {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-2);
		}
	}
</style>