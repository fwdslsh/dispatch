<!--
	SessionViewport.svelte

	Session content rendering component with dynamic component selection
	Renders Claude or Terminal pane based on session type
-->
<script>
	import { getClientSessionModule } from '$lib/client/shared/session-modules/index.js';
	import { createLogger } from '$lib/client/shared/utils/logger.js';

	const log = createLogger('workspace:session-viewport');

	// Props
	let { session, isLoading = false, index = 0 } = $props();

	const sessionModule = $derived(() => {
		if (!session || !(session.type || session.sessionType)) return null;
		return getClientSessionModule(session.type || session.sessionType);
	});

	const Component = $derived.by(() => sessionModule()?.component ?? null);

	// Session-specific props for the rendered component
	const sessionProps = $derived(() => {
		if (session && session.id) {
			log.debug('Processing session', {
				id: session.id,
				type: session.type || session.sessionType,
				index
			});
		}

		if (!session || !session.id) {
			log.error('Invalid session - missing ID', session);
			return null;
		}

		const moduleDef = sessionModule();
		if (!moduleDef) {
			log.error('No session module registered for type', session.type || session.sessionType);
			return null;
		}

		try {
			const props = moduleDef.prepareProps(session);
			log.debug('Prepared session props', { type: session.type || session.sessionType, props });
			return props;
		} catch (error) {
			log.error('Failed to prepare session props', error);
			return null;
		}
	});
</script>

<div class="session-viewport" class:loading={isLoading}>
	{#if isLoading}
		<div class="loading-indicator">
			<div class="loading-spinner"></div>
			<p>
				Loading {(session.type || session.sessionType) === 'claude' ? 'Claude' : 'Terminal'} session...
			</p>
		</div>
	{:else if Component && sessionProps()}
		{#key session.id}
			<Component {...sessionProps()} />
		{/key}
	{:else}
		<div class="error-state">
			<p>Unknown session type: {session.type || session.sessionType}</p>
		</div>
	{/if}
</div>

<style>
	.session-viewport {
		flex: 1;
		overflow: hidden;
		background: var(--bg-dark);
		min-height: 0;
		display: flex;
		flex-direction: column;
		position: relative;
		contain: layout;
		text-align: justify;
	}

	.loading-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: var(--space-3);
		color: var(--text-muted);
	}

	.loading-spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--surface-border);
		border-top: 2px solid var(--primary);
		border-radius: var(--radius-full);
		animation: spin 1s linear infinite;
	}

	.loading-indicator p {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		margin: 0;
	}

	.error-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-error);
		font-family: var(--font-mono);
	}

	.error-state p {
		margin: 0;
	}

	/* Mobile viewport adjustments */
	@media (max-width: 768px) {
		.session-viewport {
			/* Ensure full height is used on mobile */
			flex: 1 1 auto;
			min-height: 0;
			height: 100%;
		}
	}

	/* Animation for loading spinner */
	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
