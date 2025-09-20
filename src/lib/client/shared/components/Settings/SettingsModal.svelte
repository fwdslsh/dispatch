<script>
	import Modal from '$lib/client/shared/components/Modal.svelte';
	import GlobalSettings from './GlobalSettings.svelte';
	import ClaudeAuth from '../../../claude/ClaudeAuth.svelte';
	import StorageSettings from './StorageSettings.svelte';
	import IconSettings from '../Icons/IconSettings.svelte';
	import IconCloud from '../Icons/IconCloud.svelte';
	import IconFolder from '../Icons/IconFolder.svelte';
	import IconTrash from '../Icons/IconTrash.svelte';

	/**
	 * Settings Modal Component
	 * Main settings interface with tabbed sections for different configuration areas
	 */

	let { open = $bindable(false), onclose = () => {} } = $props();

	// Active tab state
	let activeTab = $state('global');

	// Available settings tabs
	const tabs = [
		{ id: 'global', label: 'Global', icon: IconSettings, component: GlobalSettings },
		{ id: 'claude', label: 'Claude', icon: IconCloud, component: ClaudeAuth },
		{ id: 'storage', label: 'Storage', icon: IconTrash, component: StorageSettings }
	];

	// Get active tab component
	const activeTabData = $derived(tabs.find((tab) => tab.id === activeTab));
</script>

<Modal
	{onclose}
	bind:open
	title="Settings"
	size="large"
	augmented="tl-clip tr-clip bl-clip br-clip both"
>
	{#snippet footer()}
		<!-- No footer needed for settings modal -->
	{/snippet}
	<div class="settings-container">
		<!-- Settings Navigation -->
		<nav class="settings-nav" aria-label="Settings sections">
			{#each tabs as tab}
				<button
					class="settings-tab"
					class:active={activeTab === tab.id}
					onclick={() => (activeTab = tab.id)}
					role="tab"
					aria-selected={activeTab === tab.id}
					aria-controls="settings-panel-{tab.id}"
					id="settings-tab-{tab.id}"
				>
					{#key tab.icon}
						<tab.icon size={18} />
					{/key}
					<span class="tab-label">{tab.label}</span>
				</button>
			{/each}
		</nav>

		<!-- Settings Content -->
		<main class="settings-content">
			{#if activeTabData}
				<div
					class="settings-panel"
					role="tabpanel"
					aria-labelledby="settings-tab-{activeTab}"
					id="settings-panel-{activeTab}"
				>
					{#key activeTabData.component}
						<activeTabData.component />
					{/key}
				</div>
			{/if}
		</main>
	</div>
</Modal>

<style>
	.settings-container {
		display: flex;
		height: 600px;
		min-height: 500px;
		background: var(--bg);
		border-radius: 0;
		overflow: hidden;
	}

	/* Settings Navigation */
	.settings-nav {
		width: 200px;
		background: var(--bg-dark);
		border-right: 2px solid var(--primary-dim);
		display: flex;
		flex-direction: column;
		padding: var(--space-4) 0;
		flex-shrink: 0;
	}

	.settings-tab {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		text-align: left;
		border-left: 3px solid transparent;
		margin: 2px 0;
	}

	.settings-tab:hover {
		background: rgba(46, 230, 107, 0.05);
		color: var(--text-primary);
		border-left-color: var(--primary-dim);
	}

	.settings-tab.active {
		background: rgba(46, 230, 107, 0.1);
		color: var(--primary);
		border-left-color: var(--primary);
		box-shadow: inset 0 0 20px rgba(46, 230, 107, 0.1);
	}

	.settings-tab.active .tab-label {
		text-shadow: 0 0 8px var(--primary-glow);
	}

	.tab-label {
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Settings Content */
	.settings-content {
		flex: 1;
		overflow: auto;
		background: var(--bg);
		position: relative;
	}

	.settings-panel {
		padding: var(--space-6);
		height: 100%;
		min-height: 500px;
		position: relative;
	}

	/* Terminal scan lines effect */
	.settings-content::before {
		content: '';
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			0deg,
			transparent 0px,
			transparent 2px,
			var(--scan-line) 3px,
			transparent 4px
		);
		pointer-events: none;
		opacity: 0.15;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.settings-container {
			flex-direction: column;
			height: auto;
			min-height: 400px;
		}

		.settings-nav {
			width: 100%;
			flex-direction: row;
			padding: var(--space-2);
			overflow-x: auto;
			border-right: none;
			border-bottom: 2px solid var(--primary-dim);
		}

		.settings-tab {
			flex-shrink: 0;
			flex-direction: column;
			gap: var(--space-1);
			padding: var(--space-2);
			border-left: none;
			border-bottom: 3px solid transparent;
			min-width: 80px;
		}

		.settings-tab:hover,
		.settings-tab.active {
			border-left: none;
			border-bottom-color: var(--primary);
		}

		.tab-label {
			font-size: 0.75rem;
		}

		.settings-panel {
			padding: var(--space-4);
			min-height: 300px;
		}
	}
</style>
