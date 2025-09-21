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

// Provide minimal Svelte 5 rune shims for client-side tests
// Implement $state box, $derived with dep-tracking and .by proxy, and $effect that re-runs
if (typeof window.$state === 'undefined') {
	// Keep $state compatible with existing tests/components that expect a plain value
	window.$state = function (initial) {
		return initial;
	};
}
if (typeof window.$derived === 'undefined') {
	const __evalStack = [];

	function $derived(fnOrVal) {
		if (typeof fnOrVal !== 'function') return fnOrVal;
		let deps = new Set();
		const compute = () => {
			const ctx = { deps: new Set() };
			__evalStack.push(ctx);
			try {
				const v = fnOrVal();
				return v;
			} finally {
				__evalStack.pop();
				deps = ctx.deps;
			}
		};
		const getter = () => compute();
		getter.get = () => getter();
		getter.by = () =>
			new Proxy(
				{},
				{
					get(_t, prop) {
						const value = getter();
						if (prop === Symbol.iterator) return value[Symbol.iterator]?.bind(value);
						const v = value?.[prop];
						if (typeof v === 'function') return v.bind(value);
						return v;
					},
					has(_t, prop) {
						const value = getter();
						return prop in (value || {});
					},
					ownKeys() {
						const value = getter();
						return Reflect.ownKeys(value || {});
					},
					getOwnPropertyDescriptor(_t, prop) {
						const value = getter();
						const desc = Object.getOwnPropertyDescriptor(value || {}, prop);
						if (desc) return desc;
						return { configurable: true, enumerable: true, writable: true, value: value?.[prop] };
					}
				}
			);
		getter._deps = () => deps;
		getter._subscribeDeps = (cb) => {
			const unsub = [];
			for (const d of deps) {
				const u = d._subscribe(() => cb());
				if (u) unsub.push(u);
			}
			return () => unsub.forEach((u) => u());
		};
		return getter;
	}

	window.$effect = function (fn) {
		let cleanup;
		const run = () => {
			if (cleanup) {
				try {
					cleanup();
				} catch (e) {}
				cleanup = undefined;
			}
			const ctx = { deps: new Set() };
			__evalStack.push(ctx);
			try {
				const maybeCleanup = fn();
				if (typeof maybeCleanup === 'function') cleanup = maybeCleanup;
			} finally {
				__evalStack.pop();
			}
			const unsub = [];
			for (const d of ctx.deps) {
				const u = d._subscribe(() => run());
				if (u) unsub.push(u);
			}
			return () => unsub.forEach((u) => u());
		};
		const stop = run();
		return stop || (() => {});
	};
	window.$derived = $derived;
}
if (typeof window.$props === 'undefined') {
	window.$props = () => ({});
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
