<script>
	import IconX from '../shared/components/Icons/IconX.svelte';
	import IconRobot from '../shared/components/Icons/IconRobot.svelte';
	import IconSettings from '../shared/components/Icons/IconSettings.svelte';

	/**
	 * ChatHeader Component - Unified AI session header
	 *
	 * v2.0 Hard Fork: OpenCode-first architecture
	 *
	 * @file src/lib/client/ai/ChatHeader.svelte
	 */

	let { session = {}, onClose = () => {}, onSettings = null, index = 0 } = $props();
</script>

<div class="chat-header-bar">
	<div class="header-left">
		<IconRobot size={16} />
		<span class="header-title">AI Chat</span>
		{#if session.workspacePath}
			<span class="header-path" title={session.workspacePath}>
				{session.workspacePath.split('/').pop()}
			</span>
		{/if}
	</div>
	<div class="header-actions">
		{#if onSettings}
			<button type="button" class="header-btn" onclick={onSettings} title="AI Settings">
				<IconSettings size={14} />
			</button>
		{/if}
		<button
			type="button"
			class="header-btn close"
			onclick={() => onClose(session)}
			title="Close session"
		>
			<IconX size={14} />
		</button>
	</div>
</div>

<style>
	.chat-header-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		background: var(--surface);
		border-bottom: 1px solid var(--surface-border);
		height: 36px;
		box-sizing: border-box;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--primary);
		min-width: 0;
	}

	.header-title {
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		font-weight: 600;
		color: var(--text);
	}

	.header-path {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.header-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: var(--radius);
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s;
	}

	.header-btn:hover {
		background: var(--surface-hover);
		color: var(--text);
	}

	.header-btn.close:hover {
		background: color-mix(in oklab, var(--error) 20%, transparent);
		color: var(--error);
	}
</style>
