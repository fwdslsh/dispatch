<script>
	import { onMount, onDestroy, setContext } from 'svelte';
	import Shell from '$lib/client/shared/components/Shell.svelte';
	import StatusBar from '$lib/client/shared/components/StatusBar.svelte';
	import Header from '$lib/client/shared/components/Header.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import {
		useServiceContainer,
		provideServiceContainer
	} from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import {
		createSettingsPageState,
		setActiveSection,
		recordSaveMessage,
		recordError,
		translateSettingsError
	} from '$lib/client/settings/pageState.js';
	import "$lib/client/settings/settings.css"; 

	let serviceContainer = $state(null);
	let isLoading = $state(true);
	let initializationError = $state(null);
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

	function getSectionById(sectionId) {
		return sections.find((section) => section.id === sectionId);
	}

	function focusTabByIndex(index) {
		const clamped = Math.max(0, Math.min(sections.length - 1, index));
		const section = sections[clamped];
		if (!section) return;
		const element = document.getElementById(`settings-tab-${section.id}`);
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
		console.error('[settings] section error', normalized);
	}

	function retryActiveSection() {
		const id = settingsState.activeSection;
		if (!id) return;
		sectionRenderCounters[id] = (sectionRenderCounters[id] ?? 0) + 1;
		settingsState.error = null;
		settingsState.savedMessage = null;
	}

	function handleComponentErrorEvent(event) {
		const detail = event.detail ?? {};
		const sectionId = detail.sectionId ?? settingsState.activeSection;
		if (!sectionId) return;
		handleSectionError(sectionId, {
			type: 'component-load',
			sectionId,
			reason: detail.reason
		});
	}

	onMount(async () => {
		try {
			try {
				serviceContainer = useServiceContainer();
			} catch {
				serviceContainer = provideServiceContainer({
					apiBaseUrl: '',
					authTokenKey: 'dispatch-auth-token',
					debug: false
				});
			}

			setContext('services', serviceContainer);

			const url = new URL(window.location.href);
			const requestedSection = url.searchParams.get('section');
			if (requestedSection) {
				const target = setActiveSection(settingsState, requestedSection);
				if (target !== requestedSection) {
					handleSectionError(requestedSection, {
						type: 'section-not-found',
						sectionId: requestedSection
					});
				}
			}

			window.addEventListener('dispatch:settings-component-error', handleComponentErrorEvent);
		} catch (err) {
			console.error('Failed to initialize settings:', err);
			initializationError = 'Failed to load settings system';
		} finally {
			isLoading = false;
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('dispatch:settings-component-error', handleComponentErrorEvent);
		}
	});
</script>

<svelte:head>
	<title>Settings - Dispatch</title>
	<meta
		name="description"
		content="Configure your Dispatch preferences, workspace environment, retention policies, and integrations."
	/>
</svelte:head>

<Shell>
	{#snippet header()}
		<Header />
	{/snippet}

	<div class="settings-page main-content">
		{#if isLoading}
			<div class="loading-state">
				<div class="spinner" aria-hidden="true"></div>
				<p>Loading settings...</p>
			</div>
		{:else if initializationError}
			<div class="error-container" role="alert">
				<h2>Settings Error</h2>
				<p>{initializationError}</p>
			</div>
		{:else}
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

			<div class="settings-container">
				<nav class="settings-nav" aria-label="Settings sections" role="tablist">
					{#each sections as section, index}
						<button
							id={`settings-tab-${section.id}`}
							type="button"
							class="settings-tab flex gap-3"
							class:active={settingsState.activeSection === section.id}
							onclick={() => handleSectionSelect(section.id)}
							onkeydown={(event) => handleSectionKeydown(event, index)}
							role="tab"
							aria-selected={settingsState.activeSection === section.id}
							aria-controls={`settings-panel-${section.id}`}
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
							class="settings-panel"
							role="tabpanel"
							aria-labelledby={`settings-tab-${activeSection.id}`}
							id={`settings-panel-${activeSection.id}`}
						>
							{#key activeRenderKey}
								<svelte:component
									this={activeSection.component}
									onSave={activeSectionHandlers?.onSave}
									onError={activeSectionHandlers?.onError}
								/>
							{/key}
						</div>
					{:else}
						<p class="empty-state">Select a section to view settings.</p>
					{/if}
				</main>
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<StatusBar />
	{/snippet}
</Shell>

<style>
	.settings-page {
		height: 100%;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		gap: var(--space-3);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 2px solid currentColor;
		border-top: 2px solid transparent;
		border-radius: var(--radius-full);
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.settings-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3) var(--space-4);
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
		display: flex;
		min-height: 100%;
	}

	.settings-nav {
		width: 240px;
		background: var(--bg-dark);
		border: 1px solid var(--primary);
		padding: var(--space-3) 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		flex-shrink: 0;
	}

	.settings-tab {
		border: none;
		background: transparent;
		color: var(--text-muted);
		padding: var(--space-3) var(--space-4);
		text-align: left;
		cursor: pointer;
		transition:
			background 0.2s ease,
			color 0.2s ease;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		align-items: center;
		border-left: 3px solid transparent;
	}

	.settings-tab:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
	}

	.settings-tab:hover {
		background: var(--elev);
		color: var(--primary);
	}

	.settings-tab.active {
		background: var(--elev);
		color: var(--primary);
		border-left-color: var(--primary);
	}

	.tab-label {
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.settings-content {
		flex: 1;
		background: var(--bg-dark);
		border: 1px solid rgba(46, 230, 107, 0.2);
		overflow: hidden;
		position: relative;
	}

	.settings-panel {
		height: 100%;
		overflow: auto;
		padding: var(--space-5);
		position: relative;
		background: var(--bg);
	}

	.settings-panel::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: repeating-linear-gradient(
			0deg,
			transparent 0px,
			transparent 2px,
			var(--scan-line) 3px,
			transparent 4px
		);
		opacity: 0.08;
	}

	.empty-state {
		padding: var(--space-5);
		color: var(--text-muted);
		font-family: var(--font-mono);
	}

	.error-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
	}

	@media (max-width: 1024px) {
		.settings-container {
			flex-direction: column;
			min-height: auto;
		}

		.settings-nav {
			width: 100%;
			flex-direction: row;
			overflow-x: auto;
		}

		.settings-tab {
			flex: 1 0 auto;
			justify-content: center;
			border-left: none;
			border-bottom: 3px solid transparent;
		}

		.settings-tab.active {
			border-bottom-color: var(--primary);
		}

		.settings-content {
			min-height: 400px;
		}
	}
</style>
