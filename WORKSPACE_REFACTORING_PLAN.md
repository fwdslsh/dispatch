# Workspace Page Refactoring Plan

## Executive Summary

The `/workspace` page (`src/routes/workspace/+page.svelte`) is a large monolithic component (1,636 lines) that violates multiple SOLID principles. This document outlines a comprehensive refactoring plan to decompose it into cleanly encapsulated, maintainable components.

## Current Architecture Analysis

### Problems Identified

1. **Single Responsibility Principle (SRP) Violations**
   - The main component handles: UI state, session management, workspace operations, layout management, modal control, persistence, touch gestures, and responsive behavior
   - 650+ lines of JavaScript logic mixed with 1000+ lines of template and styles

2. **Open/Closed Principle (OCP) Violations**
   - Adding new session types requires modifying multiple places in the component
   - Layout presets are hardcoded with no extension mechanism
   - Session creation logic is tightly coupled to UI

3. **Liskov Substitution Principle (LSP) Issues**
   - Different session types (Claude vs Terminal) handled with conditional logic rather than polymorphism
   - Inconsistent session object shapes requiring defensive checks

4. **Interface Segregation Principle (ISP) Violations**
   - Component exposes all internal state and methods globally
   - Child components receive more props than they need
   - No clear contracts between components

5. **Dependency Inversion Principle (DIP) Violations**
   - Direct API calls throughout the component
   - Hardcoded localStorage keys and access patterns
   - Tight coupling to specific UI libraries and frameworks

### Code Smells

- **God Object**: Main component does everything
- **Feature Envy**: Component manages state that belongs elsewhere
- **Shotgun Surgery**: Changes require modifications in multiple places
- **Long Parameter Lists**: Functions with 5+ parameters
- **Duplicated Code**: Similar patterns for Claude/Terminal sessions
- **Magic Numbers**: Hardcoded timeouts, dimensions, indices
- **Mixed Concerns**: Business logic intertwined with UI logic

## Proposed Architecture

### Core Design Principles

1. **Separation of Concerns**: Isolate business logic, state management, UI components, and services
2. **Composition over Inheritance**: Use component composition and dependency injection
3. **Domain-Driven Design**: Model sessions, workspaces, and layouts as domain entities
4. **Event-Driven Communication**: Use callback props and reactive state for loose coupling
5. **Reactive State Management**: Leverage Svelte 5 runes ($state, $derived, $effect) instead of stores
6. **MVVM Pattern**: ViewModels in `.svelte.js` files encapsulate business logic with runes
7. **Context as DI Container**: Use getContext/setContext for dependency injection

### Component Hierarchy

```
/workspace
├── WorkspacePage.svelte (Orchestrator - 50-100 lines)
├── services/
│   ├── ServiceContainer.svelte.js (DI Container using context)
│   ├── WorkspaceApiClient.js
│   ├── SessionApiClient.js
│   ├── LayoutService.js
│   ├── PersistenceService.js
│   └── TouchGestureService.js
├── viewmodels/
│   ├── WorkspaceViewModel.svelte.js (Runes-based state)
│   ├── SessionViewModel.svelte.js
│   ├── LayoutViewModel.svelte.js
│   └── ModalViewModel.svelte.js
├── features/
│   ├── header/
│   │   ├── WorkspaceHeader.svelte
│   │   ├── BrandLogo.svelte
│   │   └── LayoutControls.svelte
│   ├── session-grid/
│   │   ├── SessionGrid.svelte
│   │   ├── SessionContainer.svelte
│   │   ├── SessionHeader.svelte
│   │   └── SessionViewport.svelte
│   ├── status-bar/
│   │   ├── StatusBar.svelte
│   │   ├── MobileNavigation.svelte
│   │   ├── CreateSessionButton.svelte
│   │   └── StatusBarActions.svelte
│   ├── session-menu/
│   │   ├── SessionBottomSheet.svelte
│   │   ├── SessionList.svelte
│   │   └── SessionFilters.svelte
│   └── empty-state/
│       └── EmptyWorkspace.svelte
├── modals/
│   ├── ModalManager.svelte
│   ├── CreateSessionModal.svelte
│   ├── TerminalSessionModal.svelte
│   ├── ClaudeSessionModal.svelte
│   └── SettingsModal.svelte
├── models/
│   ├── Session.js (Plain JS model objects)
│   ├── Workspace.js
│   ├── Layout.js
│   └── SessionFactory.js
├── state/
│   ├── workspace-state.svelte.js (Shared reactive state)
│   ├── session-state.svelte.js
│   └── ui-state.svelte.js
└── utils/
    ├── responsive.js
    ├── animations.js
    └── validators.js
```

## Detailed Component Specifications

### 1. WorkspacePage.svelte (Orchestrator)

**Responsibility**: Top-level orchestration and dependency injection setup

```svelte
<script>
	import { setupServices } from './services/ServiceContainer.svelte.js';
	import { WorkspaceViewModel } from './viewmodels/WorkspaceViewModel.svelte.js';
	import WorkspaceContent from './WorkspaceContent.svelte';
	import { onMount } from 'svelte';

	// Setup DI container in context
	const services = setupServices();

	// Create ViewModels with injected services
	const workspaceVM = new WorkspaceViewModel(services.workspaceApiClient);
	const sessionVM = new SessionViewModel(services.sessionApiClient);

	onMount(() => {
		workspaceVM.initialize();
	});
</script>

<WorkspaceContent {workspaceVM} {sessionVM} />
```

### 2. Service Container (Dependency Injection)

#### ServiceContainer.svelte.js

**Responsibility**: DI container using Svelte's context API

```javascript
import { setContext, getContext } from 'svelte';

const SERVICES_KEY = Symbol('services');

export class ServiceContainer {
	constructor() {
		// Initialize API clients
		this.workspaceApiClient = new WorkspaceApiClient('/api');
		this.sessionApiClient = new SessionApiClient('/api');
		this.layoutService = new LayoutService();
		this.persistenceService = new PersistenceService('dispatch');
	}
}

export function setupServices() {
	const container = new ServiceContainer();
	setContext(SERVICES_KEY, container);
	return container;
}

export function getServices() {
	return getContext(SERVICES_KEY);
}
```

### 3. ViewModels (Business Logic with Runes)

#### WorkspaceViewModel.svelte.js

**Responsibility**: Workspace state and operations using runes

```javascript
export class WorkspaceViewModel {
	// Reactive state using $state
	workspaces = $state([]);
	currentWorkspace = $state(null);
	isLoading = $state(false);

	// Derived state using $derived
	hasWorkspaces = $derived(this.workspaces.length > 0);
	workspaceName = $derived(this.currentWorkspace?.name || 'No workspace');

	constructor(apiClient) {
		this.#apiClient = apiClient;
	}

	async loadWorkspaces() {
		this.isLoading = true;
		try {
			this.workspaces = await this.#apiClient.list();
		} finally {
			this.isLoading = false;
		}
	}

	async selectWorkspace(workspace) {
		this.currentWorkspace = workspace;
		// Additional logic...
	}
}
```

#### SessionViewModel.svelte.js

**Responsibility**: Session management with reactive state

```javascript
export class SessionViewModel {
	sessions = $state([]);
	displayedSessions = $state([]);
	selectedSession = $state(null);

	// Derived state
	pinnedSessions = $derived(this.sessions.filter((s) => s.pinned));

	activeSessions = $derived(this.sessions.filter((s) => s.isActive));

	sessionCount = $derived(this.sessions.length);

	constructor(apiClient) {
		this.#apiClient = apiClient;
	}

	async createSession(type, config) {
		const session = await this.#apiClient.create(type, config);
		this.sessions.push(session);
		return session;
	}

	async closeSession(id) {
		await this.#apiClient.close(id);
		this.sessions = this.sessions.filter((s) => s.id !== id);
	}

	pinSession(id) {
		const session = this.sessions.find((s) => s.id === id);
		if (session) session.pinned = true;
	}
}
```

### 4. Feature Components (Views using snippets)

#### SessionGrid.svelte

**Responsibility**: Grid layout and session rendering using snippets

```svelte
<script>
	let { sessions, layout, sessionItem } = $props();

	// Use $derived for reactive grid styles
	let gridColumns = $derived(layout === '2up' ? 2 : layout === '4up' ? 2 : 1);
</script>

<div class="session-grid" style:--columns={gridColumns}>
	{#each sessions as session (session.id)}
		{@render sessionItem(session)}
	{/each}
</div>
```

#### SessionContainer.svelte

**Responsibility**: Individual session wrapper with reactive state

```svelte
<script>
	let { session, onClose, onPin, header, content } = $props();

	let isFocused = $state(false);
	let isLoading = $state(true);

	// Derived state for styling
	let containerClass = $derived(`session-container ${isFocused ? 'focused' : ''} ${session.type}`);
</script>

<div class={containerClass}>
	{@render header({ session, onClose, onPin })}
	{@render content({ session, isLoading })}
</div>
```

#### SessionViewport.svelte

**Responsibility**: Session content rendering with dynamic components

```svelte
<script>
	import ClaudePane from '$lib/client/claude/ClaudePane.svelte';
	import TerminalPane from '$lib/client/terminal/TerminalPane.svelte';

	let { session, isLoading } = $props();

	// Dynamic component selection
	let Component = $derived(session.type === 'claude' ? ClaudePane : TerminalPane);
</script>

{#if Component}
	<Component {session} {isLoading} />
{/if}
```

### 5. API Clients (Data Layer)

#### WorkspaceApiClient.js

```javascript
/**
 * API client for workspace operations
 */
export class WorkspaceApiClient {
	#baseUrl;

	constructor(baseUrl = '/api') {
		this.#baseUrl = baseUrl;
	}

	/**
	 * List all workspaces
	 * @returns {Promise<Workspace[]>}
	 */
	async list() {
		const res = await fetch(`${this.#baseUrl}/workspaces`);
		if (!res.ok) throw new Error(`Failed to list workspaces`);
		return res.json();
	}

	/**
	 * Open a workspace
	 * @param {string} path - Workspace path
	 * @returns {Promise<Workspace>}
	 */
	async open(path) {
		const res = await fetch(`${this.#baseUrl}/workspaces`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'open', path })
		});
		if (!res.ok) throw new Error(`Failed to open workspace`);
		return res.json();
	}
}
```

#### SessionApiClient.js

```javascript
/**
 * API client for session operations
 */
export class SessionApiClient {
	#baseUrl;

	constructor(baseUrl = '/api') {
		this.#baseUrl = baseUrl;
	}

	/**
	 * Create a new session
	 * @param {string} type - Session type (claude|pty)
	 * @param {Object} config - Session configuration
	 * @returns {Promise<Session>}
	 */
	async create(type, config) {
		const res = await fetch(`${this.#baseUrl}/sessions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type, ...config })
		});
		if (!res.ok) throw new Error(`Failed to create session`);
		return res.json();
	}

	/**
	 * List all sessions
	 * @param {boolean} includeUnpinned - Include unpinned sessions
	 * @returns {Promise<Session[]>}
	 */
	async list(includeUnpinned = false) {
		const params = includeUnpinned ? '?include=all' : '';
		const res = await fetch(`${this.#baseUrl}/sessions${params}`);
		if (!res.ok) throw new Error(`Failed to list sessions`);
		return res.json();
	}
}
```

#### LayoutService.js

```javascript
class LayoutService {
  calculateGrid(preset, isMobile)
  getMaxVisible(preset, isMobile)
  arrangeSession(sessions, layout)
  handleResponsive(width)
}
```

#### PersistenceService.js

```javascript
class PersistenceService {
  constructor(namespace = 'dispatch') {
    this.namespace = namespace;
  }

  save(key, value)
  load(key, defaultValue)
  remove(key)
  clear()
}
```

#### TouchGestureService.js

```javascript
class TouchGestureService {
  constructor(element, options) {
    this.threshold = options.threshold || 75;
    this.onSwipeLeft = options.onSwipeLeft;
    this.onSwipeRight = options.onSwipeRight;
  }

  start()
  stop()
  handleTouchStart(e)
  handleTouchMove(e)
  handleTouchEnd(e)
}
```

### 6. Shared State (Runes-based reactive state)

#### session-state.svelte.js

```javascript
/**
 * Shared session state using Svelte 5 runes
 * Can be imported and used across components
 */

// Reactive state using $state
export const sessionState = $state({
	all: [],
	displayed: [],
	selected: null
});

// Derived state using $derived
export const pinnedSessions = $derived(sessionState.all.filter((s) => s.pinned));

export const activeSessions = $derived(sessionState.all.filter((s) => s.isActive));

export const sessionCount = $derived(sessionState.all.length);

// State mutation functions
export function addSession(session) {
	sessionState.all.push(session);
}

export function removeSession(id) {
	sessionState.all = sessionState.all.filter((s) => s.id !== id);
}

export function selectSession(session) {
	sessionState.selected = session;
}

export function setDisplayedSessions(sessions) {
	sessionState.displayed = sessions;
}
```

#### workspace-state.svelte.js

```javascript
/**
 * Shared workspace state
 */
export const workspaceState = $state({
	current: null,
	all: [],
	isLoading: false
});

export const currentWorkspaceName = $derived(workspaceState.current?.name || 'No workspace');

export function setCurrentWorkspace(workspace) {
	workspaceState.current = workspace;
}

export function setWorkspaces(workspaces) {
	workspaceState.all = workspaces;
}
```

### 7. Models (Domain Objects)

#### Session.js

```javascript
export class Session {
	constructor(id, type, workspacePath, options = {}) {
		this.id = id;
		this.type = type;
		this.workspacePath = workspacePath;
		this.pinned = options.pinned || false;
		this.title = options.title || `${type} Session`;
		this.createdAt = options.createdAt || new Date();
		this.lastActivity = options.lastActivity || new Date();
		this.isActive = options.isActive || false;
	}

	get displayName() {
		return this.title || `${this.type} #${this.id.slice(0, 6)}`;
	}

	get statusClass() {
		return this.type === 'claude' ? 'claude' : 'pty';
	}

	toJSON() {
		return {
			id: this.id,
			type: this.type,
			workspacePath: this.workspacePath,
			pinned: this.pinned,
			title: this.title,
			createdAt: this.createdAt.toISOString(),
			lastActivity: this.lastActivity.toISOString(),
			isActive: this.isActive
		};
	}
}
```

#### SessionFactory.js

```javascript
export class SessionFactory {
	static create(type, config) {
		switch (type) {
			case 'claude':
				return new ClaudeSession(config);
			case 'pty':
			case 'terminal':
				return new TerminalSession(config);
			default:
				throw new Error(`Unknown session type: ${type}`);
		}
	}

	static fromJSON(data) {
		return new Session(data.id, data.type, data.workspacePath, {
			pinned: data.pinned,
			title: data.title,
			createdAt: new Date(data.createdAt),
			lastActivity: new Date(data.lastActivity),
			isActive: data.isActive
		});
	}
}
```

## Migration Strategy

### Phase 1: Setup Svelte 5 Infrastructure (Week 1)

1. Create ServiceContainer with DI pattern
2. Implement API client classes
3. Setup context-based dependency injection
4. Write unit tests for API clients

### Phase 2: Implement ViewModels with Runes (Week 1)

1. Create ViewModels using `.svelte.js` files
2. Migrate state to `$state` runes
3. Implement `$derived` for computed values
4. Test ViewModel reactivity

### Phase 3: Extract Feature Components with Snippets (Week 2)

1. Extract SessionGrid using snippet patterns
2. Extract StatusBar with callback props
3. Extract Header with `$props()` destructuring
4. Replace slots with snippets

### Phase 4: Wire Up MVVM Pattern (Week 2)

1. Connect ViewModels to Views
2. Implement context-based service injection
3. Remove prop drilling using context
4. Test ViewModel-View integration

### Phase 5: Extract Modals with Runes (Week 3)

1. Create ModalViewModel with `$state`
2. Extract modal components using snippets
3. Implement modal state with runes
4. Test modal reactivity

### Phase 6: Polish and Optimize (Week 3)

1. Convert remaining stores to runes
2. Optimize with `$state.raw` for large data
3. Add `$effect` for side effects only where needed
4. Performance profiling with Svelte 5 DevTools

## Testing Strategy

### Unit Tests

- API client methods with mocked fetch
- ViewModel business logic and runes reactivity
- Model validations and factories
- Utility functions

### Component Tests

- Component rendering with `$props()`
- Snippet composition patterns
- Callback prop interactions
- Runes-based state changes

### Integration Tests

- Context-based DI container
- ViewModel-View integration
- Modal workflows with runes
- Session lifecycle with reactive state

### E2E Tests

- Complete user workflows
- Session creation/management
- Layout changes
- Mobile interactions

## Performance Optimizations

1. **Code Splitting**
   - Lazy load modal components with dynamic imports
   - Split `.svelte.js` ViewModels into separate chunks
   - Tree-shake unused runes and components

2. **Reactive Optimization**
   - Use `$derived` for all computed values (automatic memoization)
   - Use `$state.raw` for large immutable data structures
   - Avoid unnecessary `$effect` - prefer `$derived`
   - Use `untrack()` to exclude dependencies

3. **Virtual Scrolling**
   - For large session lists
   - Optimize with keyed `{#each}` blocks

4. **Debouncing/Throttling**
   - Use `$effect` with debounce for search
   - Throttle resize handlers
   - Batch API calls in ViewModels

## Success Metrics

1. **Code Quality**
   - No component > 200 lines
   - ViewModels handle all business logic
   - 80%+ test coverage
   - Zero prop drilling (context-based DI)
   - All state management uses runes

2. **Performance**
   - < 100ms initial render
   - < 50ms layout changes (optimized with `$derived`)
   - < 200KB JavaScript bundle
   - 60fps animations
   - Minimal re-renders with fine-grained reactivity

3. **Maintainability**
   - New session types via SessionFactory
   - Bug fixes isolated to ViewModels or Views
   - JSDoc documentation throughout
   - Consistent MVVM + runes patterns

## Risk Mitigation

1. **Backward Compatibility**
   - Maintain existing API contracts
   - Gradual migration with feature flags
   - Comprehensive regression tests

2. **User Experience**
   - No visible changes during refactor
   - Performance improvements only
   - Maintain all existing features

3. **Team Coordination**
   - Clear PR boundaries
   - Daily sync on progress
   - Shared refactoring guidelines

## Test Specifications

### Unit Tests Required

#### Service Layer Tests

1. **WorkspaceApiClient Tests** (`tests/unit/services/WorkspaceApiClient.test.js`)
   - Test list() with successful response
   - Test list() with network error
   - Test open() with valid workspace path
   - Test open() with invalid workspace path
   - Test error handling and retry logic
   - Mock fetch API responses

2. **SessionApiClient Tests** (`tests/unit/services/SessionApiClient.test.js`)
   - Test create() with valid session config
   - Test create() with invalid session type
   - Test list() with includeUnpinned flag
   - Test update() for pin/unpin operations
   - Test delete() session
   - Test batch operations
   - Mock API error responses

3. **LayoutService Tests** (`tests/unit/services/LayoutService.test.js`)
   - Test calculateGrid() for all layout presets
   - Test getMaxVisible() for mobile/desktop
   - Test arrangeSession() with various session counts
   - Test handleResponsive() breakpoints
   - Test edge cases (empty sessions, single session)

4. **PersistenceService Tests** (`tests/unit/services/PersistenceService.test.js`)
   - Test save() with different data types
   - Test load() with existing and missing keys
   - Test namespace isolation
   - Test clear() functionality
   - Mock localStorage API

5. **TouchGestureService Tests** (`tests/unit/services/TouchGestureService.test.js`)
   - Test swipe left detection
   - Test swipe right detection
   - Test threshold configuration
   - Test gesture cancellation
   - Mock touch events

#### ViewModel Tests

6. **WorkspaceViewModel Tests** (`tests/unit/viewmodels/WorkspaceViewModel.test.js`)
   - Test reactive state updates with $state
   - Test derived state calculations with $derived
   - Test loadWorkspaces() success/failure
   - Test selectWorkspace() state changes
   - Test workspace creation flow
   - Verify reactivity triggers

7. **SessionViewModel Tests** (`tests/unit/viewmodels/SessionViewModel.test.js`)
   - Test session CRUD operations
   - Test pinned/unpinned filtering
   - Test active session tracking
   - Test session selection
   - Test bulk operations
   - Test reactive state propagation

8. **LayoutViewModel Tests** (`tests/unit/viewmodels/LayoutViewModel.test.js`)
   - Test layout preset changes
   - Test responsive adjustments
   - Test session visibility calculations
   - Test grid recalculation triggers

9. **ModalViewModel Tests** (`tests/unit/viewmodels/ModalViewModel.test.js`)
   - Test modal open/close state
   - Test modal type switching
   - Test modal data passing
   - Test nested modal handling

#### Model Tests

10. **Session Model Tests** (`tests/unit/models/Session.test.js`)
    - Test Session constructor
    - Test displayName computation
    - Test statusClass logic
    - Test JSON serialization/deserialization
    - Test property validation

11. **SessionFactory Tests** (`tests/unit/models/SessionFactory.test.js`)
    - Test create() for each session type
    - Test fromJSON() parsing
    - Test error handling for unknown types
    - Test factory extensibility

12. **Workspace Model Tests** (`tests/unit/models/Workspace.test.js`)
    - Test Workspace creation
    - Test path validation
    - Test metadata handling

### Component Tests

13. **WorkspacePage Tests** (`tests/components/WorkspacePage.test.js`)
    - Test service container setup
    - Test ViewModel initialization
    - Test context provision
    - Test lifecycle hooks

14. **SessionGrid Tests** (`tests/components/SessionGrid.test.js`)
    - Test grid rendering with different layouts
    - Test session item rendering via snippets
    - Test responsive grid columns
    - Test empty state handling

15. **SessionContainer Tests** (`tests/components/SessionContainer.test.js`)
    - Test focused state management
    - Test loading state display
    - Test header/content snippet rendering
    - Test prop passing to snippets

16. **SessionViewport Tests** (`tests/components/SessionViewport.test.js`)
    - Test dynamic component selection
    - Test Claude/Terminal component loading
    - Test error boundary handling

17. **StatusBar Tests** (`tests/components/StatusBar.test.js`)
    - Test mobile navigation display
    - Test action button interactions
    - Test responsive behavior

18. **Modal Component Tests** (`tests/components/modals/*.test.js`)
    - Test CreateSessionModal form validation
    - Test TerminalSessionModal configuration
    - Test ClaudeSessionModal authentication flow
    - Test SettingsModal state persistence

### Integration Tests

19. **DI Container Integration** (`tests/integration/ServiceContainer.test.js`)
    - Test service registration
    - Test context-based injection
    - Test service lifecycle
    - Test cross-service dependencies

20. **ViewModel-View Integration** (`tests/integration/ViewModelIntegration.test.js`)
    - Test state synchronization
    - Test reactive updates across components
    - Test callback prop execution
    - Test error propagation

21. **Session Lifecycle Tests** (`tests/integration/SessionLifecycle.test.js`)
    - Test session creation flow
    - Test session switching
    - Test session termination
    - Test persistence across refreshes

22. **Layout Management Tests** (`tests/integration/LayoutManagement.test.js`)
    - Test layout changes with active sessions
    - Test responsive breakpoint transitions
    - Test session visibility updates

### E2E Tests

23. **Complete User Workflows** (`tests/e2e/UserWorkflows.test.js`)
    - Test workspace selection and session creation
    - Test multiple session management
    - Test layout switching with sessions
    - Test mobile navigation flow

24. **Performance Tests** (`tests/e2e/Performance.test.js`)
    - Test initial page load time
    - Test session creation response time
    - Test layout change animation smoothness
    - Test memory usage with multiple sessions

## Task Checklist

### Phase 0: Preparation & Planning (Pre-requisites)

- [ ] **0.1** Create feature branch for refactoring work
- [ ] **0.2** Set up test infrastructure for new test suites
- [ ] **0.3** Document existing API contracts for backward compatibility
- [ ] **0.4** Create performance benchmarks of current implementation
- [ ] **0.5** Set up feature flags for gradual rollout
- [ ] **0.6** Review and document all existing localStorage keys
- [ ] **0.7** Audit current session state management patterns

### Phase 1: Setup Svelte 5 Infrastructure (Week 1)

#### Service Container Setup

- [ ] **1.1** Create `ServiceContainer.svelte.js` with DI pattern
  - Implement service registration
  - Set up context API integration
  - Add service lifecycle management
- [ ] **1.2** Create `WorkspaceApiClient.js`
  - Implement all workspace API methods
  - Add error handling and retries
  - Write comprehensive unit tests
- [ ] **1.3** Create `SessionApiClient.js`
  - Implement session CRUD operations
  - Add batch operation support
  - Write unit tests with mocked responses
- [ ] **1.4** Create `LayoutService.js`
  - Port existing layout logic
  - Add responsive calculations
  - Test all layout presets
- [ ] **1.5** Create `PersistenceService.js`
  - Implement namespaced storage
  - Add migration from old keys
  - Test storage operations
- [ ] **1.6** Create `TouchGestureService.js`
  - Port touch handling logic
  - Add gesture configuration
  - Test on touch devices

### Phase 2: Implement ViewModels with Runes (Week 1)

#### ViewModel Implementation

- [ ] **2.1** Create `WorkspaceViewModel.svelte.js`
  - Convert workspace state to `$state` runes
  - Implement `$derived` for computed properties
  - Add workspace operations
  - Test reactive state updates
- [ ] **2.2** Create `SessionViewModel.svelte.js`
  - Migrate session state to runes
  - Implement session filtering with `$derived`
  - Add session lifecycle methods
  - Test state propagation
- [ ] **2.3** Create `LayoutViewModel.svelte.js`
  - Convert layout state to runes
  - Add responsive state management
  - Test layout calculations
- [ ] **2.4** Create `ModalViewModel.svelte.js`
  - Implement modal state with runes
  - Add modal queue management
  - Test modal transitions
- [ ] **2.5** Create shared state modules
  - Implement `session-state.svelte.js`
  - Implement `workspace-state.svelte.js`
  - Implement `ui-state.svelte.js`
  - Test cross-module reactivity

### Phase 3: Extract Feature Components with Snippets (Week 2)

#### Component Extraction

- [ ] **3.1** Extract Header components
  - Create `WorkspaceHeader.svelte`
  - Create `BrandLogo.svelte`
  - Create `LayoutControls.svelte`
  - Convert to snippet patterns
- [ ] **3.2** Extract SessionGrid components
  - Create `SessionGrid.svelte` with snippets
  - Create `SessionContainer.svelte`
  - Create `SessionHeader.svelte`
  - Create `SessionViewport.svelte`
  - Test grid rendering
- [ ] **3.3** Extract StatusBar components
  - Create `StatusBar.svelte`
  - Create `MobileNavigation.svelte`
  - Create `CreateSessionButton.svelte`
  - Create `StatusBarActions.svelte`
  - Test responsive behavior
- [ ] **3.4** Extract SessionMenu components
  - Create `SessionBottomSheet.svelte`
  - Create `SessionList.svelte`
  - Create `SessionFilters.svelte`
  - Test mobile interactions
- [ ] **3.5** Extract EmptyState component
  - Create `EmptyWorkspace.svelte`
  - Add empty state variations
  - Test rendering conditions

### Phase 4: Wire Up MVVM Pattern (Week 2)

#### Integration Tasks

- [ ] **4.1** Create main `WorkspacePage.svelte` orchestrator
  - Set up DI container
  - Initialize ViewModels
  - Wire up context providers
  - Test initialization flow
- [ ] **4.2** Connect ViewModels to View components
  - Replace prop drilling with context
  - Implement callback props
  - Test state synchronization
- [ ] **4.3** Migrate event handlers to ViewModels
  - Move business logic from views
  - Implement command pattern
  - Test user interactions
- [ ] **4.4** Remove old state management
  - Remove Svelte stores
  - Clean up event dispatchers
  - Update component props
- [ ] **4.5** Integration testing
  - Test ViewModel-View communication
  - Test cross-component reactivity
  - Test error handling

### Phase 5: Extract Modals with Runes (Week 3)

#### Modal Refactoring

- [ ] **5.1** Create `ModalManager.svelte`
  - Implement modal orchestration
  - Add modal stacking support
  - Test modal lifecycle
- [ ] **5.2** Extract `CreateSessionModal.svelte`
  - Convert to runes-based state
  - Add form validation
  - Test session creation
- [ ] **5.3** Extract `TerminalSessionModal.svelte`
  - Migrate configuration state
  - Add shell selection
  - Test terminal setup
- [ ] **5.4** Extract `ClaudeSessionModal.svelte`
  - Port authentication flow
  - Add error handling
  - Test Claude integration
- [ ] **5.5** Extract `SettingsModal.svelte`
  - Migrate settings state
  - Add persistence
  - Test settings updates

### Phase 6: Polish and Optimize (Week 3)

#### Optimization Tasks

- [ ] **6.1** Performance optimization
  - Implement code splitting
  - Add lazy loading for modals
  - Optimize bundle size
  - Profile with DevTools
- [ ] **6.2** Convert remaining legacy patterns
  - Replace all stores with runes
  - Update to callback props
  - Remove event dispatchers
- [ ] **6.3** Add `$state.raw` optimizations
  - Identify large data structures
  - Convert to `$state.raw`
  - Test performance improvements
- [ ] **6.4** Implement virtual scrolling
  - Add for large session lists
  - Test scroll performance
  - Verify keyed each blocks
- [ ] **6.5** Final testing and validation
  - Run full test suite
  - Performance benchmarking
  - User acceptance testing
  - Bug fixes and polish

### Phase 7: Cleanup and Documentation (Week 4)

#### Finalization Tasks

- [ ] **7.1** Remove backward compatibility code
  - Delete old component files
  - Remove feature flags
  - Clean up migration utilities
  - Remove deprecated API endpoints
- [ ] **7.2** Update documentation
  - Write component documentation
  - Update API documentation
  - Create migration guide
  - Document new patterns
- [ ] **7.3** Final review and merge
  - Code review sessions
  - Performance validation
  - Security audit
  - Merge to main branch

## Success Criteria

### Scope

- **In Scope:**
  - Complete refactoring of `/workspace` page and all child components
  - Migration to Svelte 5 runes and modern patterns
  - Implementation of MVVM architecture with ViewModels
  - Comprehensive test coverage (>80%)
  - Performance optimizations
  - Documentation updates

- **Out of Scope:**
  - Changes to backend APIs (maintain compatibility)
  - UI/UX redesign (maintain current design)
  - New features (refactoring only)
  - Other pages/routes (focus on `/workspace` only)

### Acceptance Criteria

1. **Functional Requirements:**
   - All existing functionality preserved
   - No user-visible changes during normal operation
   - All session types work correctly
   - Mobile interactions maintained
   - Settings persistence works

2. **Technical Requirements:**
   - No component exceeds 200 lines
   - All state management uses Svelte 5 runes
   - Zero prop drilling (context-based DI only)
   - ViewModels contain all business logic
   - Views are pure presentation components
   - 80%+ test coverage achieved

3. **Performance Requirements:**
   - Initial render < 100ms
   - Layout changes < 50ms
   - Bundle size < 200KB
   - 60fps animations maintained
   - Memory usage optimized

4. **Code Quality Requirements:**
   - All tests passing
   - No console errors/warnings
   - JSDoc documentation complete
   - Consistent code style
   - Type safety via JSDoc annotations

### Backward Compatibility Notes

- **During Migration:**
  - Feature flags control gradual rollout
  - Old and new components coexist temporarily
  - API contracts remain unchanged
  - localStorage keys mapped to new structure

- **Post-Migration Cleanup:**
  - All backward compatibility code MUST be removed
  - Old component files deleted
  - Feature flags removed
  - Migration utilities deleted
  - Legacy localStorage keys cleaned up
  - Deprecated patterns eliminated

### Risk Management

1. **High Risk Items:**
   - Session state synchronization
   - Touch gesture handling
   - Modal stacking behavior
   - Performance regressions

2. **Mitigation Strategies:**
   - Comprehensive testing at each phase
   - Performance benchmarking
   - Feature flag rollback capability
   - User acceptance testing
   - Incremental deployment

## Conclusion

This refactoring will transform the monolithic `/workspace` page into a maintainable, testable, and extensible architecture using modern Svelte 5 patterns. By leveraging runes, MVVM architecture, and context-based dependency injection, we'll achieve:

- **Better maintainability** through ViewModels that encapsulate business logic with runes
- **Improved testability** with isolated ViewModels and pure View components
- **Enhanced performance** via Svelte 5's fine-grained reactivity (`$state`, `$derived`)
- **Easier extensibility** using dependency injection and the factory pattern
- **Modern patterns** that align with Svelte 5 best practices and eliminate technical debt
- **Type safety** with JSDoc annotations and explicit contracts

Key Svelte 5 improvements over the previous approach:

- **Runes instead of stores** for simpler, more intuitive reactive state
- **Snippets instead of slots** for better composition and type safety
- **Context as DI container** eliminating prop drilling
- **`.svelte.js` ViewModels** enabling reactive logic outside components
- **Callback props instead of events** for clearer component contracts

The migration leverages Svelte 5's compilation advantages while maintaining backward compatibility during the transition period. All backward compatibility code will be completely removed once the migration is validated and complete, ensuring a clean, modern codebase.
