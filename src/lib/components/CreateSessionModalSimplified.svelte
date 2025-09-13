<script>
	import { createEventDispatcher } from 'svelte';
	import DirectoryBrowser from './DirectoryBrowser.svelte';
	import { IconBolt, IconRobot, IconTerminal2, IconFolder, IconChevronDown, IconX, IconPlus } from '@tabler/icons-svelte';

	// Props
	let { open = $bindable(false), initialType = 'claude' } = $props();

	// State
	let sessionType = $state(initialType);
	let workspacePath = $state('');
	let showDirectoryBrowser = $state(false);
	let loading = $state(false);
	let error = $state(null);

	const dispatch = createEventDispatcher();

	// Set default workspace path (will be set when modal opens)
	async function setDefaultWorkspace() {
		// Default to /workspace if no path is set
		if (!workspacePath) {
			workspacePath = '/workspace';
		}
	}

	// Create session
	async function createSession() {
		if (!workspacePath) {
			error = 'Please select a workspace';
			return;
		}

		loading = true;
		error = null;

		try {
			// Create the session using unified API
			const response = await fetch('/api/sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: sessionType,
					workspacePath,
					options: {}
				})
			});

			if (response.ok) {
				const session = await response.json();
				dispatch('created', {
					id: session.id,
					type: sessionType,
					workspacePath,
					terminalId: session.terminalId,
					claudeId: session.claudeId
				});
				open = false;
			} else {
				const errorText = await response.text();
				error = `Failed to create session: ${errorText}`;
			}
		} catch (err) {
			error = 'Error creating session: ' + err.message;
		} finally {
			loading = false;
		}
	}

	// Handle directory selection
	function handleDirectorySelect(path) {
		workspacePath = path;
		showDirectoryBrowser = false;
	}

	// Format display path
	function formatPath(path) {
		if (!path) return 'Select directory...';
		const parts = path.split('/');
		if (parts.length > 3) {
			return '.../' + parts.slice(-2).join('/');
		}
		return path;
	}

	// Load default workspace when modal opens
	$effect(() => {
		if (open) {
			setDefaultWorkspace();
			error = null;
			showDirectoryBrowser = false;
		}
	});
</script>

{#if open}
	<div class="modal-overlay" onclick={() => (open = false)}>
		<div class="modal" onclick={(e) => e.stopPropagation()} data-augmented-ui="tl-clip tr-clip bl-clip br-clip both">
			<div class="modal-header">
				<div class="header-content">
					<div class="header-icon"><IconBolt size={24} /></div>
					<h2>Create New Session</h2>
				</div>
				<button class="close-btn" onclick={() => (open = false)} aria-label="Close modal"><IconX size={20} /></button>
			</div>

			<div class="modal-body">
				<!-- Session Type Selection -->
				<div class="form-group">
					<label class="form-label">
						<span class="label-icon"><IconPlus size={18} /></span>
						<span>Session Type</span>
					</label>
					<div class="type-buttons">
						<button
							type="button"
							class="type-btn"
							class:active={sessionType === 'claude'}
							onclick={() => (sessionType = 'claude')}
							disabled={loading}
							data-augmented-ui="tl-clip br-clip both"
						>
							<div class="type-btn-content">
								<div class="type-icon"><IconRobot size={32} /></div>
								<div class="type-info">
									<div class="type-title">Claude Code</div>
									<div class="type-desc">AI-powered coding assistant</div>
								</div>
							</div>
						</button>
						<button
							type="button"
							class="type-btn"
							class:active={sessionType === 'pty'}
							onclick={() => (sessionType = 'pty')}
							disabled={loading}
							data-augmented-ui="tl-clip br-clip both"
						>
							<div class="type-btn-content">
								<div class="type-icon"><IconTerminal2 size={32} /></div>
								<div class="type-info">
									<div class="type-title">Terminal</div>
									<div class="type-desc">Direct shell access</div>
								</div>
							</div>
						</button>
					</div>
				</div>

				<!-- Workspace Directory Selection -->
				<div class="form-group">
					<label class="form-label">
						<span class="label-icon"><IconFolder size={18} /></span>
						<span>Working Directory</span>
					</label>
					{#if showDirectoryBrowser}
						<div class="directory-browser-container">
							<DirectoryBrowser
								bind:selected={workspacePath}
								startPath={workspacePath || '/workspace'}
								onSelect={handleDirectorySelect}
							/>
							<button
								type="button"
								class="cancel-browser-btn"
								onclick={() => (showDirectoryBrowser = false)}
							>
								Cancel
							</button>
						</div>
					{:else}
						<div class="workspace-group">
							<button
								type="button"
								class="workspace-select-btn"
								onclick={() => (showDirectoryBrowser = true)}
								disabled={loading}
								data-augmented-ui="tl-clip br-clip both"
							>
								<span class="workspace-icon"><IconFolder size={20} /></span>
								<span class="workspace-path">{formatPath(workspacePath)}</span>
								<span class="workspace-arrow"><IconChevronDown size={16} /></span>
							</button>
						</div>
					{/if}
				</div>

				<!-- Error Display -->
				{#if error}
					<div class="error-message">{error}</div>
				{/if}
			</div>

			<div class="modal-footer">
				<button 
					type="button" 
					class="cancel-btn" 
					onclick={() => (open = false)} 
					disabled={loading}
					data-augmented-ui="tl-clip br-clip both"
				>
					<span>Cancel</span>
				</button>
				<button
					type="button"
					class="create-btn"
					onclick={createSession}
					disabled={loading || !workspacePath}
					data-augmented-ui="tl-clip br-clip both"
				>
					<span class="create-btn-icon">{#if loading}<IconBolt size={18} />{:else}<IconPlus size={18} />{/if}</span>
					<span>{loading ? 'Creating...' : 'Create Session'}</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: radial-gradient(circle at center, rgba(46, 230, 107, 0.1) 0%, rgba(0, 0, 0, 0.85) 70%);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
	}

	.modal {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 95%, var(--primary) 5%), 
			color-mix(in oklab, var(--surface) 98%, var(--accent-cyan) 2%));
		border: 2px solid var(--primary-dim);
		border-radius: 0;
		width: 90%;
		max-width: 520px;
		max-height: 90vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 
			0 20px 40px rgba(0, 0, 0, 0.3),
			0 0 60px rgba(46, 230, 107, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 2px solid var(--primary-dim);
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface-hover) 90%, var(--primary) 10%), 
			color-mix(in oklab, var(--surface-hover) 95%, var(--accent-cyan) 5%));
		position: relative;
	}

	.modal-header::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--primary), transparent);
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.header-icon {
		font-size: 1.5rem;
		color: var(--primary);
		animation: pulse 2s ease-in-out infinite;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--text);
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-shadow: 0 0 10px rgba(46, 230, 107, 0.3);
	}

	.close-btn {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 80%, var(--secondary) 20%), 
			color-mix(in oklab, var(--surface) 90%, var(--secondary) 10%));
		border: 1px solid var(--secondary);
		font-size: 1.2rem;
		color: var(--secondary);
		cursor: pointer;
		padding: 0;
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0;
		transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		font-weight: bold;
	}

	.close-btn:hover {
		background: linear-gradient(135deg, var(--secondary), #ff7b7b);
		color: var(--bg);
		box-shadow: 0 0 20px rgba(255, 107, 107, 0.4);
		transform: scale(1.05);
	}

	.modal-body {
		padding: 1.5rem;
		flex: 1;
		overflow-y: auto;
	}

	.form-group {
		margin-bottom: 2rem;
		position: relative;
	}

	.form-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		font-weight: 700;
		color: var(--primary);
		font-size: 1rem;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-shadow: 0 0 8px rgba(46, 230, 107, 0.3);
	}

	.label-icon {
		font-size: 1.1em;
		filter: drop-shadow(0 0 6px rgba(46, 230, 107, 0.4));
	}

	.type-buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.type-btn {
		padding: 1.5rem 1rem;
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface-hover) 90%, var(--primary) 10%), 
			color-mix(in oklab, var(--surface-hover) 95%, var(--accent-cyan) 5%));
		border: 2px solid var(--surface-border);
		border-radius: 0;
		color: var(--text-muted);
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		text-align: left;
		position: relative;
		overflow: hidden;
	}

	.type-btn::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(46, 230, 107, 0.1), transparent);
		transition: left 0.5s ease;
	}

	.type-btn-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		position: relative;
		z-index: 1;
	}

	.type-icon {
		font-size: 2rem;
		filter: drop-shadow(0 0 8px rgba(46, 230, 107, 0.3));
	}

	.type-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.type-title {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text);
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.type-desc {
		font-size: 0.85rem;
		color: var(--text-muted);
		opacity: 0.8;
	}

	.type-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--primary) 20%, var(--surface-hover)), 
			color-mix(in oklab, var(--primary) 10%, var(--surface-hover)));
		border-color: var(--primary);
		box-shadow: 
			0 0 20px rgba(46, 230, 107, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		transform: translateY(-2px);
	}

	.type-btn:hover:not(:disabled)::before {
		left: 100%;
	}

	.type-btn:hover:not(:disabled) .type-icon {
		filter: drop-shadow(0 0 12px rgba(46, 230, 107, 0.6));
		transform: scale(1.1);
	}

	.type-btn.active {
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		border-color: var(--primary);
		color: var(--bg);
		box-shadow: 
			0 0 30px rgba(46, 230, 107, 0.4),
			0 0 60px rgba(46, 230, 107, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		transform: translateY(-3px) scale(1.02);
	}

	.type-btn.active .type-title,
	.type-btn.active .type-desc {
		color: var(--bg);
		text-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
	}

	.type-btn.active .type-icon {
		filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.5));
		transform: scale(1.15);
	}

	.type-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.workspace-group {
		display: flex;
		gap: 0.5rem;
	}

	.workspace-select-btn {
		width: 100%;
		padding: 1rem 1.25rem;
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface-hover) 90%, var(--primary) 10%), 
			color-mix(in oklab, var(--surface-hover) 95%, var(--accent-cyan) 5%));
		border: 2px solid var(--surface-border);
		border-radius: 0;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.95rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		position: relative;
		overflow: hidden;
	}

	.workspace-icon {
		font-size: 1.2em;
		color: var(--primary);
		filter: drop-shadow(0 0 6px rgba(46, 230, 107, 0.3));
	}

	.workspace-path {
		flex: 1;
		font-weight: 600;
	}

	.workspace-arrow {
		color: var(--text-muted);
		transition: transform 0.3s ease;
	}

	.workspace-select-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--primary) 15%, var(--surface-hover)), 
			color-mix(in oklab, var(--primary) 8%, var(--surface-hover)));
		border-color: var(--primary);
		box-shadow: 
			0 0 20px rgba(46, 230, 107, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		transform: translateY(-1px);
	}

	.workspace-select-btn:hover:not(:disabled) .workspace-arrow {
		transform: translateY(2px);
		color: var(--primary);
	}

	.workspace-select-btn:hover:not(:disabled) .workspace-icon {
		filter: drop-shadow(0 0 10px rgba(46, 230, 107, 0.5));
		transform: scale(1.1);
	}

	.workspace-select-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.directory-browser-container {
		background: var(--surface-hover);
		border: 1px solid var(--surface-border);
		border-radius: 0.35rem;
		padding: 1rem;
		max-height: 400px;
		overflow-y: auto;
	}

	.cancel-browser-btn {
		margin-top: 0.75rem;
		padding: 0.5rem 1rem;
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: 0.25rem;
		color: var(--text);
		font-size: 0.85rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.cancel-browser-btn:hover {
		background: var(--surface-hover);
	}

	.error-message {
		padding: 1rem;
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--secondary) 15%, var(--surface)), 
			color-mix(in oklab, var(--secondary) 8%, var(--surface)));
		border: 2px solid var(--secondary);
		border-radius: 0;
		color: var(--secondary);
		font-size: 0.9rem;
		font-family: var(--font-mono);
		font-weight: 600;
		box-shadow: 
			0 0 20px rgba(255, 107, 107, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		position: relative;
	}


	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1.25rem;
		border-top: 1px solid var(--surface-border);
		background: var(--surface-hover);
	}

	.cancel-btn,
	.create-btn {
		padding: 1rem 2rem;
		border: 2px solid;
		border-radius: 0;
		font-weight: 700;
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		position: relative;
		overflow: hidden;
	}

	.cancel-btn {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 80%, var(--text-muted) 20%), 
			color-mix(in oklab, var(--surface) 90%, var(--text-muted) 10%));
		color: var(--text);
		border-color: var(--text-muted);
	}

	.cancel-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface-hover) 70%, var(--text-muted) 30%), 
			color-mix(in oklab, var(--surface-hover) 85%, var(--text-muted) 15%));
		border-color: var(--text);
		box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
		transform: translateY(-1px);
	}

	.create-btn {
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		color: var(--bg);
		border-color: var(--primary);
		box-shadow: 
			0 0 20px rgba(46, 230, 107, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
	}

	.create-btn-icon {
		font-size: 1.1em;
		filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.3));
	}

	.create-btn:hover:not(:disabled) {
		transform: translateY(-2px) scale(1.02);
		box-shadow: 
			0 0 30px rgba(46, 230, 107, 0.5),
			0 0 60px rgba(46, 230, 107, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.3);
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--primary) 110%, white 10%), 
			color-mix(in oklab, var(--accent-cyan) 110%, white 10%));
	}

	.create-btn:hover:not(:disabled) .create-btn-icon {
		filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
		transform: scale(1.1);
	}

	.cancel-btn:disabled,
	.create-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes pulse {
		0%, 100% {
			transform: scale(1);
			filter: drop-shadow(0 0 8px rgba(46, 230, 107, 0.3));
		}
		50% {
			transform: scale(1.05);
			filter: drop-shadow(0 0 15px rgba(46, 230, 107, 0.6));
		}
	}

	@keyframes slideUp {
		from {
			transform: translateY(30px) scale(0.95);
			opacity: 0;
			filter: blur(5px);
		}
		to {
			transform: translateY(0) scale(1);
			opacity: 1;
			filter: blur(0);
		}
	}

	/* Mobile Responsive */
	@media (max-width: 768px) {
		.modal {
			width: 95%;
			max-height: 95vh;
			margin: 1rem;
		}

		.modal-header {
			padding: 1rem;
		}

		.header-icon {
			font-size: 1.3rem;
		}

		.modal-header h2 {
			font-size: 1.2rem;
		}

		.type-buttons {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}

		.type-btn {
			padding: 1.25rem 1rem;
		}

		.type-btn-content {
			gap: 0.75rem;
		}

		.type-icon {
			font-size: 1.5rem;
		}

		.modal-footer {
			flex-direction: column;
			gap: 0.75rem;
		}

		.cancel-btn,
		.create-btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>
