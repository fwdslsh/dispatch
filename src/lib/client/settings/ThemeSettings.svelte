<!--
	ThemeSettings Component
	Main theme management UI with preset and custom theme sections.
	Follows Dispatch retro-terminal aesthetic with MVVM pattern.
-->

<script>
	import { onMount } from 'svelte';
	import { ThemeState } from '$lib/client/shared/state/ThemeState.svelte.js';
	import ThemePreviewCard from './ThemePreviewCard.svelte';
	import Button from '../shared/components/Button.svelte';

	// Initialize ThemeState ViewModel
	const themeState = new ThemeState({
		apiBaseUrl: '',
		authTokenKey: 'dispatch-auth-token'
	});

	// Local UI state using Svelte 5 runes
	let uploadError = $state(null);
	let uploadSuccess = $state(null);
	let uploadWarnings = $state([]);
	let showDeleteConfirm = $state(false);
	let themeToDelete = $state(null);
	let isDragging = $state(false);

	// File input reference
	let fileInput = $state(null);

	onMount(async () => {
		try {
			await themeState.loadThemes();
			await themeState.loadActiveTheme();
		} catch (error) {
			console.error('Failed to load themes:', error);
		}
	});

	// =================================================================
	// UPLOAD HANDLERS
	// =================================================================

	async function handleFileSelect(event) {
		const file = event.target.files?.[0];
		if (!file) return;

		await uploadThemeFile(file);
		// Reset file input to allow re-uploading same file
		if (fileInput) {
			fileInput.value = '';
		}
	}

	async function uploadThemeFile(file) {
		// Clear previous messages
		uploadError = null;
		uploadSuccess = null;
		uploadWarnings = [];

		// Validate file type
		if (!file.name.endsWith('.json')) {
			uploadError = 'Only JSON files are supported';
			return;
		}

		try {
			const result = await themeState.uploadTheme(file);

			// Show success message
			uploadSuccess = `Theme "${result.theme.name}" uploaded successfully`;

			// Show warnings if any
			if (result.validation?.warnings?.length) {
				uploadWarnings = result.validation.warnings;
			}

			// Auto-hide success message after 5 seconds
			setTimeout(() => {
				uploadSuccess = null;
				uploadWarnings = [];
			}, 5000);
		} catch (err) {
			uploadError = err.message;
		}
	}

	// Drag and drop support
	function handleDragEnter(event) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event) {
		event.preventDefault();
		// Check if we're actually leaving the drop zone
		if (event.target === event.currentTarget) {
			isDragging = false;
		}
	}

	function handleDragOver(event) {
		event.preventDefault();
	}

	async function handleDrop(event) {
		event.preventDefault();
		isDragging = false;

		const file = event.dataTransfer?.files?.[0];
		if (file) {
			await uploadThemeFile(file);
		}
	}

	// =================================================================
	// THEME ACTIONS
	// =================================================================

	async function handleActivate(themeId) {
		try {
			await themeState.activateTheme(themeId);
			// Page will reload automatically (FR-011)
		} catch (error) {
			console.error('Failed to activate theme:', error);
		}
	}

	async function handleDelete(themeId) {
		// Check if can delete
		try {
			const check = await themeState.canDeleteTheme(themeId);
			if (!check.canDelete) {
				uploadError = check.reason || 'Cannot delete this theme';
				return;
			}

			themeToDelete = themeId;
			showDeleteConfirm = true;
		} catch (error) {
			uploadError = error.message;
		}
	}

	async function confirmDelete() {
		try {
			await themeState.deleteTheme(themeToDelete);
			showDeleteConfirm = false;
			themeToDelete = null;
			uploadSuccess = 'Theme deleted successfully';

			// Auto-hide success message
			setTimeout(() => {
				uploadSuccess = null;
			}, 3000);
		} catch (error) {
			uploadError = error.message;
			showDeleteConfirm = false;
			themeToDelete = null;
		}
	}

	function cancelDelete() {
		showDeleteConfirm = false;
		themeToDelete = null;
	}

	// Clear error message
	function clearError() {
		uploadError = null;
	}
</script>

<div class="theme-settings" data-testid="theme-settings">
	<div class="settings-header">
		<h2>Theme Management</h2>
		<p class="settings-description">
			Customize your terminal appearance with preset themes or upload custom color schemes. Themes
			apply globally across all workspaces.
		</p>
	</div>

	<div class="settings-content">
		<!-- Messages Section -->
		{#if uploadError}
			<div class="error-message" role="alert">
				<strong>Error:</strong>
				{uploadError}
				<button class="message-close" onclick={clearError} aria-label="Dismiss error">×</button>
			</div>
		{/if}

		{#if uploadSuccess}
			<div class="success-message" role="status">
				<strong>Success:</strong>
				{uploadSuccess}
				{#if uploadWarnings.length > 0}
					<div class="warning-list">
						<strong>Warnings:</strong>
						<ul>
							{#each uploadWarnings as warning}
								<li>{warning}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Preset Themes Section -->
		<section class="theme-section">
			<h3 class="section-title">Preset Themes</h3>
			<p class="section-description">
				Built-in themes optimized for different terminal use cases and visual preferences.
			</p>

			<div class="theme-grid">
				{#each themeState.presetThemes as theme (theme.id)}
					<ThemePreviewCard
						{theme}
						isActive={theme.id === themeState.activeThemeId}
						onActivate={() => handleActivate(theme.id)}
						canDelete={false}
					/>
				{/each}
			</div>

			{#if themeState.presetThemes.length === 0 && !themeState.loading}
				<p class="empty-message">No preset themes available</p>
			{/if}
		</section>

		<!-- Custom Themes Section -->
		<section class="theme-section">
			<h3 class="section-title">Custom Themes</h3>
			<p class="section-description">
				Upload custom theme files in JSON format. Themes must include all required color
				definitions.
			</p>

			<!-- Upload Area -->
			<div
				class="upload-area"
				class:dragging={isDragging}
				ondragenter={handleDragEnter}
				ondragleave={handleDragLeave}
				ondragover={handleDragOver}
				ondrop={handleDrop}
				role="region"
				aria-label="Theme upload area"
			>
				<div class="upload-content">
					<svg
						class="upload-icon"
						width="48"
						height="48"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="17 8 12 3 7 8" />
						<line x1="12" y1="3" x2="12" y2="15" />
					</svg>

					<p class="upload-text">
						Drag and drop a theme file here, or
						<label for="theme-upload" class="upload-link">browse files</label>
					</p>

					<p class="upload-hint">Supported format: JSON (max 5MB)</p>

					<input
						id="theme-upload"
						bind:this={fileInput}
						type="file"
						accept=".json,application/json"
						onchange={handleFileSelect}
						hidden
						aria-label="Upload theme file"
					/>
				</div>
			</div>

			<!-- Custom Themes Grid -->
			<div class="theme-grid">
				{#each themeState.customThemes as theme (theme.id)}
					<ThemePreviewCard
						{theme}
						isActive={theme.id === themeState.activeThemeId}
						onActivate={() => handleActivate(theme.id)}
						onDelete={() => handleDelete(theme.id)}
						canDelete={true}
					/>
				{/each}
			</div>

			{#if themeState.customThemes.length === 0 && !themeState.loading}
				<p class="empty-message">No custom themes uploaded yet</p>
			{/if}
		</section>
	</div>

	<!-- Delete Confirmation Modal -->
	{#if showDeleteConfirm}
		<div
			class="modal-overlay"
			onclick={cancelDelete}
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-modal-title"
		>
			<div class="modal-content" onclick={(e) => e.stopPropagation()}>
				<h3 id="delete-modal-title">Delete Theme</h3>
				<p>Are you sure you want to delete this theme? This action cannot be undone.</p>

				<div class="modal-actions">
					<Button
						variant="danger"
						text="Delete"
						onclick={confirmDelete}
						disabled={themeState.deleting}
						loading={themeState.deleting}
					/>
					<Button variant="secondary" text="Cancel" onclick={cancelDelete} />
				</div>
			</div>
		</div>
	{/if}

	<!-- Loading Overlay -->
	{#if themeState.loading}
		<div class="loading-overlay" role="status" aria-live="polite">
			<div class="spinner"></div>
			<p>Loading themes...</p>
		</div>
	{/if}
</div>

<style>
	.theme-settings {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		padding: var(--space-5);
		margin-bottom: var(--space-5);
		container-type: inline-size;
	}

	.settings-header h2 {
		margin: 0 0 var(--space-2) 0;
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-4);
		font-weight: 600;
		text-shadow: 0 0 8px var(--primary-glow);
	}

	.settings-description {
		margin: 0 0 var(--space-5) 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.5;
	}

	.settings-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	/* Theme Sections */
	.theme-section {
		border-top: 1px solid var(--line);
		padding-top: var(--space-5);
	}

	.theme-section:first-child {
		border-top: none;
		padding-top: 0;
	}

	.section-title {
		margin: 0 0 var(--space-2) 0;
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-3);
		font-weight: 600;
	}

	.section-description {
		margin: 0 0 var(--space-4) 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.5;
	}

	/* Theme Grid */
	.theme-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--space-4);
		margin-top: var(--space-4);
	}

	/* Upload Area */
	.upload-area {
		margin-bottom: var(--space-4);
		padding: var(--space-6);
		border: 2px dashed var(--line);
		border-radius: var(--radius-sm);
		background: var(--surface-primary-98);
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.upload-area:hover {
		border-color: var(--primary);
		background: color-mix(in oklab, var(--primary) 5%, var(--surface));
	}

	.upload-area.dragging {
		border-color: var(--primary);
		background: color-mix(in oklab, var(--primary) 10%, var(--surface));
		box-shadow: 0 0 12px var(--primary-glow-25);
	}

	.upload-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		text-align: center;
	}

	.upload-icon {
		color: var(--primary);
		opacity: 0.7;
	}

	.upload-area.dragging .upload-icon {
		opacity: 1;
	}

	.upload-text {
		margin: 0;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.upload-link {
		color: var(--primary);
		text-decoration: underline;
		cursor: pointer;
		font-weight: 600;
	}

	.upload-link:hover {
		opacity: 0.8;
	}

	.upload-hint {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
	}

	/* Messages */
	.error-message {
		position: relative;
		padding: var(--space-3);
		background: var(--err-dim);
		border: 1px solid var(--err);
		border-radius: var(--radius-xs);
		color: var(--err);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.success-message {
		padding: var(--space-4);
		background: color-mix(in oklab, var(--ok) 15%, var(--surface));
		border: 1px solid var(--ok);
		border-radius: var(--radius-sm);
		color: var(--ok);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.message-close {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		background: transparent;
		border: none;
		color: inherit;
		font-size: 24px;
		line-height: 1;
		cursor: pointer;
		padding: var(--space-1);
		opacity: 0.7;
		transition: opacity 0.2s ease;
	}

	.message-close:hover {
		opacity: 1;
	}

	.warning-list {
		margin-top: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid color-mix(in oklab, var(--ok) 30%, transparent);
	}

	.warning-list ul {
		margin: var(--space-1) 0 0 var(--space-4);
		padding: 0;
		list-style: disc;
	}

	.warning-list li {
		margin-bottom: var(--space-1);
		font-size: var(--font-size-0);
	}

	.empty-message {
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		font-style: italic;
		text-align: center;
		padding: var(--space-6) var(--space-4);
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(4px);
	}

	.modal-content {
		background: var(--surface);
		padding: var(--space-6);
		border-radius: var(--radius-md);
		border: 1px solid var(--line);
		max-width: 400px;
		width: 90%;
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.5),
			0 0 0 1px var(--primary-glow-15);
	}

	.modal-content h3 {
		margin: 0 0 var(--space-3) 0;
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-3);
		font-weight: 600;
	}

	.modal-content p {
		margin: 0 0 var(--space-5) 0;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.5;
	}

	.modal-actions {
		display: flex;
		gap: var(--space-3);
		justify-content: flex-end;
	}

	/* Loading Overlay */
	.loading-overlay {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--surface);
		padding: var(--space-5) var(--space-6);
		border-radius: var(--radius-sm);
		border: 1px solid var(--primary);
		box-shadow: 0 0 16px var(--primary-glow-25);
		z-index: 999;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
	}

	.loading-overlay p {
		margin: 0;
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--line);
		border-top-color: var(--primary);
		border-radius: var(--radius-full);
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Responsive Design */
	@container (max-width: 600px) {
		.theme-settings {
			padding: var(--space-4);
		}

		.theme-grid {
			grid-template-columns: 1fr;
		}

		.upload-area {
			padding: var(--space-4);
		}

		.modal-actions {
			flex-direction: column;
		}
	}

	/* Accessibility: Focus styles */
	.upload-link:focus-visible,
	.message-close:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
		border-radius: var(--radius-xs);
	}

	/* Accessibility: Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.upload-area,
		.spinner {
			transition: none;
			animation: none;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.theme-settings,
		.upload-area,
		.modal-content {
			border-width: 2px;
		}
	}
</style>
