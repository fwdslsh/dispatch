<!--
	OAuth Settings Page
	Route for configuring OAuth providers (GitHub, Google)
-->

<script>
	import OAuthSettings from '$lib/client/settings/OAuthSettings.svelte';
	import Shell from '$lib/client/shared/components/Shell.svelte';

	export let data;
</script>

<svelte:head>
	<title>OAuth Settings - Dispatch</title>
	<meta name="description" content="Configure OAuth authentication providers for Dispatch" />
</svelte:head>

<Shell>
	<div class="settings-page">
		<div class="settings-container">
			<div class="page-header">
				<h1>OAuth Provider Settings</h1>
				<p class="page-description">
					Configure external authentication providers to allow users to log in via OAuth.
				</p>
			</div>

			<OAuthSettings />
		</div>
	</div>
</Shell>

<style>
	.settings-page {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: var(--space-6);
		overflow-y: auto;
	}

	.settings-container {
		max-width: 800px;
		width: 100%;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: var(--space-6);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--line);
	}

	.page-header h1 {
		margin: 0 0 var(--space-2) 0;
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-4);
		font-weight: 600;
	}

	.page-description {
		margin: 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.5;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.settings-page {
			padding: var(--space-4);
		}

		.page-header h1 {
			font-size: var(--font-size-3);
		}
	}
</style>
