# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-03-ui-architecture-refactor/spec.md

> Created: 2025-09-03
> Version: 1.0.0

## Technical Requirements

### 1. MVVM Architecture Implementation

#### Model Layer

```
src/lib/models/
├── TerminalModel.js          # Terminal session data model
├── ProjectModel.js           # Project data model
├── ChatModel.js             # Chat/auxiliary data model
├── SessionModel.js          # Session metadata model
└── base/
    ├── BaseModel.js         # Abstract base model with validation
    └── ModelValidation.js   # Validation utilities
```

**Model Pattern:**

```javascript
// BaseModel.js
export class BaseModel {
	constructor(data = {}) {
		this.validate(data);
		Object.assign(this, data);
	}

	validate(data) {
		// Implementation with joi or similar
	}

	toJSON() {
		return { ...this };
	}
}

// TerminalModel.js
export class TerminalModel extends BaseModel {
	constructor(data) {
		super(data);
		this.id = data.id;
		this.status = data.status || 'idle';
		this.dimensions = { cols: 80, rows: 24, ...data.dimensions };
		this.mode = data.mode || 'shell';
	}
}
```

#### ViewModel Layer

```
src/lib/viewmodels/
├── TerminalViewModel.js      # Terminal UI state and operations
├── ProjectViewModel.js       # Project management UI state
├── ChatViewModel.js         # Chat UI state and operations
├── SessionViewModel.js      # Session list UI state
└── base/
    ├── BaseViewModel.js     # Abstract base with common patterns
    └── ViewModelFactory.js  # Factory for ViewModel instantiation
```

**ViewModel Pattern with Svelte 5 Runes:**

```javascript
// BaseViewModel.js
export class BaseViewModel {
	#state = $state({});
	#loading = $state(false);
	#error = $state(null);

	constructor(model) {
		this.model = model;
	}

	get state() {
		return this.#state;
	}
	get loading() {
		return this.#loading;
	}
	get error() {
		return this.#error;
	}

	setLoading(value) {
		this.#loading = value;
	}
	setError(error) {
		this.#error = error;
	}
}

// TerminalViewModel.js
export class TerminalViewModel extends BaseViewModel {
	#terminalState = $state({
		isConnected: false,
		output: [],
		input: '',
		dimensions: { cols: 80, rows: 24 }
	});

	#computedProperties = $derived({
		canSendInput: this.#terminalState.isConnected && !this.loading,
		outputText: this.#terminalState.output.join('\n')
	});

	constructor(terminalModel) {
		super(terminalModel);
	}

	get terminalState() {
		return this.#terminalState;
	}
	get computed() {
		return this.#computedProperties;
	}

	async connect() {
		this.setLoading(true);
		try {
			// Socket connection logic
			this.#terminalState.isConnected = true;
		} catch (error) {
			this.setError(error);
		} finally {
			this.setLoading(false);
		}
	}

	sendInput(input) {
		if (!this.computed.canSendInput) return;
		// Send input logic
	}
}
```

#### View Layer Component Structure

```
src/lib/components/
├── Terminal/
│   ├── TerminalContainer.svelte     # Main container (connects to ViewModel)
│   ├── TerminalDisplay.svelte       # xterm.js wrapper (pure presentation)
│   ├── TerminalToolbar.svelte       # Terminal controls
│   └── TerminalStatus.svelte        # Connection status indicator
├── Project/
│   ├── ProjectManager.svelte        # Project management container
│   ├── ProjectList.svelte          # Project listing (pure)
│   ├── ProjectForm.svelte          # Project creation/edit form
│   └── ProjectCard.svelte          # Individual project display
├── Chat/
│   ├── ChatContainer.svelte        # Chat system container
│   ├── ChatMessages.svelte         # Message display (pure)
│   ├── ChatInput.svelte           # Message input (pure)
│   └── ChatStatus.svelte          # Connection status
├── Session/
│   ├── SessionManager.svelte       # Session management container
│   ├── SessionList.svelte         # Session listing (pure)
│   └── SessionCard.svelte         # Individual session display
├── shared/
│   ├── LoadingSpinner.svelte      # Reusable loading component
│   ├── ErrorDisplay.svelte        # Error message component
│   ├── Modal.svelte              # Modal wrapper
│   └── Button.svelte             # Standardized button component
└── layout/
    ├── MainLayout.svelte         # Application shell
    ├── HeaderToolbar.svelte      # Navigation (refactored)
    └── Sidebar.svelte           # Navigation sidebar
```

### 2. Component Decomposition Strategy

#### Container vs Presentation Components

**Container Components (Smart):**

- Connect to ViewModels
- Handle business logic
- Manage state transitions
- Pass data to presentation components

**Presentation Components (Pure):**

- Receive data via props
- Emit events for user actions
- No direct state management
- Highly reusable

#### Component Lifecycle Pattern

```javascript
// TerminalContainer.svelte (Container)
<script>
  import { TerminalViewModel } from '$lib/viewmodels/TerminalViewModel.js';
  import { TerminalModel } from '$lib/models/TerminalModel.js';
  import TerminalDisplay from './TerminalDisplay.svelte';

  let { sessionId } = $props();

  // Initialize ViewModel with Model
  const terminalModel = new TerminalModel({ id: sessionId });
  const viewModel = new TerminalViewModel(terminalModel);

  // Reactive state from ViewModel
  $effect(() => {
    if (sessionId) {
      viewModel.connect();
    }
  });

  // Cleanup
  $effect(() => {
    return () => viewModel.disconnect();
  });
</script>

<TerminalDisplay
  {state: viewModel.terminalState}
  {computed: viewModel.computed}
  {onInput: viewModel.sendInput}
  {onResize: viewModel.resize}
/>

// TerminalDisplay.svelte (Presentation)
<script>
  let { state, computed, onInput, onResize } = $props();
</script>

<div class="terminal-container">
  {#if computed.canSendInput}
    <div class="terminal-output">{computed.outputText}</div>
  {/if}
</div>
```

### 3. State Management Consolidation with Svelte 5 Runes

#### Context-based Global State

```
src/lib/contexts/
├── AppContext.svelte.js          # Global application state
├── TerminalContext.svelte.js     # Terminal-specific global state
├── ProjectContext.svelte.js      # Project-specific global state
└── ChatContext.svelte.js        # Chat-specific global state
```

**Context Pattern:**

```javascript
// AppContext.svelte.js
import { getContext, setContext } from 'svelte';

class AppState {
	#user = $state(null);
	#isAuthenticated = $state(false);
	#theme = $state('dark');
	#socketConnection = $state(null);

	constructor() {
		// Initialize state
	}

	get user() {
		return this.#user;
	}
	get isAuthenticated() {
		return this.#isAuthenticated;
	}
	get theme() {
		return this.#theme;
	}
	get socketConnection() {
		return this.#socketConnection;
	}

	setUser(user) {
		this.#user = user;
	}
	setAuthenticated(value) {
		this.#isAuthenticated = value;
	}
	setTheme(theme) {
		this.#theme = theme;
	}
	setSocketConnection(connection) {
		this.#socketConnection = connection;
	}
}

const APP_CONTEXT_KEY = Symbol('app-context');

export function createAppContext() {
	const appState = new AppState();
	setContext(APP_CONTEXT_KEY, appState);
	return appState;
}

export function getAppContext() {
	return getContext(APP_CONTEXT_KEY);
}
```

#### Service Layer Integration

```
src/lib/services/
├── SocketService.js              # WebSocket communication
├── TerminalService.js           # Terminal operations
├── ProjectService.js            # Project management
├── ChatService.js              # Chat operations
├── StorageService.js           # Local storage management
└── base/
    ├── BaseService.js          # Abstract service base
    └── ServiceRegistry.js     # Service dependency injection
```

**Service Pattern:**

```javascript
// BaseService.js
export class BaseService {
	constructor(dependencies = {}) {
		this.dependencies = dependencies;
	}

	async execute(operation, ...args) {
		try {
			return await this[operation](...args);
		} catch (error) {
			console.error(`Service error in ${operation}:`, error);
			throw error;
		}
	}
}

// TerminalService.js
export class TerminalService extends BaseService {
	constructor(dependencies) {
		super(dependencies);
		this.socketService = dependencies.socketService;
	}

	async createSession(options) {
		return this.socketService.emit('create', options);
	}

	async attachToSession(sessionId, options) {
		return this.socketService.emit('attach', { sessionId, ...options });
	}
}
```

### 4. Deprecated Code Removal Plan

#### Phase 1: Component Migration (Week 1-2)

**Files to Refactor:**

- `src/lib/components/Terminal.svelte` → Split into MVVM components
- `src/lib/components/Chat.svelte` → Split into MVVM components
- `src/lib/components/HeaderToolbar.svelte` → Refactor to container/presentation

**Deprecated Patterns to Remove:**

```javascript
// OLD: Direct state management in components
let terminalState = writable({});

// NEW: ViewModel-based state
const viewModel = new TerminalViewModel(model);
```

#### Phase 2: Context Replacement (Week 2-3)

**Files to Update:**

- Remove legacy context files in `src/lib/contexts/`
- Migrate to new Svelte 5 rune-based contexts
- Update all context consumers

#### Phase 3: Service Layer (Week 3-4)

**Consolidation Tasks:**

- Extract service logic from components
- Implement service registry
- Update ViewModels to use services

#### Phase 4: Legacy Cleanup (Week 4)

**Files to Remove:**

- Old context implementations
- Deprecated utility functions
- Unused component variants

### 5. Testing Infrastructure Requirements

#### Component Testing Structure

```
tests/
├── unit/
│   ├── models/
│   │   ├── TerminalModel.test.js
│   │   └── ProjectModel.test.js
│   ├── viewmodels/
│   │   ├── TerminalViewModel.test.js
│   │   └── ProjectViewModel.test.js
│   ├── services/
│   │   ├── TerminalService.test.js
│   │   └── ProjectService.test.js
│   └── components/
│       ├── Terminal/
│       │   ├── TerminalContainer.test.js
│       │   └── TerminalDisplay.test.js
│       └── Project/
│           └── ProjectManager.test.js
├── integration/
│   ├── terminal-workflow.test.js
│   └── project-management.test.js
└── e2e/
    ├── terminal-session.test.js
    └── project-lifecycle.test.js
```

#### Testing Patterns

```javascript
// ViewModel Testing
import { describe, it, expect, beforeEach } from 'vitest';
import { TerminalViewModel } from '$lib/viewmodels/TerminalViewModel.js';
import { TerminalModel } from '$lib/models/TerminalModel.js';

describe('TerminalViewModel', () => {
	let viewModel;

	beforeEach(() => {
		const model = new TerminalModel({ id: 'test-session' });
		viewModel = new TerminalViewModel(model);
	});

	it('should initialize with correct state', () => {
		expect(viewModel.terminalState.isConnected).toBe(false);
		expect(viewModel.computed.canSendInput).toBe(false);
	});
});

// Component Testing with Svelte Testing Library
import { render, screen, fireEvent } from '@testing-library/svelte';
import TerminalDisplay from '$lib/components/Terminal/TerminalDisplay.svelte';

it('should render terminal output', () => {
	const state = { isConnected: true, output: ['Hello', 'World'] };
	const computed = { outputText: 'Hello\nWorld' };

	render(TerminalDisplay, { state, computed });

	expect(screen.getByText('Hello\nWorld')).toBeInTheDocument();
});
```

### 6. Performance Considerations

#### Optimization Strategies

**1. Lazy Loading Components:**

```javascript
// Dynamic imports for heavy components
const TerminalDisplay = lazy(() => import('./TerminalDisplay.svelte'));
```

**2. Derived State Optimization:**

```javascript
// Memoized computed properties
#expensiveComputation = $derived.by(() => {
  if (!this.#terminalState.output.length) return '';
  return this.#terminalState.output
    .filter(line => line.trim())
    .join('\n');
});
```

**3. Virtual Scrolling for Terminal Output:**

```javascript
// Virtual list for large terminal output
import { VirtualList } from '@sveltejs/svelte-virtual-list';

// In TerminalDisplay.svelte
<VirtualList items={outputLines} let:item>
	<div class="terminal-line">{item.text}</div>
</VirtualList>;
```

**4. WebSocket Message Batching:**

```javascript
// Batch rapid terminal output updates
class TerminalViewModel {
	#outputBuffer = [];
	#batchTimer = null;

	addOutput(data) {
		this.#outputBuffer.push(data);

		if (!this.#batchTimer) {
			this.#batchTimer = setTimeout(() => {
				this.#terminalState.output.push(...this.#outputBuffer);
				this.#outputBuffer = [];
				this.#batchTimer = null;
			}, 16); // 60fps
		}
	}
}
```

### 7. Implementation Guidelines

#### Development Phases

**Phase 1: Foundation (Week 1)**

- Implement BaseModel and BaseViewModel classes
- Create service registry and base services
- Set up new directory structure

**Phase 2: Core Components (Week 2)**

- Migrate Terminal component to MVVM
- Implement TerminalViewModel and TerminalService
- Update terminal-related contexts

**Phase 3: Auxiliary Components (Week 3)**

- Migrate Chat and Project components
- Implement respective ViewModels and Services
- Update routing and navigation

**Phase 4: Integration & Testing (Week 4)**

- Complete integration testing
- Performance optimization
- Legacy code removal
- Documentation updates

#### Code Standards

**Naming Conventions:**

- Models: `*Model.js` (PascalCase classes)
- ViewModels: `*ViewModel.js` (PascalCase classes)
- Services: `*Service.js` (PascalCase classes)
- Components: `*.svelte` (PascalCase files, kebab-case props)
- Contexts: `*Context.svelte.js` (PascalCase)

**File Organization:**

- Group by feature, not by file type
- Keep related components together
- Separate container and presentation components
- Use index.js files for clean imports

**State Management Rules:**

- Use `$state` for component-local state
- Use `$derived` for computed values
- Use contexts for cross-component state
- Use ViewModels for complex UI state logic

**Testing Requirements:**

- Unit tests for all Models and ViewModels
- Component tests for all presentation components
- Integration tests for complete workflows
- E2E tests for critical user paths

## External Dependencies

### New Dependencies

```json
{
	"joi": "^17.9.0", // Model validation
	"@testing-library/svelte": "^4.0.0", // Component testing
	"vitest": "^1.0.0", // Unit testing
	"@sveltejs/svelte-virtual-list": "^3.0.0" // Virtual scrolling
}
```

### Updated Dependencies

- Svelte 5 (already in use)
- SvelteKit (current version compatible)
- Socket.IO client (maintain current version)

## Migration Strategy

1. **Parallel Development**: Build new architecture alongside existing code
2. **Feature Flags**: Use feature toggles to switch between old/new implementations
3. **Incremental Rollout**: Migrate one component at a time
4. **Backwards Compatibility**: Maintain existing API contracts during transition
5. **Performance Monitoring**: Track performance metrics throughout migration
6. **User Testing**: Validate each migrated component with user feedback
