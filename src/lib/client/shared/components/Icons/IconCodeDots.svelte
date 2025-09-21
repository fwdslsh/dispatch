<script>
	let { size = 16, ...rest } = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	{...rest}
>
	<path stroke="none" d="M0 0h24v24H0z" fill="none" />
	<path d="M7 8l-4 4l4 4" />
	<path d="M17 8l4 4l-4 4" />
	<path d="M14 4l0 .01" />
	<path d="M14 8l0 .01" />
	<path d="M14 12l0 .01" />
	<path d="M14 16l0 .01" />
	<path d="M14 20l0 .01" />
</svg>
