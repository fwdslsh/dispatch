<script>
	import { createEventDispatcher } from 'svelte';
	import DirectoryBrowser from './DirectoryBrowser.svelte';
	import Button from '$lib/shared/components/Button.svelte';
	import IconButton from '$lib/shared/components/IconButton.svelte';
	import WorkspaceSelector from '$lib/shared/components/WorkspaceSelector.svelte';
	import FormSection from '$lib/shared/components/FormSection.svelte';
	import TypeCard from '$lib/shared/components/TypeCard.svelte';
	import { IconBolt, IconRobot, IconTerminal2, IconFolder, IconX, IconPlus } from '@tabler/icons-svelte';

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
				<IconButton
					variant="danger"
					onclick={() => (open = false)}
					ariaLabel="Close modal"
					class="close-btn"
				>
					{#snippet icon()}<IconX size={20} />{/snippet}
				</IconButton>
			</div>

			<div class="modal-body">
				<!-- Session Type Selection -->
				<FormSection label="Session Type">
					{#snippet icon()}<IconPlus size={18} />{/snippet}
					
					<div class="type-grid">
						<TypeCard
							title="Claude Code"
							description="AI-powered coding assistant"
							active={sessionType === 'claude'}
							disabled={loading}
							onclick={() => (sessionType = 'claude')}
						>
							{#snippet icon()}<IconRobot size={32} />{/snippet}
						</TypeCard>
						<TypeCard
							title="Terminal"
							description="Direct shell access"
							active={sessionType === 'pty'}
							disabled={loading}
							onclick={() => (sessionType = 'pty')}
						>
							{#snippet icon()}<IconTerminal2 size={32} />{/snippet}
						</TypeCard>
					</div>
				</FormSection>

				<!-- Workspace Directory Selection -->
				<FormSection label="Working Directory">
					{#snippet icon()}<IconFolder size={18} />{/snippet}
					
					{#if showDirectoryBrowser}
						<div class="directory-browser-container">
							<DirectoryBrowser
								bind:selected={workspacePath}
								startPath={workspacePath || '/workspace'}
								onSelect={handleDirectorySelect}
							/>
							<Button
								variant="secondary"
								augmented="tl-clip br-clip both"
								onclick={() => (showDirectoryBrowser = false)}
								class="cancel-browser-btn"
							>
								Cancel
							</Button>
						</div>
					{:else}
						<WorkspaceSelector
							bind:selectedPath={workspacePath}
							disabled={loading}
							placeholder="Select directory..."
							onClick={() => (showDirectoryBrowser = true)}
						/>
					{/if}
				</FormSection>

				<!-- Error Display -->
				{#if error}
					<div class="error-message">{error}</div>
				{/if}
			</div>

			<div class="modal-actions">
				<Button
					variant="ghost"
					augmented="tl-clip br-clip both"
					onclick={() => (open = false)}
					disabled={loading}
				>
					Cancel
				</Button>
				<Button
					variant="primary"
					augmented="tl-clip br-clip both"
					onclick={createSession}
					disabled={loading || !workspacePath}
					{loading}
					hideTextOnLoading={false}
				>
					{#snippet icon()}
						{#if loading}
							<IconBolt size={18} />
						{:else}
							<IconPlus size={18} />
						{/if}
					{/snippet}
					{loading ? 'Creating...' : 'Create Session'}
				</Button>
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

	.modal-body {
		padding: 1.5rem;
		flex: 1;
		overflow-y: auto;
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
		width: 100%;
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
	}
</style>
