<script>
	/**
	 * @component ApiDocs
	 * @description
	 * Interactive API documentation viewer using RapiDoc.
	 * Displays the OpenAPI 3.0 specification with interactive request builder.
	 */
	import { onMount } from 'svelte';

	let loaded = $state(false);

	onMount(() => {
		// Load RapiDoc web component
		const script = document.createElement('script');
		script.src = 'https://unpkg.com/rapidoc@9.3.4/dist/rapidoc-min.js';
		script.type = 'module';
		script.onload = () => {
			loaded = true;
		};
		document.head.appendChild(script);

		return () => {
			if (script.parentNode) {
				script.parentNode.removeChild(script);
			}
		};
	});
</script>

<svelte:head>
	<title>API Documentation - Dispatch</title>
	<meta name="description" content="Interactive API documentation for Dispatch REST API" />
</svelte:head>

<div class="api-docs-container">
	{#if loaded}
		<rapi-doc
			spec-url="/openapi.json"
			theme="dark"
			bg-color="#0a0a0f"
			text-color="#e5e7eb"
			primary-color="#06b6d4"
			nav-bg-color="#1a1a24"
			nav-text-color="#e5e7eb"
			nav-hover-bg-color="#2a2a34"
			nav-hover-text-color="#06b6d4"
			nav-accent-color="#06b6d4"
			render-style="focused"
			show-header="true"
			show-info="true"
			allow-authentication="true"
			allow-server-selection="true"
			allow-api-list-style-selection="false"
			schema-style="table"
			schema-expand-level="1"
			default-schema-tab="schema"
			response-area-height="400px"
			allow-search="true"
			allow-try="true"
			allow-spec-url-load="false"
			allow-spec-file-load="false"
			heading-text="Dispatch API Documentation"
			regular-font="'Inter', system-ui, sans-serif"
			mono-font="'JetBrains Mono', 'Fira Code', monospace"
		></rapi-doc>
	{:else}
		<div class="loading-container">
			<div class="spinner"></div>
			<p>Loading API Documentation...</p>
		</div>
	{/if}
</div>

<style>
	.api-docs-container {
		width: 100%;
		height: 100vh;
		overflow: hidden;
		background: #0a0a0f;
	}

	rapi-doc {
		width: 100%;
		height: 100%;
		display: block;
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		gap: 1rem;
		color: #e5e7eb;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid rgba(6, 182, 212, 0.1);
		border-top-color: #06b6d4;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-container p {
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 0.875rem;
		color: #9ca3af;
	}

	/* Override RapiDoc styles for better dark theme */
	:global(rapi-doc) {
		--font-family: 'Inter', system-ui, sans-serif;
		--code-font-family: 'JetBrains Mono', 'Fira Code', monospace;
	}
</style>
