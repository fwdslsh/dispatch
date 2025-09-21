<!--
	SessionHeaderRenderer.svelte

	Dynamic session header rendering component
	Renders custom header component from session module if available, otherwise uses default SessionHeader
-->
<script>
	import { getClientSessionModule } from '$lib/client/shared/session-modules/index.js';
	import { createLogger } from '$lib/client/shared/utils/logger.js';
	import SessionHeader from './SessionHeader.svelte';

	const log = createLogger('workspace:session-header-renderer');

	// Props
	let { session, onClose = () => {}, index = 0 } = $props();

	const sessionModule = $derived(() => {
		if (!session || !(session.type || session.sessionType)) return null;
		return getClientSessionModule(session.type || session.sessionType);
	});

	const HeaderComponent = $derived.by(() => sessionModule()?.header ?? null);

	// Session-specific props for the rendered header component
	const headerProps = $derived(() => {
		if (session && session.id) {
			log.debug('Processing session header', {
				id: session.id,
				type: session.type || session.sessionType,
				index,
				hasCustomHeader: !!HeaderComponent
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

		// If there's a custom header component, prepare props for it
		if (HeaderComponent && moduleDef.prepareHeaderProps) {
			try {
				const props = moduleDef.prepareHeaderProps(session, { onClose, index });
				log.debug('Prepared header props', { type: session.type || session.sessionType, props });
				return props;
			} catch (error) {
				log.error('Failed to prepare header props', error);
				return null;
			}
		}

		// For default header, return the standard props
		return { session, onClose, index };
	});
</script>

<div class="session-header-renderer">
	{#if HeaderComponent && headerProps()}
		{#key session.id}
			<HeaderComponent {...headerProps()} />
		{/key}
	{:else}
		<!-- Fallback to default header -->
		<SessionHeader {session} {onClose} {index} />
	{/if}
</div>

<style>
	.session-header-renderer {
		/* Ensure the renderer takes full width */
		width: 100%;
	}
</style>