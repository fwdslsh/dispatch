<script>
	/**
	 * RetentionSettings - Data retention policy configuration component
	 * Provides simple preview and validation as per specification
	 * Follows constitutional requirement for clear data management
	 *
	 * CONSOLIDATED ARCHITECTURE:
	 * - Uses RetentionPolicyViewModel which reads from user_preferences (maintenance category)
	 * - Cleanup operations via /api/maintenance endpoint
	 */

	import { getContext, onMount } from 'svelte';
	import { RetentionPolicyViewModel } from '../state/RetentionPolicyViewModel.svelte.js';
	import { PreferencesViewModel } from '../state/PreferencesViewModel.svelte.js';
	import Button from '../shared/components/Button.svelte';

	// Props
	let { onSave = (policy) => {} } = $props();

	// Get services from context
	const serviceContainer = getContext('services');
	let viewModel = $state(null);

	// Initialize ViewModel on mount with proper async handling
	onMount(async () => {
		try {
			if (!serviceContainer) {
				throw new Error('Service container not available');
			}

			const apiClient = await serviceContainer.get('apiClient');
			if (!apiClient) {
				throw new Error('API client not available');
			}

			// Get auth key from localStorage
			const authKey = localStorage.getItem('dispatch-auth-token') || '';
			if (!authKey) {
				throw new Error('Authentication key not found');
			}

			// Create PreferencesViewModel and RetentionPolicyViewModel
			const preferencesViewModel = new PreferencesViewModel(apiClient, authKey);
			viewModel = new RetentionPolicyViewModel(preferencesViewModel, authKey);
			await viewModel.loadPolicy();
		} catch (error) {
			console.error('Failed to initialize RetentionSettings:', error);
		}
	});

	// Handle form submission
	async function handleSave(e) {
		e.preventDefault();
		if (!viewModel) return;
		try {
			const updatedPolicy = await viewModel.savePolicy();
			onSave(updatedPolicy);
		} catch (error) {
			console.error('Failed to save retention policy:', error);
		}
	}

	// Handle preview generation
	async function handlePreview() {
		if (!viewModel) return;
		await viewModel.generatePreview();
	}

	// Handle reset actions
	function handleResetToDefaults() {
		if (!viewModel) return;
		viewModel.resetToDefaults();
	}

	function handleResetToOriginal() {
		if (!viewModel) return;
		viewModel.resetToOriginal();
	}

	// Validation helpers
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

<div class="retention-settings" role="main" aria-label="Data retention settings">
	<div class="settings-header">
		<h2>Data Retention Policy</h2>
		<p>Configure how long session data and logs are kept before automatic cleanup.</p>
	</div>

	{#if !viewModel || viewModel.isLoading}
		<div class="loading-indicator">
			<div class="spinner"></div>
			<span>Loading retention policy...</span>
		</div>
	{:else}
		<form class="settings-form" onsubmit={handleSave}>
			<!-- Session Retention -->
			<div class="form-group">
				<label for="session-days" class="form-label">
					Session Retention Period
					<span class="form-help">How long to keep session data</span>
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
					Log Retention Period
					<span class="form-help">How long to keep log entries</span>
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
						<span class="form-help">Automatically delete old data based on retention policy</span>
					</span>
				</label>
			</div>

			<!-- Preview Section -->
			<div class="preview-section">
				<Button
					type="button"
					variant="secondary"
					onclick={handlePreview}
					disabled={!viewModel.isValid || viewModel.isGeneratingPreview}
					loading={viewModel.isGeneratingPreview}
				>
					{#if viewModel.isGeneratingPreview}
						Generating Preview...
					{:else}
						Preview Changes
					{/if}
				</Button>

				{#if viewModel.previewSummary}
					<div class="preview-result">
						<h4>Preview Summary</h4>
						<p>{viewModel.previewSummary}</p>
					</div>
				{/if}
			</div>

			<!-- Form Actions -->
			<div class="form-actions">
				<Button type="button" variant="secondary" onclick={handleResetToDefaults} text="Reset to Defaults" />

				{#if viewModel.hasChanges}
					<Button type="button" variant="secondary" onclick={handleResetToOriginal} text="Discard Changes" />
				{/if}

				<Button type="submit" variant="primary" disabled={!viewModel.canSave} loading={viewModel.isSaving}>
					{#if viewModel.isSaving}
						Saving...
					{:else}
						Save Policy
					{/if}
				</Button>
			</div>
		</form>

		<!-- Error Display -->
		{#if viewModel.error}
			<div class="error-message" role="alert">
				<strong>Error:</strong>
				{viewModel.error}
			</div>
		{/if}

		<!-- Changes Warning -->
		{#if viewModel.hasChanges}
			<div class="warning-message">
				<strong>Unsaved Changes:</strong> You have unsaved changes to your retention policy.
			</div>
		{/if}
	{/if}
</div>

<style>
	@import '$lib/client/shared/styles/settings.css';

	/* Component-specific overrides only */
	.retention-settings {
		container-type: inline-size;
	}

	.form-input {
		flex: 1;
	}

	.input-suffix {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--muted);
		padding: 0 var(--space-2);
	}

	.preview-section {
		margin: var(--space-6) 0;
		padding: var(--space-5);
		background: var(--surface-primary-98);
		border: 1px solid var(--primary-glow-15);
		border-radius: var(--radius-sm);
	}

	.preview-result {
		margin-top: var(--space-4);
		padding: var(--space-4);
		background: var(--elev);
		border-radius: var(--radius-xs);
		border-left: 3px solid var(--primary);
	}

	.preview-result h4 {
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		color: var(--primary);
		margin: 0 0 var(--space-2) 0;
	}

	.preview-result p {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--text);
		margin: 0;
	}

	.error-text {
		color: var(--err);
		font-size: var(--font-size-0);
		font-family: var(--font-mono);
		margin-top: var(--space-1);
	}

	.form-help {
		display: block;
		font-size: var(--font-size-0);
		color: var(--muted);
		margin-top: var(--space-1);
	}

	.loading-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		padding: var(--space-6) var(--space-5);
		color: var(--muted);
	}

	.loading-indicator .spinner {
		/* Use shared spinner from settings.css */
	}

	.warning-message,
	.error-message {
		margin-top: var(--space-4);
	}
</style>
