<script>
	let { size = 24, ...restProps } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	{...restProps}
>
	<circle cx="12" cy="12" r="4"></circle>
	<path d="M1.05 12H7"></path>
	<path d="m17 12h6.95"></path>
</svg>
