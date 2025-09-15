import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import WindowManager from '../../../src/lib/client/shared/components/window-manager/WindowManager.svelte';

describe('WindowManager Integration Tests', () => {
	let props;

	beforeEach(() => {
		// Mock crypto.randomUUID for consistent testing
		if (!globalThis.crypto) {
			globalThis.crypto = {};
		}
		globalThis.crypto.randomUUID = vi.fn()
			.mockReturnValueOnce('tile-1')
			.mockReturnValueOnce('tile-2')
			.mockReturnValueOnce('tile-3')
			.mockReturnValueOnce('tile-4');

		props = {
			initial: null,
			direction: 'row',
			gap: 6,
			minSize: 48,
			keymap: {},
			tile: (params) => `Content for ${params.tileId} (focused: ${params.focused})`
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('creates and manages a complete tiling layout', async () => {
		const { container } = render(WindowManager, { props });

		// Should start with a single tile
		let tiles = container.querySelectorAll('.wm-tile');
		expect(tiles.length).toBe(1);

		const root = container.querySelector('.wm-root');

		// Add a horizontal split (Ctrl+Enter)
		await fireEvent.keyDown(root, {
			key: 'Enter',
			ctrlKey: true,
			preventDefault: vi.fn()
		});

		// Should now have 2 tiles in a horizontal split
		tiles = container.querySelectorAll('.wm-tile');
		expect(tiles.length).toBe(2);

		const split = container.querySelector('.wm-split');
		expect(split).toBeTruthy();
		expect(split.getAttribute('data-dir')).toBe('row');

		// Add a vertical split (Ctrl+Shift+Enter)
		await fireEvent.keyDown(root, {
			key: 'Enter',
			ctrlKey: true,
			shiftKey: true,
			preventDefault: vi.fn()
		});

		// Should now have 3 tiles
		tiles = container.querySelectorAll('.wm-tile');
		expect(tiles.length).toBe(3);

		// Should have both horizontal and vertical splits
		const splits = container.querySelectorAll('.wm-split');
		expect(splits.length).toBeGreaterThanOrEqual(2);
	});

	it('handles focus navigation between tiles', async () => {
		// Start with a split layout
		const initialLayout = {
			type: 'split',
			dir: 'row',
			a: { type: 'leaf', id: 'left' },
			b: {
				type: 'split',
				dir: 'column',
				a: { type: 'leaf', id: 'top-right' },
				b: { type: 'leaf', id: 'bottom-right' },
				ratio: 0.5
			},
			ratio: 0.5
		};

		props.initial = initialLayout;
		const { container } = render(WindowManager, { props });

		const root = container.querySelector('.wm-root');

		// Should have 3 tiles
		let tiles = container.querySelectorAll('.wm-tile');
		expect(tiles.length).toBe(3);

		// Navigate with Alt+ArrowRight
		await fireEvent.keyDown(root, {
			key: 'ArrowRight',
			altKey: true,
			preventDefault: vi.fn()
		});

		// Focus should change (tiles still present)
		tiles = container.querySelectorAll('.wm-tile');
		expect(tiles.length).toBe(3);
	});

	it('resizes splits by dragging dividers', async () => {
		const initialLayout = {
			type: 'split',
			dir: 'row',
			a: { type: 'leaf', id: 'left' },
			b: { type: 'leaf', id: 'right' },
			ratio: 0.5
		};

		props.initial = initialLayout;
		const { container } = render(WindowManager, { props });

		const divider = container.querySelector('.wm-divider');
		const split = container.querySelector('.wm-split');

		// Mock getBoundingClientRect for resize calculation
		divider.getBoundingClientRect = vi.fn().mockReturnValue({
			width: 600,
			height: 400,
			left: 100,
			top: 50
		});

		// Get initial pane sizes
		const paneA = container.querySelector('.wm-pane-a');
		const paneB = container.querySelector('.wm-pane-b');
		const initialFlexA = paneA.style.flex;
		const initialFlexB = paneB.style.flex;

		// Start drag at center
		await fireEvent.mouseDown(divider, { clientX: 400, clientY: 250 });

		// Drag to the right
		await fireEvent(window, new MouseEvent('mousemove', { clientX: 500, clientY: 250 }));

		// End drag
		await fireEvent(window, new MouseEvent('mouseup'));

		// Flex values should have changed
		const newFlexA = paneA.style.flex;
		const newFlexB = paneB.style.flex;

		expect(newFlexA).not.toBe(initialFlexA);
		expect(newFlexB).not.toBe(initialFlexB);
	});

	it('closes tiles and collapses splits appropriately', async () => {
		const { container } = render(WindowManager, { props });

		const root = container.querySelector('.wm-root');

		// Create a split first
		await fireEvent.keyDown(root, {
			key: 'Enter',
			ctrlKey: true,
			preventDefault: vi.fn()
		});

		// Should have 2 tiles and 1 split
		let tiles = container.querySelectorAll('.wm-tile');
		let splits = container.querySelectorAll('.wm-split');
		expect(tiles.length).toBe(2);
		expect(splits.length).toBe(1);

		// Close current tile with Ctrl+W
		await fireEvent.keyDown(root, {
			key: 'w',
			ctrlKey: true,
			preventDefault: vi.fn()
		});

		// Should collapse back to single tile
		tiles = container.querySelectorAll('.wm-tile');
		expect(tiles.length).toBe(1);

		// Split should be gone
		splits = container.querySelectorAll('.wm-split');
		expect(splits.length).toBe(0);
	});

	it('handles keyboard resizing of focused tile', async () => {
		const initialLayout = {
			type: 'split',
			dir: 'row',
			a: { type: 'leaf', id: 'left' },
			b: { type: 'leaf', id: 'right' },
			ratio: 0.5
		};

		props.initial = initialLayout;
		const { container } = render(WindowManager, { props });

		const root = container.querySelector('.wm-root');
		const paneA = container.querySelector('.wm-pane-a');
		const paneB = container.querySelector('.wm-pane-b');

		const initialFlexA = paneA.style.flex;

		// Grow focused tile with Ctrl+ArrowUp
		await fireEvent.keyDown(root, {
			key: 'ArrowUp',
			ctrlKey: true,
			preventDefault: vi.fn()
		});

		// Flex should have changed
		const newFlexA = paneA.style.flex;
		expect(newFlexA).not.toMatch(/0\.5 1 0(px)?/);
	});

	it('maintains tile content through layout changes', async () => {
		const { container } = render(WindowManager, { props });

		// Initial tile should have content
		expect(container.textContent).toContain('Content for root');

		const root = container.querySelector('.wm-root');

		// Add split
		await fireEvent.keyDown(root, {
			key: 'Enter',
			ctrlKey: true,
			preventDefault: vi.fn()
		});

		// Should still have content for all tiles
		expect(container.textContent).toContain('Content for root');
		expect(container.textContent).toContain('Content for tile-1');
	});

	it('handles complex nested layouts correctly', async () => {
		const complexLayout = {
			type: 'split',
			dir: 'row',
			a: {
				type: 'split',
				dir: 'column',
				a: { type: 'leaf', id: 'top-left' },
				b: { type: 'leaf', id: 'bottom-left' },
				ratio: 0.4
			},
			b: {
				type: 'split',
				dir: 'column',
				a: { type: 'leaf', id: 'top-right' },
				b: {
					type: 'split',
					dir: 'row',
					a: { type: 'leaf', id: 'bottom-right-left' },
					b: { type: 'leaf', id: 'bottom-right-right' },
					ratio: 0.6
				},
				ratio: 0.3
			},
			ratio: 0.5
		};

		props.initial = complexLayout;
		const { container } = render(WindowManager, { props });

		// Should render all 5 tiles
		const tiles = container.querySelectorAll('.wm-tile');
		expect(tiles.length).toBe(5);

		// Should have multiple splits
		const splits = container.querySelectorAll('.wm-split');
		expect(splits.length).toBe(4);

		// Should have multiple dividers
		const dividers = container.querySelectorAll('.wm-divider');
		expect(dividers.length).toBe(4);

		// Check that all expected tile IDs are present
		const tileIds = Array.from(tiles).map(tile => tile.getAttribute('data-tile-id'));
		expect(tileIds).toContain('top-left');
		expect(tileIds).toContain('bottom-left');
		expect(tileIds).toContain('top-right');
		expect(tileIds).toContain('bottom-right-left');
		expect(tileIds).toContain('bottom-right-right');
	});

	it('handles focus changes via tile clicks', async () => {
		const initialLayout = {
			type: 'split',
			dir: 'row',
			a: { type: 'leaf', id: 'left' },
			b: { type: 'leaf', id: 'right' },
			ratio: 0.5
		};

		props.initial = initialLayout;
		const { container } = render(WindowManager, { props });

		// Find tiles
		const leftTile = container.querySelector('[data-tile-id="left"]');
		const rightTile = container.querySelector('[data-tile-id="right"]');

		// Initially, left should be focused (first in DFS order)
		expect(leftTile.getAttribute('data-focused')).toBe('true');
		expect(rightTile.getAttribute('data-focused')).toBe('false');

		// Click right tile
		await fireEvent.click(rightTile);

		// Focus should change
		expect(leftTile.getAttribute('data-focused')).toBe('false');
		expect(rightTile.getAttribute('data-focused')).toBe('true');
	});
});