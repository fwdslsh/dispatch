<script>
	import { onMount, onDestroy } from 'svelte';
	import Modal from '$lib/client/shared/components/Modal.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import {
		createSettingsPageState,
		setActiveSection,
		recordSaveMessage,
		recordError,
		translateSettingsError
	} from '$lib/client/settings/pageState.js';

	let { open = $bindable(false), onclose = () => {} } = $props();

	let settingsState = $state(createSettingsPageState());
	let sectionRenderCounters = $state({});

	const sections = $derived(settingsState.sections);
	const activeSection = $derived(
		sections.find((section) => section.id === settingsState.activeSection)
	);
	const activeRenderKey = $derived(
		`${settingsState.activeSection}:${sectionRenderCounters[settingsState.activeSection] ?? 0}`
	);

	const activeSectionHandlers = $derived(() => {
		if (!activeSection) return null;
		return {
			onSave: (payload) => handleSectionSave(activeSection.id, payload),
			onError: (payload) => handleSectionError(activeSection.id, payload)
		};
	});

	function resetState() {
		const nextState = createSettingsPageState();
		settingsState.sections = nextState.sections;
		settingsState.activeSection = nextState.activeSection;
		settingsState.error = null;
		settingsState.savedMessage = null;
		sectionRenderCounters = {};
	}

	function getSectionById(sectionId) {
		return sections.find((section) => section.id === sectionId);
	}

	function focusTabByIndex(index) {
		const clamped = Math.max(0, Math.min(sections.length - 1, index));
		const section = sections[clamped];
		if (!section) return;
		const element = document.getElementById(`modal-settings-tab-${section.id}`);
		element?.focus();
	}

	function handleSectionSelect(sectionId) {
		setActiveSection(settingsState, sectionId);
	}

	function handleSectionKeydown(event, index) {
		if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
			return;

		event.preventDefault();

		if (event.key === 'Home') {
			focusTabByIndex(0);
			return;
		}

		if (event.key === 'End') {
			focusTabByIndex(sections.length - 1);
			return;
		}

		const direction = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
		focusTabByIndex(index + direction);
	}

	function handleSectionSave(sectionId, payload) {
		const section = getSectionById(sectionId);
		const label = section?.label ?? 'Settings';
		let message = typeof payload === 'string' ? payload : payload?.message;
		if (!message) {
			message = `${label} saved successfully`;
		}
		recordSaveMessage(settingsState, message);
	}

	function normalizeError(sectionId, rawError) {
		if (!rawError) {
			return { type: 'unknown', sectionId };
		}

		if (typeof rawError === 'string') {
			return { type: 'custom', message: rawError, sectionId };
		}

		return { sectionId, ...rawError };
	}

	function handleSectionError(sectionId, rawError) {
		const normalized = normalizeError(sectionId, rawError);
		const message = translateSettingsError(normalized);
		recordError(settingsState, message);
		console.error('[settings-modal] section error', normalized);
	}

	function retryActiveSection() {
		const id = settingsState.activeSection;
		if (!id) return;
		sectionRenderCounters[id] = (sectionRenderCounters[id] ?? 0) + 1;
		settingsState.error = null;
		settingsState.savedMessage = null;
	}

	function handleComponentErrorEvent(event) {
		if (!open) return;
		const detail = event.detail ?? {};
		const sectionId = detail.sectionId ?? settingsState.activeSection;
		if (!sectionId) return;
		handleSectionError(sectionId, {
			type: 'component-load',
			sectionId,
			reason: detail.reason
		});
	}

	onMount(() => {
		window.addEventListener('dispatch:settings-component-error', handleComponentErrorEvent);
	});

	onDestroy(() => {
		window.removeEventListener('dispatch:settings-component-error', handleComponentErrorEvent);
	});

	$effect(() => {
		if (!open) return;
		resetState();
	});
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

	{#if settingsState.error}
		<div class="settings-banner error" role="alert">
			<span>{settingsState.error}</span>
			<Button variant="ghost" size="small" onclick={retryActiveSection}>Retry</Button>
		</div>
	{:else if settingsState.savedMessage}
		<div class="settings-banner success" role="status">
			{settingsState.savedMessage}
		</div>
	{/if}

	<div class="settings-container flex">
		<nav class="settings-nav flex-col" aria-label="Settings sections" role="tablist">
			{#each sections as section, index}
				<button
					id={`modal-settings-tab-${section.id}`}
					type="button"
					class="settings-tab flex gap-3 p-3 px-4"
					style="align-items: center;"
					class:active={settingsState.activeSection === section.id}
					onclick={() => handleSectionSelect(section.id)}
					onkeydown={(event) => handleSectionKeydown(event, index)}
					role="tab"
					aria-selected={settingsState.activeSection === section.id}
					aria-controls={`modal-settings-panel-${section.id}`}
					tabindex={settingsState.activeSection === section.id ? 0 : -1}
					title={section.navAriaLabel}
				>
					<svelte:component this={section.icon} size={18} />
					<span class="tab-label">{section.label}</span>
				</button>
			{/each}
		</nav>

		<main class="settings-content">
			{#if activeSection}
				<div
					class="settings-panel p-6"
					role="tabpanel"
					aria-labelledby={`modal-settings-tab-${activeSection.id}`}
					id={`modal-settings-panel-${activeSection.id}`}
				>
					{#key activeRenderKey}
						<svelte:component
							this={activeSection.component}
							onSave={activeSectionHandlers?.onSave}
							onError={activeSectionHandlers?.onError}
						/>
					{/key}
				</div>
			{/if}
		</main>
	</div>
</Modal>

<style>
	.settings-banner {
		margin-bottom: var(--space-3);
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-lg);
		font-family: var(--font-mono);
		font-size: 0.9rem;
	}

	.settings-banner.error {
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: var(--color-error, #ef4444);
	}

	.settings-banner.success {
		background: rgba(46, 230, 107, 0.12);
		border: 1px solid rgba(46, 230, 107, 0.4);
		color: var(--primary);
	}

	.settings-container {
		height: 600px;
		min-height: 500px;
		background: var(--bg);
		border-radius: 0;
		overflow: hidden;
	}

	.settings-nav {
		width: 200px;
		background: var(--bg-dark);
		border-right: 2px solid var(--primary-dim);
		padding: var(--space-4) 0;
		flex-shrink: 0;
	}

	.settings-tab {
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

	.settings-content {
		flex: 1;
		overflow: auto;
		background: var(--bg);
		position: relative;
	}

	.settings-panel {
		height: 100%;
		min-height: 500px;
		position: relative;
	}

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
			min-height: 300px;
		}
	}
</style>
