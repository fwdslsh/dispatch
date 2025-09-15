<!--
	BrandLogo.svelte

	Brand logo component for the workspace header
	Responsive design that adapts to different screen sizes
-->

<div class="brand-logo">
	<span class="brand-icon">
		<img src="/favicon.png" alt="Dispatch" height="32" />
	</span>
	<span class="brand-text">Dispatch</span>
</div>

<style>
	.brand-logo {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-family: var(--font-accent);
		font-weight: 700;
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
			height: 22px;
		}

		.brand-text {
			display: none;
		}
	}
</style>
