# MVVM Patterns with Svelte 5 Runes

## Overview

Dispatch uses a modern MVVM (Model-View-ViewModel) architecture with Svelte 5 runes for reactive state management. This pattern separates business logic from presentation logic, making components testable, maintainable, and reusable.

**Core Principle**: ViewModels encapsulate business logic using Svelte 5 runes (`$state`, `$derived`, `$effect`) within JavaScript classes, while Views (`.svelte` components) handle only presentation.

## Key Concepts

### The Runes-in-Classes Pattern

Svelte 5 runes can be used inside class instances to create reactive state management objects. This pattern combines the reactivity of runes with the structure and testability of classes.

```javascript
export class ThemeState {
	constructor() {
		// Reactive state using $state rune
		this.themes = $state([]);
		this.activeThemeId = $state(null);
		this.loading = $state(false);

		// Derived state using $derived rune
		this.activeTheme = $derived.by(
			() => this.themes.find((t) => t.id === this.activeThemeId) || null
		);

		// Complex derivation with $derived.by()
		this.customThemes = $derived.by(() => this.themes.filter((t) => t.source === 'custom'));
	}

	// Business logic methods
	async loadThemes() {
		this.loading = true;
		try {
			const response = await fetch('/api/themes');
			this.themes = await response.json();
		} finally {
			this.loading = false;
		}
	}
}
```

**Why Classes?**

- Encapsulation of related state and behavior
- Constructor-based initialization
- Dependency injection support
- Clear interface for testing
- TypeScript-friendly

## Architecture Layers

### 1. Model Layer

Pure data structures and business entities (TypeScript interfaces or classes).

```javascript
/**
 * @typedef {Object} Session
 * @property {string} id - Session ID
 * @property {string} workspacePath - Workspace path
 * @property {string} sessionType - Session type
 * @property {boolean} isActive - Active status
 * @property {string} title - Session title
 */
```

### 2. ViewModel Layer

Business logic with reactive state management using Svelte 5 runes.

**State Management Classes** (`src/lib/client/shared/state/`):

- `SessionViewModel.svelte.js` - Session lifecycle management
- `WorkspaceState.svelte.js` - Workspace data and selection
- `ThemeState.svelte.js` - Theme management
- `AuthViewModel.svelte.js` - Authentication logic

**Service Classes** (`src/lib/client/shared/services/`):

- `SessionApiClient.js` - HTTP API client for sessions
- `RunSessionClient.js` - WebSocket client for real-time events
- `SocketService.svelte.js` - Socket.IO connection management

### 3. View Layer

Svelte components that bind to ViewModels (`.svelte` files).

```svelte
<script>
	import { SessionViewModel } from './state/SessionViewModel.svelte.js';
	import { useServiceContainer } from './services/ServiceContainer.svelte.js';

	// Get dependencies from container
	const container = useServiceContainer();
	const appState = await container.get('appStateManager');
	const sessionApi = await container.get('sessionApi');

	// Create ViewModel with dependencies
	const viewModel = new SessionViewModel(appState, sessionApi);

	// Reactive bindings - automatically update when ViewModel state changes
	const { sessions, loading, error } = $derived({
		sessions: viewModel.sessions,
		loading: viewModel.operationState.loading,
		error: viewModel.operationState.error
	});
</script>

{#if loading}
	<p>Loading sessions...</p>
{:else if error}
	<p>Error: {error}</p>
{:else}
	{#each sessions as session}
		<div>{session.title}</div>
	{/each}
{/if}
```

## When to Use Classes vs Modules

### Use Classes When:

✅ **State is scoped to component lifecycle**

```javascript
// WorkspaceState.svelte.js - Component-scoped state
export class WorkspaceState {
	constructor() {
		this.workspaces = $state([]);
		this.selectedWorkspace = $state(null);
	}
}
```

✅ **Multiple instances needed**

```javascript
// Multiple session ViewModels for different components
const terminalVM = new SessionViewModel(appState, sessionApi);
const claudeVM = new SessionViewModel(appState, sessionApi);
```

✅ **Dependency injection required**

```javascript
export class SessionViewModel {
	constructor(appStateManager, sessionApi) {
		this.appStateManager = appStateManager;
		this.sessionApi = sessionApi;
	}
}
```

### Use Modules When:

✅ **Global singleton state**

```javascript
// AppState.svelte.js - Application-wide state
export class AppState {
	// Single instance shared across app
}
```

✅ **Pure utility functions**

```javascript
// utils/logger.js - Stateless utilities
export function createLogger(namespace) {
	return { info: (...args) => console.log(...args) };
}
```

✅ **Service clients (often singletons)**

```javascript
// SessionApiClient.js - Shared HTTP client
export class SessionApiClient {
	constructor(config) {
		/* ... */
	}
}
```

## Svelte 5 Runes Usage Patterns

### $state - Reactive State

Use for mutable reactive values:

```javascript
export class SessionViewModel {
	constructor() {
		// Primitive state
		this.operationState = $state({
			loading: false,
			creating: false,
			error: null
		});

		// Collection state
		this.sessionOperations = $state(new Map());
	}

	async createSession(params) {
		// Direct mutation triggers reactivity
		this.operationState.creating = true;

		try {
			const session = await this.sessionApi.create(params);
		} finally {
			this.operationState.creating = false;
		}
	}
}
```

**Important**: Only use in `.svelte.js` or `.svelte` files. Regular `.js` files cannot use runes.

### $derived - Computed Values

Use for values computed from other reactive state:

```javascript
export class WorkspaceState {
	constructor() {
		this.workspaces = $state([]);

		// Simple derivation
		this.hasWorkspaces = $derived(this.workspaces.length > 0);

		// Complex derivation with $derived.by()
		this.claudeProjects = $derived.by(() => this.workspaces.filter((w) => w.isClaudeProject));
	}
}
```

**When to use $derived.by()**:

- Filtering, mapping, or transforming arrays
- Complex computations requiring multiple statements
- Any logic that needs a function body

### $effect - Side Effects

Use for synchronizing with external systems:

```javascript
export class SessionViewModel {
	constructor(appStateManager) {
		this.sessions = $derived(appStateManager.sessions.sessions);

		// React to session changes
		$effect(() => {
			console.log('Sessions updated:', this.sessions.length);
			// WARNING: Don't mutate state in effects!
		});
	}
}
```

**Critical Rules**:

- **Never mutate state inside $effect** - causes infinite loops
- Use for logging, DOM updates, external API calls
- Clean up subscriptions in effect cleanup

## Real-World Examples

### Example 1: AuthViewModel with Derived State

```javascript
export class AuthViewModel {
	// Form state
	key = $state('');
	urlInput = $state('');

	// Operation state
	error = $state('');
	loading = $state(false);

	// Configuration
	authConfig = $state(null);
	isPWA = $state(false);
	currentUrl = $state('');

	// Derived authentication status
	// API key authentication is always available (via database-backed API keys)
	hasTerminalKeyAuth = $derived.by(() => {
		// Always return true - API key auth is always available via ApiKeyManager
		return true;
	});

	hasOAuthAuth = $derived.by(() => {
		return this.authConfig?.oauth_configured ?? false;
	});

	hasAnyAuth = $derived.by(() => {
		return this.hasTerminalKeyAuth || this.hasOAuthAuth;
	});

	// Business logic
	async loginWithKey(key) {
		this.loading = true;
		this.error = '';

		try {
			// Submit via SvelteKit login action to establish a session cookie
			const form = new FormData();
			form.append('key', key);
			const response = await fetch('/login', {
				method: 'POST',
				body: form,
				credentials: 'include',
				redirect: 'manual'
			});

			if (response.ok || response.status === 303 || response.type === 'opaqueredirect') {
				return { success: true };
			}

			const data = await response.json().catch(() => ({}));
			this.error = data?.error || 'Invalid key';
			return { success: false, error: this.error };
		} catch (err) {
			this.error = 'Unable to reach server';
			return { success: false, error: this.error };
		} finally {
			this.loading = false;
		}
	}
}
```

### Example 2: SessionViewModel with Dependency Injection

```javascript
export class SessionViewModel {
	/**
	 * @param {AppState} appStateManager - Global state manager
	 * @param {SessionApiClient} sessionApi - API client
	 */
	constructor(appStateManager, sessionApi) {
		// Injected dependencies
		this.appStateManager = appStateManager;
		this.sessionApi = sessionApi;

		// Local operation state
		this.operationState = $state({
			loading: false,
			creating: false,
			error: null
		});

		// Derived state from AppState
		this.sessions = $derived(this.appStateManager.sessions.sessions);
		this.hasActiveSessions = $derived(this.appStateManager.sessions.hasActiveSessions);
	}

	async createSession({ type, workspacePath, options = {} }) {
		if (this.operationState.creating) {
			return null; // Prevent duplicate operations
		}

		this.operationState.creating = true;
		this.operationState.error = null;

		try {
			const result = await this.sessionApi.create({
				type,
				workspacePath,
				...options
			});

			// Update global state
			this.appStateManager.createSession(result);

			return result;
		} catch (error) {
			this.operationState.error = error.message;
			return null;
		} finally {
			this.operationState.creating = false;
		}
	}
}
```

### Example 3: ThemeState with API Integration

```javascript
export class ThemeState {
	constructor(config = {}) {
		this.config = config;
		this.baseUrl = config.apiBaseUrl || '';

		// Core state
		this.themes = $state([]);
		this.activeThemeId = $state(null);
		this.loading = $state(false);
		this.error = $state(null);

		// Operation states
		this.uploading = $state(false);
		this.activating = $state(false);

		// Derived theme lists
		this.presetThemes = $derived.by(() => this.themes.filter((t) => t.source === 'preset'));
		this.customThemes = $derived.by(() => this.themes.filter((t) => t.source === 'custom'));

		// Derived active theme
		this.activeTheme = $derived.by(
			() => this.themes.find((t) => t.id === this.activeThemeId) || null
		);
	}

	async loadThemes() {
		this.loading = true;
		this.error = null;

		try {
			const response = await fetch(`${this.baseUrl}/api/themes`, {
				headers: this.getHeaders()
			});

			if (!response.ok) {
				throw new Error(await response.text());
			}

			const data = await response.json();
			this.themes = data.themes || [];
		} catch (err) {
			this.error = err.message || 'Failed to load themes';
			throw err;
		} finally {
			this.loading = false;
		}
	}

	async activateTheme(themeId) {
		this.activating = true;
		this.error = null;

		try {
			const response = await fetch(`${this.baseUrl}/api/preferences`, {
				method: 'PUT',
				headers: this.getHeaders(),
				body: JSON.stringify({
					category: 'themes',
					preferences: { globalDefault: themeId }
				})
			});

			if (!response.ok) {
				throw new Error(await response.text());
			}

			this.activeThemeId = themeId;

			// Trigger page reload to apply theme
			if (typeof window !== 'undefined') {
				window.location.reload();
			}
		} catch (err) {
			this.error = err.message || 'Failed to activate theme';
			throw err;
		} finally {
			this.activating = false;
		}
	}

	getHeaders() {
		const token = localStorage.getItem('dispatch-auth-token');
		return {
			'Content-Type': 'application/json',
			...(token && { Authorization: `Bearer ${token}` })
		};
	}
}
```

## Dependency Injection Pattern

ViewModels use constructor injection for testability:

```javascript
export class SessionViewModel {
	constructor(appStateManager, sessionApi) {
		this.appStateManager = appStateManager;
		this.sessionApi = sessionApi;
	}
}
```

**Service Container** manages dependency creation:

```javascript
// ServiceContainer.svelte.js
export class ServiceContainer {
	registerCoreServices() {
		this.registerFactory('appStateManager', async () => {
			const { AppState } = await import('./AppState.svelte.js');
			return new AppState();
		});

		this.registerFactory('sessionViewModel', async () => {
			const { SessionViewModel } = await import('./SessionViewModel.svelte.js');
			const appState = await this.get('appStateManager');
			const sessionApi = await this.get('sessionApi');
			return new SessionViewModel(appState, sessionApi);
		});
	}
}
```

**Usage in Components**:

```svelte
<script>
	import { useServiceContainer } from './services/ServiceContainer.svelte.js';

	const container = useServiceContainer();
	const viewModel = await container.get('sessionViewModel');
</script>
```

See [Dependency Injection Pattern](./dependency-injection-pattern.md) for detailed DI documentation.

## Common Pitfalls

### ❌ Mutating State in $effect

```javascript
// WRONG - causes infinite loop
$effect(() => {
	if (this.sessions.length > 0) {
		this.hasData = true; // Mutation triggers re-run
	}
});
```

```javascript
// CORRECT - use $derived instead
this.hasData = $derived(this.sessions.length > 0);
```

### ❌ Using Runes in Regular .js Files

```javascript
// WRONG - file: utils/helper.js
export function createState() {
	const count = $state(0); // Error: runes only in .svelte.js or .svelte
}
```

```javascript
// CORRECT - file: utils/helper.svelte.js
export class StateHelper {
	constructor() {
		this.count = $state(0); // Works in .svelte.js
	}
}
```

### ❌ Forgetting $derived.by() for Complex Logic

```javascript
// WRONG - $derived requires single expression
this.filtered = $derived(
	const result = this.items.filter(i => i.active);
	return result.sort((a, b) => a.name.localeCompare(b.name));
);
```

```javascript
// CORRECT - use $derived.by() for function body
this.filtered = $derived.by(() => {
	const result = this.items.filter((i) => i.active);
	return result.sort((a, b) => a.name.localeCompare(b.name));
});
```

### ❌ Direct Singleton Usage Instead of Injection

```javascript
// WRONG - hard to test
import { sessionApi } from './services/SessionApiClient.js';

export class SessionViewModel {
	async loadSessions() {
		const data = await sessionApi.list(); // Direct singleton
	}
}
```

```javascript
// CORRECT - dependency injection
export class SessionViewModel {
	constructor(sessionApi) {
		this.sessionApi = sessionApi; // Injected
	}

	async loadSessions() {
		const data = await this.sessionApi.list();
	}
}
```

## Best Practices

### ✅ Single Responsibility

Each ViewModel handles one concern:

- `SessionViewModel` - Session CRUD operations
- `WorkspaceState` - Workspace data
- `ThemeState` - Theme management
- `AuthViewModel` - Authentication

### ✅ Separation of Concerns

- **ViewModels**: Business logic, state management
- **Services**: External integrations (API, WebSocket)
- **Views**: UI rendering, user interaction

### ✅ Unidirectional Data Flow

```
User Action → ViewModel Method → Service Call → State Update → View Re-render
```

### ✅ Error Handling

```javascript
async createSession(params) {
	this.operationState.creating = true;
	this.operationState.error = null;

	try {
		const session = await this.sessionApi.create(params);
		this.appStateManager.createSession(session);
		return session;
	} catch (error) {
		// Set error state for UI display
		this.operationState.error = error.message;
		// Also propagate to global error state
		this.appStateManager.sessions.setError(error.message);
		return null;
	} finally {
		this.operationState.creating = false;
	}
}
```

### ✅ Derived State Over Duplication

```javascript
// WRONG - duplicate state
this.sessions = $state([]);
this.sessionCount = $state(0);

updateSessions(sessions) {
	this.sessions = sessions;
	this.sessionCount = sessions.length; // Easy to forget!
}
```

```javascript
// CORRECT - derived state
this.sessions = $state([]);
this.sessionCount = $derived(this.sessions.length);

updateSessions(sessions) {
	this.sessions = sessions; // Count auto-updates
}
```

## Testing ViewModels

ViewModels with dependency injection are easy to test:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionViewModel } from './SessionViewModel.svelte.js';

describe('SessionViewModel', () => {
	let mockAppState;
	let mockSessionApi;
	let viewModel;

	beforeEach(() => {
		// Create mock dependencies
		mockAppState = {
			sessions: { sessions: [] },
			createSession: vi.fn()
		};

		mockSessionApi = {
			create: vi.fn(),
			list: vi.fn()
		};

		// Inject mocks
		viewModel = new SessionViewModel(mockAppState, mockSessionApi);
	});

	it('should create session successfully', async () => {
		const mockSession = { id: 'test-123', type: 'pty' };
		mockSessionApi.create.mockResolvedValue(mockSession);

		const result = await viewModel.createSession({
			type: 'pty',
			workspacePath: '/workspace'
		});

		expect(result).toEqual(mockSession);
		expect(mockAppState.createSession).toHaveBeenCalledWith(mockSession);
	});

	it('should handle errors gracefully', async () => {
		mockSessionApi.create.mockRejectedValue(new Error('API Error'));

		const result = await viewModel.createSession({
			type: 'pty',
			workspacePath: '/workspace'
		});

		expect(result).toBeNull();
		expect(viewModel.operationState.error).toBe('API Error');
	});
});
```

## File Naming Conventions

- **ViewModels with runes**: `*.svelte.js` (e.g., `SessionViewModel.svelte.js`)
- **Pure services**: `*.js` (e.g., `SessionApiClient.js`)
- **Components**: `*.svelte` (e.g., `SessionList.svelte`)

The `.svelte.js` extension signals that the file uses Svelte runes and must be processed by the Svelte compiler.

## See Also

- [Dependency Injection Pattern](./dependency-injection-pattern.md) - DI implementation details
- [Adapter Registration Guide](./adapter-guide.md) - Adding new session types
- [Error Handling Guide](../contributing/error-handling.md) - Error handling patterns
- [Svelte 5 Runes Documentation](https://svelte-5-preview.vercel.app/docs/runes) - Official Svelte 5 docs
