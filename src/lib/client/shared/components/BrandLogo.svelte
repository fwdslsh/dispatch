<script>
	import AppVersion from './AppVersion.svelte';
	import Logo from './Logo.svelte';
</script>

<!--
	BrandLogo.svelte

	Brand logo component for the workspace header
	Responsive design that adapts to different screen sizes
-->

<div class="brand-logo">
	<span class="brand-icon">
		<Logo height={32} width={32} />
	</span>
	<a href="/workspace">
		<span class="brand-text">Dispatch</span>
		<AppVersion /></a
	>
</div>

<style>
	.brand-logo {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-accent);
		user-select: none;
		font-weight: 700;
		a {
			appearance: none;
			text-decoration: none;
			color: inherit;
			border-bottom: none;
		}
	}

	.brand-icon {
		font-size: 1.25rem;
		color: var(--primary);
		filter: drop-shadow(0 0 5px var(--primary-glow));
		justify-content: center;
		display: flex;
	}

	.brand-icon img {
		max-width: 100%;
		height: 32px;
		width: auto;
		display: block;
	}

	.brand-text {
		color: var(--primary);
		font-size: 1.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Mobile adjustments */
	@media (max-width: 768px) {
		.brand-icon img {
			display: none;
		}
	}
</style>
