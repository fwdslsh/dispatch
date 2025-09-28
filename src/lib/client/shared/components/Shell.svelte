<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import '$lib/client/shared/styles/index.css';
	import { getStoredAuthToken } from '$lib/client/shared/socket-auth.js';
	import {
		useServiceContainer,
		provideServiceContainer
	} from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { OnboardingViewModel } from '$lib/client/onboarding/OnboardingViewModel.svelte.js';
	let { children, header = null, footer = null } = $props();
	
	

	onMount(async () => {
		
	});


</script>


<div class="dispatch-app">
	{@render header?.()}

	<main class="app-main">
		{@render children()}
	</main>

	{@render footer?.()}
</div>


<style>
	/* Global layout structure */
	.dispatch-app {
		position: relative;
		height: 100vh;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		background: transparent;
		color: var(--text-primary);
		overflow: hidden;
		max-width: 100svw;
		width: 100%;
		overscroll-behavior: none;
		touch-action: pan-x pan-y;
	}

	/* Main content area - takes remaining vertical space */
	.app-main {
		flex: 1 1 auto;
		overflow: hidden;
		position: relative;
		min-width: 0;
		min-height: 0;
		overscroll-behavior: none;
		touch-action: pan-x pan-y;
		width: 100%;
	}

	/* Background image overlay - reused from workspace */
	.dispatch-app::before {
		content: '';
		position: absolute;
		inset: 0;
		opacity: 0.09;
		background-image: url('/fwdslsh-green-bg.png');
		background-repeat: no-repeat;
		background-position: center center;
		background-size: contain;
		pointer-events: none;
		z-index: -1;
	}

	/* Mobile responsive adjustments */
	@media (max-width: 480px) {
		.dispatch-app {
			padding-bottom: max(0.4rem, env(safe-area-inset-bottom));
		}
	}
</style>

