<script>
	import Modal from '$lib/client/shared/components/Modal.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import FormSection from '$lib/client/shared/components/FormSection.svelte';
	import { VALID_HTTP_METHODS } from '$lib/shared/webhook-utils.js';

	let { webhook = null, onSave, onCancel, webhookService, open = $bindable(true) } = $props();

	let formData = $state({
		name: webhook?.name || '',
		description: webhook?.description || '',
		uriPath: webhook?.uriPath || '/hooks/',
		httpMethod: webhook?.httpMethod || 'POST',
		command: webhook?.command || '',
		workspacePath: webhook?.workspacePath || ''
	});

	let validationError = $state(null);

	function handleSubmit(event) {
		event.preventDefault();
		validationError = null;

		// Validate URI path
		const pathValidation = webhookService.validatePath(formData.uriPath);
		if (!pathValidation.valid) {
			validationError = pathValidation.error;
			return;
		}

		// Validate HTTP method
		const methodValidation = webhookService.validateMethod(formData.httpMethod);
		if (!methodValidation.valid) {
			validationError = methodValidation.error;
			return;
		}

		onSave(formData);
		open = false;
	}

	function handleCancel() {
		onCancel();
		open = false;
	}

	// Auto-format URI path
	function handleUriPathChange(event) {
		let value = event.target.value;
		// Ensure it starts with /hooks/
		if (!value.startsWith('/hooks/')) {
			if (value.startsWith('/hooks')) {
				value = '/hooks/';
			} else if (value.startsWith('/')) {
				value = '/hooks' + value;
			} else {
				value = '/hooks/' + value;
			}
		}
		// Remove any double slashes (except after http:)
		value = value.replace(/\/+/g, '/');
		formData.uriPath = value;
	}
</script>

<Modal
	bind:open
	title={webhook ? 'Edit Webhook' : 'Create New Webhook'}
	size="medium"
	onclose={handleCancel}
>
	<form onsubmit={handleSubmit} class="webhook-form">
		<FormSection title="Webhook Details">
			<div class="form-field">
				<label for="name">Webhook Name *</label>
				<input
					id="name"
					type="text"
					bind:value={formData.name}
					placeholder="Deploy Production"
					required
				/>
			</div>

			<div class="form-field">
				<label for="description">Description</label>
				<textarea
					id="description"
					bind:value={formData.description}
					placeholder="Triggered by GitHub push events"
					rows="2"
				></textarea>
			</div>
		</FormSection>

		<FormSection title="Endpoint Configuration">
			<div class="form-row">
				<div class="form-field method-field">
					<label for="httpMethod">Method *</label>
					<select id="httpMethod" bind:value={formData.httpMethod} required>
						{#each VALID_HTTP_METHODS as method}
							<option value={method}>{method}</option>
						{/each}
					</select>
				</div>

				<div class="form-field path-field">
					<label for="uriPath">URI Path *</label>
					<input
						id="uriPath"
						type="text"
						bind:value={formData.uriPath}
						oninput={handleUriPathChange}
						placeholder="/hooks/my-webhook"
						required
					/>
				</div>
			</div>

			{#if formData.uriPath && formData.uriPath.length > 7}
				<div class="hint">
					Full URL: {window.location.origin}{formData.uriPath}
				</div>
			{/if}

			{#if validationError}
				<div class="error">{validationError}</div>
			{/if}
		</FormSection>

		<FormSection title="Execution Settings">
			<div class="form-field">
				<label for="command">Command *</label>
				<textarea
					id="command"
					bind:value={formData.command}
					placeholder="./deploy.sh"
					rows="3"
					required
				></textarea>
				<div class="hint">
					Request data available via $WEBHOOK_REQUEST_FILE (JSON with body and query params)
				</div>
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
				{webhook ? 'Update' : 'Create'} Webhook
			</Button>
		</div>
	{/snippet}
</Modal>

<style>
	.webhook-form {
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

	.form-row {
		display: flex;
		gap: var(--space-4);
	}

	.method-field {
		flex: 0 0 120px;
	}

	.path-field {
		flex: 1;
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
	textarea,
	select {
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
	textarea:focus,
	select:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-glow-20);
	}

	textarea {
		resize: vertical;
		font-family: var(--font-mono);
		line-height: 1.5;
	}

	select {
		cursor: pointer;
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

	@media (max-width: 640px) {
		.form-row {
			flex-direction: column;
			gap: var(--space-4);
		}

		.method-field {
			flex: 1;
		}
	}
</style>
