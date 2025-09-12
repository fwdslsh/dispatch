import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ClaudeCommands from '../../src/lib/components/ClaudeCommands.svelte';

// Mock localStorage
const mockLocalStorage = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn()
};

// Mock fetch
global.fetch = vi.fn();

describe('ClaudeCommands', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.localStorage = mockLocalStorage;
		mockLocalStorage.getItem.mockReturnValue(null);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders command menu button', () => {
		const { container } = render(ClaudeCommands, {
			props: {
				socket: null,
				workspacePath: '/test/workspace',
				sessionId: 'test-session',
				onCommandInsert: vi.fn()
			}
		});

		const button = container.querySelector('button[aria-label="Open command menu"]');
		expect(button).toBeTruthy();
		expect(button.textContent.includes('/')).toBe(true);
	});

	it('has proper structure and classes', () => {
		const { container } = render(ClaudeCommands, {
			props: {
				socket: null,
				workspacePath: '/test/workspace',
				sessionId: 'test-session',
				onCommandInsert: vi.fn()
			}
		});

		expect(container.querySelector('.claude-commands')).toBeTruthy();
		expect(container.querySelector('.command-menu-button')).toBeTruthy();
	});

	it('is disabled when disabled prop is true', () => {
		const { container } = render(ClaudeCommands, {
			props: {
				socket: null,
				workspacePath: '/test/workspace',
				sessionId: 'test-session',
				onCommandInsert: vi.fn(),
				disabled: true
			}
		});

		const button = container.querySelector('.command-menu-button');
		expect(button.disabled).toBe(true);
		expect(button.getAttribute('title')).toBe('Commands unavailable');
	});
});