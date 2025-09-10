<script>
	import ReadActivity from './ReadActivity.svelte';
	import WriteActivity from './WriteActivity.svelte';
	import EditActivity from './EditActivity.svelte';
	import BashActivity from './BashActivity.svelte';
	import GrepActivity from './GrepActivity.svelte';
	import GlobActivity from './GlobActivity.svelte';
	import GenericActivity from './GenericActivity.svelte';
	
	let { icon } = $props();
	
	// Determine which component to use based on the event
	let activityComponent = $derived(getActivityComponent(icon));
	
	function getActivityComponent(iconData) {
		if (!iconData || !iconData.event) {
			return { component: GenericActivity, props: { event: null } };
		}
		
		const event = iconData.event;
		const tool = (event.tool || event.name || '').toString().toLowerCase();
		const type = (event.type || '').toString().toLowerCase();
		
		// Map tools to their specific components
		if (tool.includes('read')) {
			return { component: ReadActivity, props: { event } };
		}
		if (tool.includes('write')) {
			return { component: WriteActivity, props: { event } };
		}
		if (tool.includes('edit') || tool.includes('multiedit')) {
			return { component: EditActivity, props: { event } };
		}
		if (tool.includes('bash') || tool.includes('shell') || tool.includes('exec')) {
			return { component: BashActivity, props: { event } };
		}
		if (tool.includes('grep') || tool.includes('search')) {
			return { component: GrepActivity, props: { event } };
		}
		if (tool.includes('glob')) {
			return { component: GlobActivity, props: { event } };
		}
		
		// Fallback to generic component
		return { 
			component: GenericActivity, 
			props: { 
				event, 
				type: type || 'Activity',
				tool: tool || ''
			} 
		};
	}
</script>

<div class="activity-summary-wrapper">
	{#if activityComponent}
		<svelte:component 
			this={activityComponent.component} 
			{...activityComponent.props} 
		/>
	{:else}
		<div class="activity-error">No activity data available</div>
	{/if}
</div>

<style>
	.activity-summary-wrapper {
		width: 100%;
		overflow: hidden;
	}
	
	.activity-error {
		color: var(--err);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		padding: var(--space-3);
		text-align: center;
		opacity: 0.8;
	}
</style>