import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Tile from '../../../src/lib/client/shared/components/window-manager/Tile.svelte';

describe('Tile', () => {
	let props;

	beforeEach(() => {
		props = {
			id: 'test-tile',
			focused: '',
			children: () => 'Test Content',
			onfocus: vi.fn()
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders as a button with correct attributes', () => {
		const { container } = render(Tile, { props });

		const button = container.querySelector('button');
		expect(button).toBeTruthy();
		expect(button.classList.contains('wm-tile')).toBe(true);
		expect(button.type).toBe('button');
	});

	it('displays tile ID in data attributes', () => {
		const { container } = render(Tile, { props });

		const button = container.querySelector('button');
		expect(button.getAttribute('data-tile-id')).toBe('test-tile');
		expect(button.getAttribute('aria-label')).toBe('test-tile');
	});

	it('shows focused state correctly when focused', () => {
		props.focused = 'test-tile';
		const { container } = render(Tile, { props });

		const button = container.querySelector('button');
		expect(button.getAttribute('data-focused')).toBe('true');
	});

	it('shows unfocused state correctly when not focused', () => {
		props.focused = 'other-tile';
		const { container } = render(Tile, { props });

		const button = container.querySelector('button');
		expect(button.getAttribute('data-focused')).toBe('false');
	});

	it('renders children content', () => {
		// Need to properly create a snippet function for Svelte 5
		props.children = {
			render: () => 'Custom Tile Content'
		};
		const { container } = render(Tile, { props });

		expect(container.textContent).toContain('Custom Tile Content');
	});

	it('calls onfocus handler when clicked', async () => {
		const { container } = render(Tile, { props });

		const button = container.querySelector('button');
		await fireEvent.click(button);

		expect(props.onfocus).toHaveBeenCalledWith('test-tile');
		expect(props.onfocus).toHaveBeenCalledTimes(1);
	});

	it('calls onfocus handler when focused via keyboard', async () => {
		const { container } = render(Tile, { props });

		const button = container.querySelector('button');
		await fireEvent.focus(button);

		expect(props.onfocus).toHaveBeenCalledWith('test-tile');
		expect(props.onfocus).toHaveBeenCalledTimes(1);
	});

	it('handles multiple focus events correctly', async () => {
		const { container } = render(Tile, { props });

		const button = container.querySelector('button');

		// Click first
		await fireEvent.click(button);
		expect(props.onfocus).toHaveBeenCalledTimes(1);

		// Focus second
		await fireEvent.focus(button);
		expect(props.onfocus).toHaveBeenCalledTimes(2);

		// Both should call with the same ID
		expect(props.onfocus).toHaveBeenNthCalledWith(1, 'test-tile');
		expect(props.onfocus).toHaveBeenNthCalledWith(2, 'test-tile');
	});

	it('works without onfocus handler (default function)', () => {
		delete props.onfocus;

		expect(() => {
			const { container } = render(Tile, { props });
			const button = container.querySelector('button');
			fireEvent.click(button);
		}).not.toThrow();
	});

	it('updates focused state when prop changes', async () => {
		const { container } = render(Tile, { props });

		let button = container.querySelector('button');
		expect(button.getAttribute('data-focused')).toBe('false');

		// Update focused prop by modifying the reactive prop
		props.focused = 'test-tile';

		// Wait for Svelte to update the DOM
		await new Promise((resolve) => setTimeout(resolve, 0));

		button = container.querySelector('button');
		expect(button.getAttribute('data-focused')).toBe('true');
	});

	it('maintains unique tile ID across renders', () => {
		const { container: container1 } = render(Tile, {
			...props,
			id: 'tile-1'
		});

		const { container: container2 } = render(Tile, {
			...props,
			id: 'tile-2'
		});

		const button1 = container1.querySelector('button');
		const button2 = container2.querySelector('button');

		expect(button1.getAttribute('data-tile-id')).toBe('tile-1');
		expect(button2.getAttribute('data-tile-id')).toBe('tile-2');
	});

	it('renders with complex children content', () => {
		props.children = {
			render: () => `
				<div class="tile-content">
					<h3>Tile Title</h3>
					<p>Tile description</p>
				</div>
			`
		};

		const { container } = render(Tile, { props });

		expect(container.textContent).toContain('Tile Title');
		expect(container.textContent).toContain('Tile description');
	});

	it('handles empty children gracefully', () => {
		props.children = () => '';

		expect(() => {
			const { container } = render(Tile, { props });
			expect(container.querySelector('button')).toBeTruthy();
		}).not.toThrow();
	});

	it('provides proper accessibility support', () => {
		const { container } = render(Tile, { props });

		const button = container.querySelector('button');

		// Should be keyboard accessible
		expect(button.type).toBe('button');
		expect(button.getAttribute('aria-label')).toBe('test-tile');

		// Should be focusable
		expect(button.tabIndex).not.toBe(-1);
	});

	it('handles special characters in tile ID', () => {
		props.id = 'tile-with-special-chars_123!@#';
		const { container } = render(Tile, { props });

		const button = container.querySelector('button');
		expect(button.getAttribute('data-tile-id')).toBe('tile-with-special-chars_123!@#');
		expect(button.getAttribute('aria-label')).toBe('tile-with-special-chars_123!@#');
	});
});
