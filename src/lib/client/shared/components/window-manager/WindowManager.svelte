<script>
	import { onMount } from 'svelte';
	import Split from './Split.svelte';
	import Tile from './Tile.svelte';
	import { on } from 'svelte/events';
	import { generateUUID } from '../../utils/uuid.js';

	/**
	 * @typedef {import('./types.js').LayoutNode} LayoutNode
	 * @typedef {import('./types.js').Leaf} Leaf
	 * @typedef {import('./types.js').SplitNode} SplitNode
	 * @typedef {import('./types.js').Keymap} Keymap
	 */

	// Props (runes)
	let {
		/** @type {LayoutNode|null} */ initial = null,
		/** @type {'row'|'column'} */ direction = 'row',
		/** @type {number} */ gap = 6,
		/** @type {number} */ minSize = 48,
		/** @type {Partial<Keymap>} */ keymap = {},
		/** @type {boolean} */ showEditMode = false,
		onfocuschange = (e) => {},
		onlayoutchange = (e) => {},
		oneditmodetoggle = (e) => {},
		/** @type {import('svelte').Snippet<[{focused: string, tileId: string, editMode: boolean, onSplitRight: () => void, onSplitDown: () => void, onClose: () => void}]>} */ tile
	} = $props();

	/** @type {LayoutNode} */
	let root = $state(initial ?? makeLeaf('root'));
	/** @type {string} */
	let focused = $state('root');
	/** @type {HTMLElement|null} */
	let containerEl = $state(null);
	/** @type {boolean} */
	let editMode = $state(showEditMode);

	/** @type {Keymap} */
	const DEFAULT_KEYMAP = {
		addRight: 'Control+Enter',
		addDown: 'Control+Shift+Enter',
		close: 'Control+Shift+x',
		focusNext: 'Alt+ArrowRight',
		focusPrev: 'Alt+ArrowLeft',
		growHeight: 'Control+ArrowUp',
		shrinkHeight: 'Control+ArrowDown'
	};

	/** @type {Keymap} */
	let KM = $derived({ ...DEFAULT_KEYMAP, ...keymap });

	// ---- helpers --------------------------------------------------------------

	/** @param {string} id */
	function makeLeaf(id) {
		return { type: /** @type {'leaf'} */ ('leaf'), id };
	}

	/**
	 * @param {'row'|'column'} dir
	 * @param {LayoutNode} a
	 * @param {LayoutNode} b
	 * @param {number} ratio
	 * @returns {SplitNode}
	 */
	function makeSplit(dir, a, b, ratio = 0.5) {
		return { type: /** @type {'split'} */ ('split'), dir, a, b, ratio };
	}

	/** @param {LayoutNode} n */
	function isLeaf(n) {
		return n.type === 'leaf';
	}

	/** @returns {string} */
	function rid() {
		return generateUUID();
	}

	/**
	 * Find a leaf and return traversal context.
	 * @param {LayoutNode} node
	 * @param {string} leafId
	 * @param {SplitNode|null} parent
	 * @param {SplitNode|null} grand
	 * @returns {{ node: Leaf, parent: SplitNode|null, grand: SplitNode|null, side: 'a'|'b' }|null}
	 */
	function findContext(node, leafId, parent = null, grand = null) {
		if (isLeaf(node))
			return node.id === leafId ? { node, parent, grand, side: /** @type {'a'} */ ('a') } : null;
		// search "a"
		const inA = isLeaf(node.a)
			? node.a.id === leafId
				? { node: node.a, parent: node, grand, side: /** @type {'a'} */ ('a') }
				: null
			: findContext(node.a, leafId, node, parent);
		if (inA) return inA;
		// search "b"
		const inB = isLeaf(node.b)
			? node.b.id === leafId
				? { node: node.b, parent: node, grand, side: /** @type {'b'} */ ('b') }
				: null
			: findContext(node.b, leafId, node, parent);
		return inB;
	}

	/**
	 * Flatten leaves in DFS order.
	 * @param {LayoutNode} node
	 * @param {string[]} out
	 */
	function flattenLeaves(node, out = []) {
		if (isLeaf(node)) {
			out.push(node.id);
			return out;
		}
		flattenLeaves(node.a, out);
		flattenLeaves(node.b, out);
		return out;
	}

	// ---- actions --------------------------------------------------------------

	/** @param {'row'|'column'} dir */
	function splitBesideCurrent(dir) {
		const ctx = findContext(root, focused, null, null);
		const newLeaf = makeLeaf(rid());

		if (!ctx || !ctx.parent) {
			// root is leaf
			root = makeSplit(dir, root, newLeaf, 0.5);
			focused = newLeaf.id;
			onlayoutchange?.({ detail: { layout: root } });
			return;
		}

		// Replace the focused leaf with a split of (leaf,newLeaf)
		const split = makeSplit(dir, ctx.node, newLeaf, 0.5);
		if (ctx.parent.a === ctx.node) ctx.parent.a = split;
		else ctx.parent.b = split;
		focused = newLeaf.id;
		onlayoutchange?.({ detail: { layout: root } });
	}

	function closeFocused() {
		const ctx = findContext(root, focused, null, null);
		if (!ctx) return;

		if (!ctx.parent) {
			// Root leaf: keep a fresh one to prevent empty tree
			root = makeLeaf('root');
			focused = 'root';
			onlayoutchange?.({ detail: { layout: root } });
			return;
		}

		// Collapse parent by promoting sibling
		const sibling = ctx.parent.a === ctx.node ? ctx.parent.b : ctx.parent.a;
		if (!ctx.grand) {
			// Parent is root
			root = sibling;
			focused = isLeaf(sibling) ? sibling.id : firstLeafId(sibling);
			onlayoutchange?.({ detail: { layout: root } });
			return;
		}
		if (ctx.grand.a === ctx.parent) ctx.grand.a = sibling;
		else ctx.grand.b = sibling;
		focused = isLeaf(sibling) ? sibling.id : firstLeafId(sibling);
		onlayoutchange?.({ detail: { layout: root } });
	}

	/** @param {LayoutNode} node */
	function firstLeafId(node) {
		return isLeaf(node) ? node.id : firstLeafId(node.a);
	}

	function focusNext() {
		const ids = flattenLeaves(root);
		const i = Math.max(0, ids.indexOf(focused));
		focused = ids[(i + 1) % ids.length];
	}

	function focusPrev() {
		const ids = flattenLeaves(root);
		const i = Math.max(0, ids.indexOf(focused));
		focused = ids[(i - 1 + ids.length) % ids.length];
	}

	// Keyboard resize: adjust the immediate parent split's ratio
	/** @param {'width'|'height'} dimension Dimension to resize */
	/** @param {number} step Ratio delta, e.g., 0.05 */
	function resizeFocused(dimension, step) {
		const ctx = findContext(root, focused, null, null);
		if (!ctx || !ctx.parent) return;

		// For now, just resize the immediate parent split
		// TODO: In the future, we could walk up to find the right direction
		const targetSplit = ctx.parent;

		// Focus is in 'a' if it resides under targetSplit.a (even nested)
		const focusInA = containsLeaf(targetSplit.a, focused);
		const delta = focusInA ? step : -step;
		const newRatio = clamp(targetSplit.ratio + delta, 0.1, 0.9);

		// Use the same callback system as drag resizing
		handleRatioUpdate(targetSplit, newRatio);
	}

	/**
	 * @param {LayoutNode} node
	 * @param {string} leafId
	 */
	function containsLeaf(node, leafId) {
		if (isLeaf(node)) return node.id === leafId;
		return containsLeaf(node.a, leafId) || containsLeaf(node.b, leafId);
	}

	/** @param {number} v @param {number} a @param {number} b */
	function clamp(v, a, b) {
		return Math.min(b, Math.max(a, v));
	}

	// ---- keyboard handler -----------------------------------------------------

	/** @param {KeyboardEvent} e */
	function onKey(e) {
		// Normalize key to lowercase for consistent matching
		const normalizedKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;

		const combo = [
			e.ctrlKey ? 'Control' : null,
			e.shiftKey ? 'Shift' : null,
			e.altKey ? 'Alt' : null,
			normalizedKey
		]
			.filter(Boolean)
			.join('+');

		switch (combo) {
			case KM.addRight:
				e.preventDefault();
				splitBesideCurrent('row');
				break;
			case KM.addDown:
				e.preventDefault();
				splitBesideCurrent('column');
				break;
			case KM.close:
				e.preventDefault();
				closeFocused();
				break;
			case KM.focusNext:
				e.preventDefault();
				focusNext();
				break;
			case KM.focusPrev:
				e.preventDefault();
				focusPrev();
				break;
			case KM.growHeight:
				e.preventDefault();
				resizeFocused('height', +0.05);
				break;
			case KM.shrinkHeight:
				e.preventDefault();
				resizeFocused('height', -0.05);
				break;
		}
	}

	// Handle focus events from child components
	function handleFocus(id) {
		focused = id;
		onfocuschange?.({ detail: { id } });
	}

	// Handle ratio updates from Split components (for drag resizing)
	function handleRatioUpdate(node, newRatio) {
		node.ratio = newRatio;
		onlayoutchange?.({ detail: { layout: root } });
	}

	// Seed a simple split if no initial layout
	let initialized = $state(false);
	onMount(() => {
		if (!initialized && initial == null) {
			root = makeSplit(
				/** @type {'row'|'column'} */ (direction),
				makeLeaf('root'),
				makeLeaf(rid()),
				0.5
			);
			initialized = true;
			// Fire layout change event to notify listeners of initial layout
			onlayoutchange?.({ detail: { layout: root } });
		}
	});

	// Expose core layout helpers to parent components
	export { splitBesideCurrent, closeFocused };

	// Edit mode toggle
	function toggleEditMode() {
		editMode = !editMode;
		oneditmodetoggle?.({ detail: { editMode } });
	}

	// Tile action handlers for UI buttons
	function handleSplitRight(tileId) {
		const prevFocused = focused;
		focused = tileId;
		splitBesideCurrent('row');
		focused = prevFocused;
	}

	function handleSplitDown(tileId) {
		const prevFocused = focused;
		focused = tileId;
		splitBesideCurrent('column');
		focused = prevFocused;
	}

	function handleCloseTile(tileId) {
		const prevFocused = focused;
		focused = tileId;
		closeFocused();
		focused = prevFocused;
	}

	// Sync edit mode with prop
	$effect(() => {
		editMode = showEditMode;
	});
</script>

<!--
  Structural classes only; no visual styles.
  Provide layout sizing via your global CSS (e.g., make .wm-root fill its parent).
-->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={containerEl}
	class="wm-root"
	role="region"
	data-gap={gap}
	data-minsize={minSize}
	data-edit-mode={String(editMode)}
	onkeydown={onKey}
>
	<!-- Edit mode toggle button -->
	{#if editMode || showEditMode !== undefined}
		<div class="wm-edit-controls">
			<button class="wm-edit-toggle" onclick={toggleEditMode} type="button">
				{editMode ? '✓ Edit Mode' : '✏️ Edit Mode'}
			</button>
		</div>
	{/if}

	{#if root.type === 'leaf'}
		<Tile id={/** @type {Leaf} */ (root).id} {focused} onfocus={handleFocus}>
			{#snippet children()}
				{@render tile({
					focused,
					tileId: /** @type {Leaf} */ (root).id,
					editMode,
					onSplitRight: () => handleSplitRight(/** @type {Leaf} */ (root).id),
					onSplitDown: () => handleSplitDown(/** @type {Leaf} */ (root).id),
					onClose: () => handleCloseTile(/** @type {Leaf} */ (root).id)
				})}
			{/snippet}
		</Tile>
	{:else}
		<Split
			node={root}
			{gap}
			{minSize}
			{focused}
			{tile}
			{editMode}
			onSplitRight={handleSplitRight}
			onSplitDown={handleSplitDown}
			onClose={handleCloseTile}
			onfocus={handleFocus}
			onratioupdate={handleRatioUpdate}
		/>
	{/if}
</div>

<style>
	.wm-edit-controls {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 20;
		padding: var(--space-2, 0.5rem);
	}

	.wm-edit-toggle {
		background: var(--surface-raised, #333);
		border: 1px solid var(--surface-border, #555);
		color: var(--text-primary, #fff);
		padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
		border-radius: var(--radius, 0.25rem);
		font-size: var(--text-sm, 0.875rem);
		cursor: pointer;
		transition: all 0.2s ease;
		backdrop-filter: blur(4px);
	}

	.wm-edit-toggle:hover {
		background: var(--surface-active, #555);
		border-color: var(--primary, #0066cc);
	}

	.wm-root {
		position: relative;
	}
</style>
