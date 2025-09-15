/// <reference types="@vitest/browser/matchers" />
/// <reference types="@vitest/browser/providers/playwright" />

/**
 * Vitest client-side test setup
 * Configures browser environment for client tests
 */
import { vi } from 'vitest';

// Mock document for components that access DOM
if (typeof document === 'undefined') {
	global.document = {
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		createElement: vi.fn(() => ({
			style: {},
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		})),
		body: {
			appendChild: vi.fn(),
			removeChild: vi.fn()
		}
	};
}

// Mock window object for browser APIs
if (typeof window === 'undefined') {
	global.window = {
		matchMedia: vi.fn(() => ({
			matches: false,
			media: '',
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn()
		})),
		localStorage: {
			getItem: vi.fn(),
			setItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn()
		},
		sessionStorage: {
			getItem: vi.fn(),
			setItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn()
		}
	};
}

// Suppress console errors for cleaner test output
const originalConsoleError = console.error;
console.error = (...args) => {
	const message = args[0]?.toString() || '';
	// Suppress known client-side test errors
	if (
		message.includes('document is not defined') ||
		message.includes('window is not defined') ||
		message.includes('matchMedia')
	) {
		return;
	}
	originalConsoleError.apply(console, args);
};
