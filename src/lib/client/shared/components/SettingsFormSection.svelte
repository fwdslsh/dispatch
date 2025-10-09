<script>
	/**
	 * SettingsFormSection Component
	 * Container for grouped form fields with title and description
	 *
	 * Used to organize related settings into visual sections
	 * Provides consistent styling across all settings pages
	 */

	let {
		// Section content
		title,
		subtitle = '',

		// Optional visual enhancements
		variant = 'default', // 'default' | 'elevated' | 'card'

		// Content
		children,

		// HTML attributes
		class: customClass = '',
		...restProps
	} = $props();

	const sectionClass = $derived(() => {
		const classes = ['settings-section'];
		if (variant === 'card') classes.push('settings-card');
		if (variant === 'elevated') classes.push('settings-section--elevated');
		return classes.join(' ');
	});
</script>

<section class="{sectionClass} {customClass}" {...restProps}>
	{#if title}
		<header class="settings-section-header">
			<h3 class="settings-section-header__title">{title}</h3>
			{#if subtitle}
				<p class="settings-section-header__description">{subtitle}</p>
			{/if}
		</header>
	{/if}

	<div class="settings-section-content">
		{#if children}
			{@render children()}
		{/if}
	</div>
</section>

<style>
	/* Additional section-specific styles */
	.settings-section-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.settings-section--elevated {
		background: var(--elev);
	}

	/* Spacing when header is present */
	.settings-section-header + .settings-section-content {
		margin-top: var(--space-4);
	}
</style>
