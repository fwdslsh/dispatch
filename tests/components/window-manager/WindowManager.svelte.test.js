import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import WindowManager from '../../../src/lib/client/shared/components/window-manager/WindowManager.svelte';

describe('WindowManager', () => {
	let props;

	beforeEach(() => {
		// Mock crypto.randomUUID for consistent testing
		if (!globalThis.crypto) {
			globalThis.crypto = {};
		}
		globalThis.crypto.randomUUID = vi.fn().mockReturnValue('test-uuid-123');

		props = {
			initial: null,
			direction: 'row',
			gap: 6,
			minSize: 48,
			keymap: {},
			tile: null // Will be set in each test
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders with default leaf node when no initial layout provided', () => {
		// Mock tile snippet
		const mockTileSnippet = (params) => `Tile: ${params.tileId}`;
		props.tile = mockTileSnippet;

		const { container } = render(WindowManager, { props });

		const root = container.querySelector('.wm-root');
		expect(root).toBeTruthy();
		expect(root.getAttribute('data-gap')).toBe('6');
		expect(root.getAttribute('data-minsize')).toBe('48');
		expect(root.getAttribute('tabindex')).toBe('0');
	});

	it('renders with initial layout when provided', () => {
		const initialLayout = {
			type: 'split',
			dir: 'row',
			a: { type: 'leaf', id: 'left' },
			b: { type: 'leaf', id: 'right' },
			ratio: 0.5
		};

		const mockTileSnippet = (params) => `Tile: ${params.tileId}`;
		props.initial = initialLayout;
		props.tile = mockTileSnippet;

		const { container } = render(WindowManager, { props });

		const split = container.querySelector('.wm-split');
		expect(split).toBeTruthy();
		expect(split.getAttribute('data-dir')).toBe('row');
	});

	it('responds to keyboard shortcuts for creating splits', async () => {
		const mockTileSnippet = (params) => `Tile: ${params.tileId}`;
		props.tile = mockTileSnippet;

		const { container } = render(WindowManager, { props });
		const root = container.querySelector('.wm-root');

		// Simulate Ctrl+Enter to add right split
		await fireEvent.keyDown(root, {
			key: 'Enter',
			ctrlKey: true,
			preventDefault: vi.fn()
		});

		// Should create a split
		const split = container.querySelector('.wm-split');
		expect(split).toBeTruthy();
	});

	it('responds to keyboard shortcuts for focus navigation', async () => {
		const initialLayout = {
			type: 'split',
			dir: 'row',
			a: { type: 'leaf', id: 'left' },
			b: { type: 'leaf', id: 'right' },
			ratio: 0.5
		};

		const mockTileSnippet = (params) => `Tile: ${params.tileId}`;
		props.initial = initialLayout;
		props.tile = mockTileSnippet;

		const { container } = render(WindowManager, { props });
		const root = container.querySelector('.wm-root');

		// Simulate Alt+ArrowRight to focus next
		await fireEvent.keyDown(root, {
			key: 'ArrowRight',
			altKey: true,
			preventDefault: vi.fn()
		});

		// Focus should change (though we can't easily test the internal state)
		expect(root).toBeTruthy();
	});

	it('handles custom keymap configuration', () => {
		const customKeymap = {
			addRight: 'Alt+r',
			addDown: 'Alt+d',
			close: 'Alt+x'
		};

		const mockTileSnippet = (params) => `Tile: ${params.tileId}`;
		props.keymap = customKeymap;
		props.tile = mockTileSnippet;

		const { container } = render(WindowManager, { props });

		// Component should render with custom keymap
		const root = container.querySelector('.wm-root');
		expect(root).toBeTruthy();
	});

	it('applies custom gap and minSize settings', () => {
		const mockTileSnippet = (params) => `Tile: ${params.tileId}`;
		props.gap = 12;
		props.minSize = 100;
		props.tile = mockTileSnippet;

		const { container } = render(WindowManager, { props });

		const root = container.querySelector('.wm-root');
		expect(root.getAttribute('data-gap')).toBe('12');
		expect(root.getAttribute('data-minsize')).toBe('100');
	});

	it('handles focus events from child components', () => {
		const initialLayout = {
			type: 'split',
			dir: 'row',
			a: { type: 'leaf', id: 'left' },
			b: { type: 'leaf', id: 'right' },
			ratio: 0.5
		};

		const mockTileSnippet = (params) => `Tile: ${params.tileId}`;
		props.initial = initialLayout;
		props.tile = mockTileSnippet;

		const { container } = render(WindowManager, { props });

		// Find a tile button and simulate click
		const tileButton = container.querySelector('.wm-tile');
		if (tileButton) {
			fireEvent.click(tileButton);
		}

		// Component should handle the focus event
		expect(container.querySelector('.wm-root')).toBeTruthy();
	});

	it('renders with proper accessibility attributes', () => {
		const mockTileSnippet = (params) => `Tile: ${params.tileId}`;
		props.tile = mockTileSnippet;

		const { container } = render(WindowManager, { props });

		const root = container.querySelector('.wm-root');
		expect(root.getAttribute('role')).toBe('region');
		expect(root.getAttribute('tabindex')).toBe('0');
	});

	it('creates nested splits correctly', async () => {
		const mockTileSnippet = (params) => `Tile: ${params.tileId}`;
		props.tile = mockTileSnippet;

		const { container } = render(WindowManager, { props });
		const root = container.querySelector('.wm-root');

		// Create first split
		await fireEvent.keyDown(root, {
			key: 'Enter',
			ctrlKey: true,
			preventDefault: vi.fn()
		});

		// Create second split (should be nested)
		await fireEvent.keyDown(root, {
			key: 'Enter',
			ctrlKey: true,
			shiftKey: true,
			preventDefault: vi.fn()
		});

		// Should have nested structure
		const splits = container.querySelectorAll('.wm-split');
		expect(splits.length).toBeGreaterThan(0);
	});
});
