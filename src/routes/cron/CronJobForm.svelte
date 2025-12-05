<script>
	import Modal from '$lib/client/shared/components/Modal.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import FormSection from '$lib/client/shared/components/FormSection.svelte';
	import { CRON_PRESETS } from '$lib/shared/cron-utils.js';

	let { job = null, onSave, onCancel, cronService, open = $bindable(true) } = $props();

	let formData = $state({
		name: job?.name || '',
		description: job?.description || '',
		cronExpression: job?.cronExpression || '0 * * * *',
		command: job?.command || '',
		workspacePath: job?.workspacePath || ''
	});

	let usePreset = $state(true);
	let validationError = $state(null);

	function handleSubmit(event) {
		event.preventDefault();
		validationError = null;

		const validation = cronService.validateExpression(formData.cronExpression);
		if (!validation.valid) {
			validationError = validation.error;
			return;
		}

		onSave(formData);
		open = false;
	}

	function selectPreset(preset) {
		formData.cronExpression = preset.value;
		usePreset = true;
	}

	function handleCancel() {
		onCancel();
		open = false;
	}
</script>

<Modal
	bind:open
	title={job ? 'Edit Task' : 'Create New Task'}
	size="medium"
	onclose={handleCancel}
>
	<form onsubmit={handleSubmit} class="cron-form">
		<FormSection title="Task Details">
			<div class="form-field">
				<label for="name">Task Name *</label>
				<input
					id="name"
					type="text"
					bind:value={formData.name}
					placeholder="Database Backup"
					required
				/>
			</div>

			<div class="form-field">
				<label for="description">Description</label>
				<textarea
					id="description"
					bind:value={formData.description}
					placeholder="Backs up the production database"
					rows="2"
				></textarea>
			</div>
		</FormSection>

		<FormSection title="Schedule Configuration">
			<div class="form-field">
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

			<div class="form-field">
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
		</FormSection>

		<FormSection title="Execution Settings">
			<div class="form-field">
				<label for="command">Command *</label>
				<textarea
					id="command"
					bind:value={formData.command}
					placeholder="npm run backup"
					rows="3"
					required
				></textarea>
			</div>

			<div class="form-field">
				<label for="workspacePath">Workspace Path</label>
				<input
					id="workspacePath"
					type="text"
					bind:value={formData.workspacePath}
					placeholder="/workspace/my-project"
				/>
			</div>
		</FormSection>
	</form>

	{#snippet footer()}
		<div class="modal-actions">
			<Button variant="secondary" onclick={handleCancel}>Cancel</Button>
			<Button variant="primary" onclick={handleSubmit}>
				{job ? 'Update' : 'Create'} Task
			</Button>
		</div>
	{/snippet}
</Modal>

<style>
	.cron-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.form-field {
		margin-bottom: var(--space-4);
	}

	.form-field:last-child {
		margin-bottom: 0;
	}

	label {
		display: block;
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: var(--space-2);
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	input,
	textarea {
		width: 100%;
		padding: var(--space-3);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-base);
		font-family: var(--font-mono);
		color: var(--text-primary);
		background: var(--bg-primary);
		transition: all 0.2s ease;
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-glow-20);
	}

	textarea {
		resize: vertical;
		font-family: var(--font-mono);
		line-height: 1.5;
	}

	.preset-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--space-2);
	}

	.preset-btn {
		padding: var(--space-3);
		background: var(--bg-secondary);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		font-weight: 600;
		font-family: var(--font-mono);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.preset-btn:hover {
		background: var(--bg-hover);
		border-color: var(--primary-dim);
	}

	.preset-btn.active {
		background: var(--primary);
		color: var(--text-on-accent);
		border-color: var(--primary);
		box-shadow: 0 0 10px var(--primary-glow);
	}

	.hint {
		margin-top: var(--space-2);
		font-size: var(--font-size-sm);
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-style: italic;
	}

	.error {
		margin-top: var(--space-2);
		font-size: var(--font-size-sm);
		color: var(--color-error);
		font-family: var(--font-mono);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-3);
	}
</style>
