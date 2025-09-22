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
	<line x1="6" y1="3" x2="6" y2="15"></line>
	<circle cx="18" cy="6" r="3"></circle>
	<circle cx="6" cy="18" r="3"></circle>
	<path d="m18 9a9 9 0 0 1-9 9"></path>
</svg>
