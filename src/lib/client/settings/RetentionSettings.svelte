<script>
	/**
	 * RetentionSettings - Data retention policy configuration component
	 * Provides simple preview and validation as per specification
	 * Follows constitutional requirement for clear data management
	 */

	import { getContext } from 'svelte';
	import { RetentionPolicyViewModel } from '../state/RetentionPolicyViewModel.svelte.js';

	// Props
	let { onSave = (policy) => {} } = $props();

	// Get services from context
	const serviceContainer = getContext('services');
	let apiClient = $state(null);
	let viewModel = $state(null);

	// Load apiClient asynchronously and initialize ViewModel
	$effect(async () => {
		if (serviceContainer && !apiClient) {
			try {
				apiClient = await serviceContainer.get('apiClient');
				viewModel = new RetentionPolicyViewModel(apiClient);
			} catch (error) {
				console.error('Failed to get apiClient service:', error);
			}
		}
	});

	// Load current policy when viewModel is ready
	$effect(() => {
		if (viewModel) {
			viewModel.loadPolicy();
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
				<button
					type="button"
					class="btn btn-secondary"
					onclick={handlePreview}
					disabled={!viewModel.isValid || viewModel.isGeneratingPreview}
				>
					{#if viewModel.isGeneratingPreview}
						Generating Preview...
					{:else}
						Preview Changes
					{/if}
				</button>

				{#if viewModel.previewSummary}
					<div class="preview-result">
						<h4>Preview Summary</h4>
						<p>{viewModel.previewSummary}</p>
					</div>
				{/if}
			</div>

			<!-- Form Actions -->
			<div class="form-actions">
				<button type="button" class="btn btn-outline" onclick={handleResetToDefaults}>
					Reset to Defaults
				</button>

				{#if viewModel.hasChanges}
					<button type="button" class="btn btn-outline" onclick={handleResetToOriginal}>
						Discard Changes
					</button>
				{/if}

				<button type="submit" class="btn btn-primary" disabled={!viewModel.canSave}>
					{#if viewModel.isSaving}
						Saving...
					{:else}
						Save Policy
					{/if}
				</button>
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
	/* Essential layout styles only */
	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-label {
		display: block;
		margin-bottom: 0.5rem;
	}

	.input-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.form-input {
		flex: 1;
		padding: 0.75rem;
	}

	.checkbox-container {
		display: flex;
		align-items: flex-start;
		cursor: pointer;
		padding: 0.75rem;
		margin: 0.5rem 0;
	}

	.checkbox-container input[type='checkbox'] {
		margin-right: 0.75rem;
		margin-top: 0.125rem;
	}

	.checkbox-label {
		flex: 1;
	}

	.preview-section {
		margin: 2rem 0;
		padding: 1.5rem;
	}

	.preview-result {
		margin-top: 1rem;
		padding: 1rem;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		padding-top: 1.5rem;
		margin-top: 1.5rem;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		cursor: pointer;
	}

	.loading-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 3rem;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid currentColor;
		border-top: 2px solid transparent;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>

