<script>
	import Button from './Button.svelte';
	import IconButton from './IconButton.svelte';
	import IconFile from './Icons/IconFile.svelte';
	import IconFileCode from './Icons/IconFileCode.svelte';
	import IconFileText from './Icons/IconFileText.svelte';
	import IconCheck from './Icons/IconCheck.svelte';
	import IconX from './Icons/IconX.svelte';
	import ConfirmationDialog from './ConfirmationDialog.svelte';

	// Props
	let {
		file = null,
		content = $bindable(''),
		originalContent = '',
		loading = false,
		onSave = null,
		onCancel = null,
		onClose = null
	} = $props();

	// Reactive derivations
	let isDirty = $derived(content !== originalContent);
	let canSave = $derived(isDirty && file && !loading);

	// Get file icon based on extension
	function getFileIcon(filename) {
		if (!filename) return IconFile;

		const ext = filename.split('.').pop()?.toLowerCase();
		const codeExtensions = [
			'js',
			'ts',
			'py',
			'java',
			'cpp',
			'c',
			'h',
			'css',
			'html',
			'json',
			'xml',
			'yml',
			'yaml'
		];
		const textExtensions = ['txt', 'md', 'log', 'cfg', 'ini', 'conf'];

		if (codeExtensions.includes(ext)) {
			return IconFileCode;
		} else if (textExtensions.includes(ext)) {
			return IconFileText;
		} else {
			return IconFile;
		}
	}

	let showDiscardConfirm = $state(false);
	let showCloseConfirm = $state(false);

	// Handle save
	function handleSave() {
		if (onSave && canSave) {
			onSave();
		}
	}

	// Handle cancel
	function handleCancel() {
		if (isDirty) {
			showDiscardConfirm = true;
			return;
		}

		discardChanges();
	}

	// Handle close
	function handleClose() {
		if (isDirty) {
			showCloseConfirm = true;
			return;
		}

		onClose?.();
	}

	function discardChanges() {
		content = originalContent;
		onCancel?.();
	}

	function confirmClose() {
		showCloseConfirm = false;
		onClose?.();
	}

	function confirmDiscard() {
		showDiscardConfirm = false;
		discardChanges();
	}

	function cancelDiscard() {
		showDiscardConfirm = false;
	}

	function cancelCloseConfirm() {
		showCloseConfirm = false;
	}

	// Keyboard shortcuts
	function handleKeydown(event) {
		if (event.ctrlKey || event.metaKey) {
			if (event.key === 's') {
				event.preventDefault();
				handleSave();
			} else if (event.key === 'Escape') {
				event.preventDefault();
				handleCancel();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if file}
	<div class="file-editor flex-col">
		<!-- File header -->
		<div class="flex-between p-3">
			<div class="flex gap-2">
				{#if file.name.includes('.')}
					{@const IconComponent = getFileIcon(file.name)}
					<IconComponent size={16} />
				{:else}
					<IconFile size={16} />
				{/if}
				<span class="filename">{file.name}</span>
				{#if isDirty}
					<span class="dirty-indicator">*</span>
				{/if}
			</div>
			<div class="flex gap-2">
				<IconButton onclick={handleClose} title="Close file (Escape)" variant="ghost">
					<IconX size={16} />
				</IconButton>
			</div>
		</div>

		<!-- Editor -->
		<textarea
			bind:value={content}
			placeholder="File content..."
			disabled={loading}
			class="editor-textarea"
			spellcheck="false"
			autocomplete="off"
		></textarea>

		<!-- Editor footer -->
		<div
			class="flex-between p-3 gap-4 editor-footer-mobile"			
		>
			<div class="flex-col gap-1 file-info" style="flex: 1; min-width: 0;">
				<span class="file-path">{file.path}</span>
				{#if isDirty}
					<span class="changes-indicator">• Unsaved changes</span>
				{/if}
			</div>
			<div class="flex gap-3" style="align-items: center; flex-shrink: 0;">
				<Button
					variant="secondary"
					onclick={handleCancel}
					disabled={loading}
					title="Discard changes"
				>
					Cancel
				</Button>
				<Button
					variant="primary"
					onclick={handleSave}
					disabled={!canSave}
					{loading}
					title="Save file"
				>
					<IconCheck size={16} />
					Save
				</Button>
			</div>
		</div>
	</div>
{:else}
	<div
		class="flex-center"
	>
		<p>No file selected</p>
	</div>
{/if}

<ConfirmationDialog
	bind:show={showDiscardConfirm}
	title="Discard changes?"
	message="You have unsaved changes. Are you sure you want to discard them?"
	confirmText="Discard"
	cancelText="Keep editing"
	onconfirm={confirmDiscard}
	oncancel={cancelDiscard}
/>

<ConfirmationDialog
	bind:show={showCloseConfirm}
	title="Close without saving?"
	message="You have unsaved changes. Are you sure you want to close?"
	confirmText="Close without saving"
	cancelText="Keep editing"
	onconfirm={confirmClose}
	oncancel={cancelCloseConfirm}
/>

<style>
	/* FileEditor specific - minimal custom styles only */
	.file-editor {
		height: 100%;
		
		font-family: var(--font-mono);
	}

	.filename {
		word-break: break-word;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dirty-indicator {
		color: var(--color-warning);
		font-weight: bold;
		font-size: 1.2em;
		flex-shrink: 0;
	}

	/* Editor textarea specific styles */
	.editor-textarea {
		border-radius: 0;
		padding: 1rem;
		height: 100%;
		border: none;
		background: var(--color-surface);
		color: var(--color-text);
		font-family: var(--font-mono);
		line-height: 1.5;
		resize: none;
		outline: none;
		tab-size: 2;
		white-space: pre;
		overflow-wrap: normal;
		overflow-x: auto;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--color-border) transparent;
	}

	.editor-textarea::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.editor-textarea::-webkit-scrollbar-track {
		background: transparent;
	}

	.editor-textarea::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: 4px;
	}

	.editor-textarea::-webkit-scrollbar-thumb:hover {
		background: var(--color-text-secondary);
	}

	.editor-textarea:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.editor-textarea:focus {
		background: var(--color-surface);
		box-shadow: inset 0 0 0 1px var(--color-primary);
	}

	.file-path {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		word-break: break-all;
		font-family: var(--font-mono);
	}

	.changes-indicator {
		font-size: 0.75rem;
		color: var(--color-warning);
		font-weight: 500;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.editor-textarea {
			padding: 0.75rem;
			font-size: 0.8rem;
		}

		.file-info {
			text-align: center;
		}

		.editor-footer-mobile {
			flex-direction: column;
			align-items: stretch !important;
		}
	}
</style>
