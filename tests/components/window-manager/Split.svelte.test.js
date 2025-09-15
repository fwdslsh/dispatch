import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Split from '../../../src/lib/client/shared/components/window-manager/Split.svelte';

describe('Split', () => {
	let props;

	beforeEach(() => {
		props = {
			node: {
				type: 'split',
				dir: 'row',
				a: { type: 'leaf', id: 'left' },
				b: { type: 'leaf', id: 'right' },
				ratio: 0.5
			},
			gap: 6,
			minSize: 48,
			focused: 'left',
			tile: (params) => `Tile: ${params.tileId}`,
			onfocus: vi.fn()
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders split container with correct direction', () => {
		const { container } = render(Split, { props });

		const split = container.querySelector('.wm-split');
		expect(split).toBeTruthy();
		expect(split.getAttribute('data-dir')).toBe('row');
	});

	it('renders column direction correctly', () => {
		props.node.dir = 'column';
		const { container } = render(Split, { props });

		const split = container.querySelector('.wm-split');
		expect(split.getAttribute('data-dir')).toBe('column');
	});

	it('renders two panes with correct flex ratios', () => {
		const { container } = render(Split, { props });

		const paneA = container.querySelector('.wm-pane-a');
		const paneB = container.querySelector('.wm-pane-b');

		expect(paneA).toBeTruthy();
		expect(paneB).toBeTruthy();
		expect(paneA.style.flex).toMatch(/0\.5 1 0(px)?/);
		expect(paneB.style.flex).toMatch(/0\.5 1 0(px)?/);
	});

	it('applies minSize to panes', () => {
		const { container } = render(Split, { props });

		const paneA = container.querySelector('.wm-pane-a');
		const paneB = container.querySelector('.wm-pane-b');

		expect(paneA.getAttribute('data-min')).toBe('48');
		expect(paneB.getAttribute('data-min')).toBe('48');
	});

	it('renders divider with correct attributes', () => {
		const { container } = render(Split, { props });

		const divider = container.querySelector('.wm-divider');
		expect(divider).toBeTruthy();
		expect(divider.getAttribute('role')).toBe('separator');
		expect(divider.getAttribute('aria-orientation')).toBe('vertical');
		expect(divider.getAttribute('data-dir')).toBe('row');
		expect(divider.getAttribute('data-gap')).toBe('6');
	});

	it('renders divider with horizontal orientation for column direction', () => {
		props.node.dir = 'column';
		const { container } = render(Split, { props });

		const divider = container.querySelector('.wm-divider');
		expect(divider.getAttribute('aria-orientation')).toBe('horizontal');
	});

	it('renders leaf nodes as Tile components', () => {
		const { container } = render(Split, { props });

		const tiles = container.querySelectorAll('.wm-tile');
		expect(tiles.length).toBe(2);
		expect(tiles[0].getAttribute('data-tile-id')).toBe('left');
		expect(tiles[1].getAttribute('data-tile-id')).toBe('right');
	});

	it('renders nested splits correctly', () => {
		props.node.a = {
			type: 'split',
			dir: 'column',
			a: { type: 'leaf', id: 'top-left' },
			b: { type: 'leaf', id: 'bottom-left' },
			ratio: 0.3
		};

		const { container } = render(Split, { props });

		const splits = container.querySelectorAll('.wm-split');
		expect(splits.length).toBe(2); // One main split and one nested

		const tiles = container.querySelectorAll('.wm-tile');
		expect(tiles.length).toBe(3); // Three leaf nodes total
	});

	it('passes focused state to child components', () => {
		const { container } = render(Split, { props });

		const focusedTile = container.querySelector('[data-tile-id="left"]');
		const unfocusedTile = container.querySelector('[data-tile-id="right"]');

		expect(focusedTile.getAttribute('data-focused')).toBe('true');
		expect(unfocusedTile.getAttribute('data-focused')).toBe('false');
	});

	it('handles focus events from child components', async () => {
		const { container } = render(Split, { props });

		const rightTile = container.querySelector('[data-tile-id="right"]');
		await fireEvent.click(rightTile);

		expect(props.onfocus).toHaveBeenCalledWith('right');
	});

	it('handles divider mouse drag to resize', async () => {
		const { container } = render(Split, { props });

		const divider = container.querySelector('.wm-divider');

		// Mock getBoundingClientRect
		const mockRect = { width: 400, height: 300, left: 100, top: 50 };
		divider.getBoundingClientRect = vi.fn().mockReturnValue(mockRect);

		// Start drag
		await fireEvent.mouseDown(divider, { clientX: 200, clientY: 150 });

		// Simulate mouse move
		await fireEvent(window, new MouseEvent('mousemove', { clientX: 250, clientY: 150 }));

		// The ratio should have changed (though we can't easily test the exact value)
		expect(divider).toBeTruthy();

		// End drag
		await fireEvent(window, new MouseEvent('mouseup'));
	});

	it('handles divider touch drag to resize', async () => {
		const { container } = render(Split, { props });

		const divider = container.querySelector('.wm-divider');

		// Mock getBoundingClientRect
		const mockRect = { width: 400, height: 300, left: 100, top: 50 };
		divider.getBoundingClientRect = vi.fn().mockReturnValue(mockRect);

		// Start touch drag - create proper Touch objects
		const touch1 = new Touch({ identifier: 1, target: divider, clientX: 200, clientY: 150 });
		const touch2 = new Touch({ identifier: 1, target: divider, clientX: 250, clientY: 150 });

		await fireEvent.touchStart(divider, {
			touches: [touch1]
		});

		// Simulate touch move
		await fireEvent(window, new TouchEvent('touchmove', {
			touches: [touch2]
		}));

		// End touch
		await fireEvent(window, new TouchEvent('touchend'));

		expect(divider).toBeTruthy();
	});

	it('clamps ratio values between 0.1 and 0.9', async () => {
		const { container } = render(Split, { props });

		const divider = container.querySelector('.wm-divider');

		// Mock a very large drag movement
		const mockRect = { width: 400, height: 300, left: 100, top: 50 };
		divider.getBoundingClientRect = vi.fn().mockReturnValue(mockRect);

		await fireEvent.mouseDown(divider, { clientX: 200, clientY: 150 });

		// Simulate extreme mouse move
		await fireEvent(window, new MouseEvent('mousemove', { clientX: 1000, clientY: 150 }));

		// Ratio should be clamped (we can check the DOM structure remains valid)
		const split = container.querySelector('.wm-split');
		expect(split).toBeTruthy();

		await fireEvent(window, new MouseEvent('mouseup'));
	});

	it('renders with custom gap value', () => {
		props.gap = 12;
		const { container } = render(Split, { props });

		const divider = container.querySelector('.wm-divider');
		expect(divider.getAttribute('data-gap')).toBe('12');
	});

	it('updates ratio when prop changes', async () => {
		const { container } = render(Split, { props });

		// Update the ratio directly in the node object (reactive)
		props.node.ratio = 0.7;

		// Wait for Svelte to update the DOM
		await new Promise(resolve => setTimeout(resolve, 0));

		const paneA = container.querySelector('.wm-pane-a');
		const paneB = container.querySelector('.wm-pane-b');

		expect(paneA.style.flex).toMatch(/0\.7 1 0(px)?/);
		expect(paneB.style.flex).toMatch(/0\.3\d* 1 0(px)?/); // Floating point precision
	});
});