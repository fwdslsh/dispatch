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
	<circle cx="12" cy="18" r="3"></circle>
	<circle cx="6" cy="6" r="3"></circle>
	<circle cx="18" cy="6" r="3"></circle>
	<path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"></path>
	<path d="M12 12v3"></path>
</svg>
