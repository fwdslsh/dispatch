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