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
				<div class="settings-nav" aria-label="Settings sections" role="tablist">
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
				</div>

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
