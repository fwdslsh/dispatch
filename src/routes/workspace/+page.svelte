<!--
	Workspace Route - MVVM Architecture

	This route now uses the new modular WorkspacePage component
	which implements clean MVVM architecture with Svelte 5 runes.

	Replaces the previous 1,771-line monolithic component.
-->
<script>
	import WorkspacePage from '$lib/client/shared/components/workspace/WorkspacePage.svelte';
</script>

<!-- Use the new MVVM-based WorkspacePage component -->
<WorkspacePage />

<style>
	/* Ensure the workspace page takes full height */
	:global(html, body) {
		overflow-x: auto;
		/* Prevent pull-to-refresh on mobile */
		overscroll-behavior-y: none;
		overscroll-behavior: none;
	}
</style>
