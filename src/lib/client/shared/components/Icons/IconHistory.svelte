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
	<path stroke="none" d="M0 0h24v24H0z" fill="none"/>
	<path d="M12 8v4l3 3" />
	<path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
</svg>