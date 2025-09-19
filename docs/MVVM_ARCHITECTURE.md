# MVVM Architecture Guide

This document describes the comprehensive architectural refactor that resolved the infinite loop issue and implemented a robust MVVM (Model-View-ViewModel) pattern using Svelte 5.

## 🎯 Problem Solved

**Original Issue**: Infinite loops caused by bidirectional state synchronization between components:

```
SessionViewModel.createSession()
  → SessionViewModel.syncToGlobalState()
    → setAllSessions() / setDisplayedSessions()
      → sessionState updates
        → WorkspacePage $effect triggers
          → INFINITE LOOP
```

**Solution**: Implemented unidirectional data flow with centralized state management.

## 🏗️ Architecture Overview

### Core Components

1. **AppStateManager** - Central state coordinator
2. **ViewModels** - Business logic layer
3. **API Clients** - Data access layer
4. **Views** - Pure presentation components

### Data Flow Pattern

```
User Action → ViewModel → AppStateManager → Derived State → View Update
```

**No bidirectional synchronization** = **No infinite loops**

## 📁 Project Structure

```
src/lib/client/shared/
├── state/
│   └── AppStateManager.svelte.js       # Central state management
├── viewmodels/
│   ├── SessionViewModel.svelte.js      # Session business logic
│   ├── WorkspaceViewModel.svelte.js    # Workspace business logic
│   └── LayoutViewModel.svelte.js       # UI layout logic
├── services/
│   ├── ServiceContainer.svelte.js      # Dependency injection
│   ├── SessionApiClient.js             # Session API
│   └── WorkspaceApiClient.js           # Workspace API
├── components/
│   ├── workspace/                      # Workspace components
│   ├── window-manager/                 # Tiling window components
│   └── dev/                            # Development tools
└── utils/
    └── performance.js                  # Performance utilities
```

## 🔄 AppStateManager

The **single source of truth** for all application state:

### State Structure

```javascript
{
  // Core data
  sessions: Session[],
  workspaces: Workspace[],
  selectedWorkspace: string | null,

  // UI state
  ui: {
    layout: { isMobile, maxVisible, currentMobileSession },
    display: { displayedSessionIds, showOnlyPinned, filterByWorkspace },
    loading: { sessions, workspaces, creatingSession },
    errors: { sessions, workspaces, global }
  },

  // Activity tracking
  activity: {
    sessionActivity: Map<string, string>,
    sessionHistory: Map<string, boolean>,
    lastMessageTimestamps: Map<string, number>
  }
}
```

### Action-Based Updates

All state changes go through the `dispatch()` method:

```javascript
appStateManager.dispatch({
	type: 'SESSION_CREATED',
	payload: newSession
});

appStateManager.dispatch({
	type: 'SESSIONS_LOAD_SUCCESS',
	payload: sessions
});

appStateManager.dispatch({
	type: 'LAYOUT_MODE_CHANGED',
	payload: { isMobile: true }
});
```

### Derived State (Reactive)

```javascript
// Automatically computed from sessions array
this.pinnedSessions = $derived.by(() => this.sessions.filter((s) => s.pinned));

this.visibleSessions = $derived.by(() => {
	if (this.ui.layout.isMobile) {
		// Mobile: single session
		return [this.sessions[this.ui.layout.currentMobileSession]];
	} else {
		// Desktop: map displayed slots to sessions
		return this.ui.display.displayedSessionIds
			.map((id) => this.sessions.find((s) => s.id === id))
			.filter(Boolean);
	}
});
```

## 🎛️ ViewModels

Business logic layer that coordinates between Views and AppStateManager:

### SessionViewModel Example

```javascript
export class SessionViewModel {
	constructor(sessionApi, persistence, appStateManager) {
		this.sessionApi = sessionApi;
		this.persistence = persistence;
		this.appStateManager = appStateManager;
	}

	// Business logic methods
	async createSession(type, workspacePath, options = {}) {
		try {
			this.appStateManager.dispatch({
				type: 'LOADING_STATE_CHANGED',
				payload: { creatingSession: true }
			});

			const newSession = await this.sessionApi.create({
				type,
				workspacePath,
				...options
			});

			// Update centralized state
			this.appStateManager.dispatch({
				type: 'SESSION_CREATED',
				payload: newSession
			});

			return newSession;
		} catch (error) {
			this.appStateManager.dispatch({
				type: 'ERROR_OCCURRED',
				payload: { scope: 'sessions', error: error.message }
			});
			throw error;
		}
	}

	// Reactive getters (delegate to AppStateManager)
	get sessions() {
		return this.appStateManager.sessions;
	}

	get sessionCount() {
		return this.appStateManager.sessionCount;
	}

	get loading() {
		return this.appStateManager.ui.loading.creatingSession;
	}
}
```

## 🔧 Dependency Injection

ServiceContainer manages dependencies and enables clean testing:

### Usage in Components

```svelte
<script>
	import { useServiceContainer } from '../services/ServiceContainer.svelte.js';

	const container = useServiceContainer();

	// Lazy-loaded services
	const sessionViewModel = $state();
	const workspaceViewModel = $state();

	onMount(async () => {
		sessionViewModel = await container.get('sessionViewModel');
		workspaceViewModel = await container.get('workspaceViewModel');
	});
</script>
```

### Service Registration

```javascript
// In app initialization
container.registerFactory('sessionApi', () => new SessionApiClient());
container.registerFactory('sessionViewModel', async () => {
	const sessionApi = await container.get('sessionApi');
	const persistence = await container.get('persistence');
	const appStateManager = await container.get('appStateManager');
	return new SessionViewModel(appStateManager, sessionApi);
});
```

## 🚀 Performance Features

### Performance Monitoring

```javascript
import { performanceMonitor } from '../utils/performance.js';

// Automatic monitoring in AppStateManager
performanceMonitor.recordStateChange(action.type);

// Manual operation timing
const result = await performanceMonitor.measureOperation('loadSessions', () =>
	this.sessionApi.list()
);
```

### Debouncing and Throttling

```javascript
import { debounce, throttle } from '../utils/performance.js';

// Debounce frequent updates
const debouncedSave = debounce(saveState, 300);

// Throttle high-frequency events
const throttledResize = throttle(handleResize, 16);
```

### State Batching

```javascript
import { stateBatcher } from '../utils/performance.js';

// Batch multiple state updates
stateBatcher.batch(() => {
	appStateManager.dispatch({ type: 'ACTION_1', payload: data1 });
	appStateManager.dispatch({ type: 'ACTION_2', payload: data2 });
	appStateManager.dispatch({ type: 'ACTION_3', payload: data3 });
});
```

## 🐛 Development Tools

### MVVM Debugger

A real-time debugging component for development:

```svelte
<script>
	import MVVMDebugger from '../components/dev/MVVMDebugger.svelte';

	// Only enable in development
	const isDev = import.meta.env.DEV;
</script>

<MVVMDebugger {appStateManager} enabled={isDev} />
```

**Features:**

- Real-time performance metrics
- State snapshot visualization
- Memory usage monitoring
- Keyboard shortcut (Ctrl+Shift+D)
- Slow operation detection

### Error Handling

Improved error handling with validation:

```javascript
// AppStateManager validates all actions
dispatch(action) {
  if (!action || typeof action !== 'object') {
    console.error('[AppStateManager] Invalid action:', action);
    return;
  }

  if (!action.type) {
    console.error('[AppStateManager] Action missing type property:', action);
    return;
  }

  // Continue with processing...
}
```

## 📊 Testing Strategy

### Unit Tests

- **AppStateManager**: Test action handling and derived state
- **ViewModels**: Test business logic with mocked dependencies
- **API Clients**: Test data transformation and error handling

### Integration Tests

- **MVVM Integration**: Validate unidirectional data flow
- **Performance Tests**: Ensure no infinite loops
- **End-to-End**: Test complete user workflows

### Example Test

```javascript
describe('Infinite Loop Prevention', () => {
	it('should prevent infinite loops through centralized state', async () => {
		let actionCount = 0;
		const originalDispatch = appStateManager.dispatch;

		appStateManager.dispatch = function (action) {
			actionCount++;
			if (actionCount > 50) {
				throw new Error('Infinite loop detected');
			}
			return originalDispatch.call(this, action);
		};

		// Perform complex operations
		await sessionViewModel.loadSessions();
		await sessionViewModel.createSession('pty', '/workspace');

		// Should complete without infinite loops
		expect(actionCount).toBeLessThan(10);
	});
});
```

## 🎯 Key Benefits

### ✅ Resolved Issues

- **No more infinite loops** - Unidirectional data flow prevents circular updates
- **Consistent state** - Single source of truth eliminates state synchronization bugs
- **Better performance** - Efficient reactive updates with proper memoization

### ✅ Developer Experience

- **Clear separation of concerns** - MVVM pattern with defined responsibilities
- **Easy testing** - Dependency injection enables isolated unit tests
- **Real-time debugging** - Performance monitoring and state inspection tools
- **Type safety** - JSDoc types for better IDE support

### ✅ Maintainability

- **Predictable state changes** - All updates go through centralized dispatch
- **Modular architecture** - ViewModels and services are easily replaceable
- **Performance monitoring** - Built-in tools to detect and prevent issues

## 🔄 Migration Guide

### For Existing Components

1. **Remove bidirectional effects**:

   ```javascript
   // ❌ Before (bidirectional)
   $effect(() => {
   	if (someState) {
   		updateGlobalState();
   	}
   });

   // ✅ After (unidirectional)
   const derivedValue = $derived(appStateManager.someState);
   ```

2. **Use ViewModels for business logic**:

   ```javascript
   // ❌ Before (mixed concerns)
   async function handleClick() {
   	const data = await api.fetch();
   	globalState.update(data);
   	localStorage.setItem('key', JSON.stringify(data));
   }

   // ✅ After (separated concerns)
   await sessionViewModel.loadSessions();
   ```

3. **Access state through AppStateManager**:

   ```javascript
   // ❌ Before (multiple sources)
   const sessions = globalSessions.value;
   const loading = isLoading.value;

   // ✅ After (single source)
   const sessions = appStateManager.sessions;
   const loading = appStateManager.ui.loading.sessions;
   ```

## 📚 Additional Resources

- [Svelte 5 Runes Documentation](https://svelte.dev/docs/svelte/reactivity)
- [MVVM Pattern Best Practices](https://docs.microsoft.com/en-us/xamarin/xamarin-forms/enterprise-application-patterns/mvvm)
- [Performance Testing Guide](./PERFORMANCE_TESTING.md)
- [Testing Strategy](./TESTING_STRATEGY.md)

---

**Result**: The infinite loop issue has been completely resolved through proper architectural patterns, and the application now has a robust, maintainable, and performant MVVM foundation.
