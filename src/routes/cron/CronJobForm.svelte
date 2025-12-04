<script>
	import { CRON_PRESETS } from '$lib/shared/cron-utils.js';

	let { job = null, onSave, onCancel, cronService } = $props();

	let formData = $state({
		name: job?.name || '',
		description: job?.description || '',
		cronExpression: job?.cronExpression || '0 * * * *',
		command: job?.command || '',
		workspacePath: job?.workspacePath || ''
	});

	let usePreset = $state(true);
	let validationError = $state(null);

	function handleSubmit() {
		validationError = null;

		const validation = cronService.validateExpression(formData.cronExpression);
		if (!validation.valid) {
			validationError = validation.error;
			return;
		}

		onSave(formData);
	}

	function selectPreset(preset) {
		formData.cronExpression = preset.value;
		usePreset = true;
	}

	function handleKeyDown(event) {
		if (event.key === 'Escape') {
			onCancel();
		}
	}

	function handleOverlayClick(event) {
		if (event.target === event.currentTarget) {
			onCancel();
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={handleOverlayClick} onkeydown={handleKeyDown}>
	<div class="modal-content">
		<div class="modal-header">
			<h2>{job ? 'Edit Task' : 'Create New Task'}</h2>
			<button class="close-btn" onclick={onCancel}>×</button>
		</div>

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			<div class="form-group">
				<label for="name">Task Name *</label>
				<input
					id="name"
					type="text"
					bind:value={formData.name}
					placeholder="Database Backup"
					required
				/>
			</div>

			<div class="form-group">
				<label for="description">Description</label>
				<textarea
					id="description"
					bind:value={formData.description}
					placeholder="Backs up the production database"
					rows="2"
				></textarea>
			</div>

			<div class="form-group">
				<label>Schedule</label>
				<div class="preset-grid">
					{#each CRON_PRESETS as preset}
						<button
							type="button"
							class="preset-btn"
							class:active={formData.cronExpression === preset.value}
							onclick={() => selectPreset(preset)}
						>
							{preset.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="form-group">
				<label for="cronExpression">Cron Expression *</label>
				<input
					id="cronExpression"
					type="text"
					bind:value={formData.cronExpression}
					placeholder="0 * * * *"
					required
					onfocus={() => (usePreset = false)}
				/>
				{#if formData.cronExpression}
					<div class="hint">{cronService.getHumanReadable(formData.cronExpression)}</div>
				{/if}
				{#if validationError}
					<div class="error">{validationError}</div>
				{/if}
			</div>

			<div class="form-group">
				<label for="command">Command *</label>
				<textarea
					id="command"
					bind:value={formData.command}
					placeholder="npm run backup"
					rows="3"
					required
				></textarea>
			</div>

			<div class="form-group">
				<label for="workspacePath">Workspace Path</label>
				<input
					id="workspacePath"
					type="text"
					bind:value={formData.workspacePath}
					placeholder="/workspace/my-project"
				/>
			</div>

			<div class="modal-footer">
				<button type="button" class="btn-secondary" onclick={onCancel}>Cancel</button>
				<button type="submit" class="btn-primary">{job ? 'Update' : 'Create'} Task</button>
			</div>
		</form>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		background: var(--card-bg, white);
		border-radius: 12px;
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-color, #e5e7eb);
	}

	.modal-header h2 {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0;
		color: var(--text-primary, #1f2937);
	}

	.close-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		font-size: 2rem;
		color: var(--text-secondary, #6b7280);
		cursor: pointer;
		border-radius: 6px;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: var(--hover-bg, #f9fafb);
		color: var(--text-primary, #1f2937);
	}

	form {
		padding: 1.5rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-primary, #1f2937);
		margin-bottom: 0.5rem;
	}

	input,
	textarea {
		width: 100%;
		padding: 0.625rem 0.875rem;
		border: 1px solid var(--border-color, #e5e7eb);
		border-radius: 8px;
		font-size: 0.9375rem;
		color: var(--text-primary, #1f2937);
		background: var(--card-bg, white);
		transition: all 0.2s;
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--primary-color, #3b82f6);
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	textarea {
		resize: vertical;
		font-family: 'Monaco', 'Menlo', monospace;
	}

	.preset-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.5rem;
	}

	.preset-btn {
		padding: 0.625rem;
		background: var(--hover-bg, #f9fafb);
		border: 1px solid var(--border-color, #e5e7eb);
		border-radius: 6px;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-primary, #1f2937);
		cursor: pointer;
		transition: all 0.2s;
	}

	.preset-btn:hover {
		background: var(--border-color, #e5e7eb);
	}

	.preset-btn.active {
		background: var(--primary-color, #3b82f6);
		color: white;
		border-color: var(--primary-color, #3b82f6);
	}

	.hint {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: var(--text-secondary, #6b7280);
		font-style: italic;
	}

	.error {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: #dc2626;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1.5rem;
		border-top: 1px solid var(--border-color, #e5e7eb);
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.625rem 1.25rem;
		border-radius: 8px;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
	}

	.btn-primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.btn-primary:hover {
		box-shadow: var(--shadow-md);
	}

	.btn-secondary {
		background: var(--hover-bg, #f9fafb);
		color: var(--text-primary, #1f2937);
		border: 1px solid var(--border-color, #e5e7eb);
	}

	.btn-secondary:hover {
		background: var(--border-color, #e5e7eb);
	}
</style>
