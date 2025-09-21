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
	<!-- First folder (source) -->
	<path d="M3 6h4l2 2h6a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2" />
	<!-- Second folder (clone) offset -->
	<path d="M7 2h4l2 2h6a2 2 0 0 1 2 2v6" stroke-dasharray="3,3" opacity="0.6" />
</svg>
