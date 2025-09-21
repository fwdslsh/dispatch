/**
 * Vitest server-side test setup
 * Configures Node.js environment for server tests
 */
import { vi } from 'vitest';

// Mock global environment variables
if (!process.env.NODE_ENV) {
	process.env.NODE_ENV = 'test';
}

// Improved Svelte 5 rune shims used in compiled components during tests
// Provide $state (mutable reactive box), $derived (computed with simple dep tracking),
// and $effect (side-effect runner that re-runs when dependencies change).
if (typeof global.$state === 'undefined') {
	// Keep $state compatible with existing tests/components that expect a plain value
	global.$state = function (initial) {
		return initial;
	};
}

if (typeof global.$derived === 'undefined') {
	// Simple dependency tracker: during evaluation we record accessed state boxes
	const __evalStack = [];

	function readBox(box) {
		const ctx = __evalStack[__evalStack.length - 1];
		if (ctx && box && typeof box._subscribe === 'function') {
			ctx.deps.add(box);
		}
		return typeof box === 'function' ? box() : box;
	}

	function $derived(fnOrVal) {
		if (typeof fnOrVal !== 'function') return fnOrVal;

		let last = undefined;
		let deps = new Set();
		const subs = new Set();

		const compute = () => {
			const ctx = { deps: new Set() };
			__evalStack.push(ctx);
			try {
				// allow fnOrVal to call state boxes directly
				const v = fnOrVal();
				last = v;
				return v;
			} finally {
				__evalStack.pop();
				// swap deps
				deps = ctx.deps;
			}
		};

		const getter = () => {
			// lazy compute
			return compute();
		};

		getter.get = () => getter();

		getter.by = () => {
			// Return the concrete computed value (not a Proxy) to avoid compatibility issues
			return getter();
		};

		// allow effects to subscribe to this derived's deps
		getter._deps = () => deps;

		// subscribe helper for internal use
		getter._subscribeDeps = (cb) => {
			const unsubscribers = [];
			for (const d of deps) {
				const unsub = d._subscribe(() => cb());
				if (unsub) unsubscribers.push(unsub);
			}
			return () => {
				for (const u of unsubscribers) u();
			};
		};

		return getter;
	}

	// Effects: run immediately and re-run when dependencies (state boxes) change
	global.$effect = function (fn) {
		let cleanup;
		const run = () => {
			if (cleanup) {
				try {
					cleanup();
				} catch (e) {
					/* ignore cleanup errors in tests */
				}
				cleanup = undefined;
			}
			// dependency collection
			const ctx = { deps: new Set() };
			__evalStack.push(ctx);
			try {
				const maybeCleanup = fn();
				if (typeof maybeCleanup === 'function') cleanup = maybeCleanup;
			} finally {
				__evalStack.pop();
			}
			// subscribe to deps
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

	// expose
	global.$derived = $derived;

	// convenience helpers so compiled code can call $derived.by(fn) or $derived.get(fn)
	global.$derived.by = (fn) => $derived(fn).by();
	global.$derived.get = (fn) => $derived(fn).get();
}
if (typeof global.$props === 'undefined') {
	// Simple placeholder for $props() calls in compiled Svelte modules
	global.$props = () => ({});
}

// Mock database manager for tests
vi.mock('./src/lib/server/db/DatabaseManager.js', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		getDatabaseManager: vi.fn(() => ({
			init: vi.fn(),
			createWorkspace: vi.fn(),
			updateWorkspaceActivity: vi.fn(),
			addWorkspaceSession: vi.fn(),
			getWorkspaceSessions: vi.fn(() => []),
			setPinned: vi.fn(),
			close: vi.fn()
		}))
	};
});

// Mock Socket.IO for server tests
vi.mock('socket.io', () => ({
	Server: vi.fn(() => ({
		on: vi.fn(),
		emit: vi.fn(),
		to: vi.fn(() => ({
			emit: vi.fn()
		}))
	}))
}));

// Set up global mocks
global.__API_SERVICES = {
	databaseManager: {
		init: vi.fn(),
		createWorkspace: vi.fn(),
		updateWorkspaceActivity: vi.fn(),
		addWorkspaceSession: vi.fn(),
		getWorkspaceSessions: vi.fn(() => []),
		setPinned: vi.fn()
	}
};

// NOTE: legacy aliasing removed — tests should reference `runSessionManager` now

// Minimal fetch mock for server-side tests (some client services call fetch)
if (typeof global.fetch === 'undefined') {
	global.fetch = async (url, opts) => {
		// simple handling for sessions endpoint
		try {
			const u = String(url || '');
			if (u.endsWith('/api/sessions') || u.endsWith('/api/sessions/')) {
				return {
					ok: true,
					status: 200,
					json: async () => []
				};
			}
		} catch (e) {}
		return { ok: false, status: 404, json: async () => ({}) };
	};
}

// Console suppression for cleaner test output
const originalConsoleError = console.error;
console.error = (...args) => {
	// Suppress known test-related console errors
	const message = args[0]?.toString() || '';
	if (
		message.includes('DATABASE') ||
		message.includes('ViewModel') ||
		message.includes('Load error:')
	) {
		return; // Suppress these during tests
	}
	originalConsoleError.apply(console, args);
};
