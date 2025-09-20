<script>
	import Tile from './Tile.svelte';
	import Split from './Split.svelte';

	/**
	 * @typedef {import('./types.js').LayoutNode} LayoutNode
	 * @typedef {Extract<LayoutNode, {type:'split'}>} SplitNode
	 */

	let {
		/** @type {SplitNode} */ node,
		/** @type {number} */ gap = 6,
		/** @type {number} */ minSize = 48,
		/** @type {string} */ focused = '',
		/** @type {import('svelte').Snippet<[{focused: string, tileId: string}]>} */ tile,
		/** @type {(id: string) => void} */ onfocus = () => {},
		/** @type {(node: SplitNode, ratio: number) => void} */ onratioupdate = () => {}
	} = $props();

	/** @type {HTMLElement|null} */ let splitEl = $state(null);

	// Drag divider to set node.ratio
	/** @param {MouseEvent|TouchEvent} ev */
	function startDrag(ev) {
		ev.preventDefault();
		if (!splitEl) return;

		const isRow = node.dir === 'row';
		const rect = splitEl.getBoundingClientRect();
		const start = point(ev);
		const startRatio = node.ratio;

		const move = (e) => {
			const p = point(e);
			const delta = isRow ? p.x - start.x : p.y - start.y;
			const total = isRow ? rect.width : rect.height;
			const dr = total ? delta / total : 0;
			const newRatio = clamp(startRatio + dr, 0.1, 0.9);
			onratioupdate(node, newRatio);
		};
		const up = () => {
			window.removeEventListener('mousemove', move);
			window.removeEventListener('mouseup', up);
			window.removeEventListener('touchmove', move);
			window.removeEventListener('touchend', up);
		};

		window.addEventListener('mousemove', move);
		window.addEventListener('mouseup', up);
		window.addEventListener('touchmove', move, { passive: false });
		window.addEventListener('touchend', up);
	}

	/** @param {MouseEvent|TouchEvent} e */
	function point(e) {
		// @ts-ignore
		const t = e.touches && e.touches[0];
		return t ? { x: t.clientX, y: t.clientY } : /** @type {MouseEvent} */ (e);
	}

	/** @param {number} v @param {number} a @param {number} b */
	function clamp(v, a, b) {
		return Math.min(b, Math.max(a, v));
	}

	// Handle focus events by calling parent's onfocus handler
	function handleFocus(id) {
		onfocus(id);
	}
</script>

<!--
  Structural only. Use your global CSS to set:
  .wm-split { display:flex; width:100%; height:100%; }
  .wm-split[data-dir="row"] { flex-direction:row; }
  .wm-split[data-dir="column"] { flex-direction:column; }
  .wm-pane { display:flex; min-width/min-height via data attrs if desired; }
  .wm-divider { width/height based on [data-dir] & gap; cursor col/row-resize }
-->
<div class="wm-split" data-dir={node.dir} bind:this={splitEl}>
	<div class="wm-pane wm-pane-a" style={`flex:${node.ratio} 1 0;`} data-min={minSize}>
		{#if node.a?.type === 'leaf'}
			<Tile
				id={node.a.id}
				{focused}
				onfocus={handleFocus}
			>
				{@render tile({ focused, tileId: node.a.id })}
			</Tile>
		{:else if node.a?.type === 'split'}
			<Split node={node.a} {gap} {minSize} {focused} {tile} onfocus={handleFocus} {onratioupdate} />
		{/if}
	</div>

	<!-- Divider (unstyled) -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<!-- svelte-ignore a11y_role_has_required_aria_props -->
	<div
		class="wm-divider"
		role="separator"
		aria-orientation={node.dir === 'row' ? 'vertical' : 'horizontal'}
		data-dir={node.dir}
		onmousedown={startDrag}
		ontouchstart={startDrag}
		data-gap={gap}
	></div>

	<div class="wm-pane wm-pane-b" style={`flex:${1 - node.ratio} 1 0;`} data-min={minSize}>
		{#if node.b?.type === 'leaf'}
			<Tile
				id={node.b.id}
				{focused}
				onfocus={handleFocus}
			>
				{@render tile({ focused, tileId: node.b.id })}
			</Tile>
		{:else if node.b?.type === 'split'}
			<Split node={node.b} {gap} {minSize} {focused} {tile} onfocus={handleFocus} {onratioupdate} />
		{/if}
	</div>
</div>
