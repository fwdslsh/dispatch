# MVVM Patterns in Dispatch

**Last Updated**: 2025-10-01
**Audience**: Contributors, developers extending Dispatch

## Overview

Dispatch uses the **Model-View-ViewModel (MVVM)** architectural pattern with Svelte 5's reactive runes to create maintainable, testable frontend components. This document explains our approach, when to use it, and common pitfalls to avoid.

## What is Runes-in-Classes Pattern?

The "runes-in-classes" pattern combines:

- **Svelte 5 runes** (`$state`, `$derived`, `$effect`) for reactivity
- **JavaScript classes** for organizing business logic
- **Component composition** for UI presentation

### Example: Basic ViewModel

```javascript
// src/lib/client/shared/state/ExampleViewModel.svelte.js
export class ExampleViewModel {
	// Reactive state using $state rune
	items = $state([]);
	loading = $state(false);
	error = $state(null);

	// Derived/computed values using $derived
	itemCount = $derived.by(() => this.items.length);
	hasItems = $derived.by(() => this.items.length > 0);

	// Methods for business logic
	async loadItems() {
		this.loading = true;
		this.error = null;

		try {
			const response = await fetch('/api/items');
			this.items = await response.json();
		} catch (err) {
			this.error = err.message;
		} finally {
			this.loading = false;
		}
	}

	addItem(item) {
		this.items = [...this.items, item];
	}

	removeItem(id) {
		this.items = this.items.filter((item) => item.id !== id);
	}
}
```

### Using the ViewModel in a Component

```svelte
<script>
	import { ExampleViewModel } from './ExampleViewModel.svelte.js';

	// Instantiate ViewModel
	const viewModel = new ExampleViewModel();

	// Optionally load data on mount
	$effect(() => {
		viewModel.loadItems();
	});
</script>

<div>
	{#if viewModel.loading}
		<p>Loading...</p>
	{:else if viewModel.error}
		<p class="error">{viewModel.error}</p>
	{:else if viewModel.hasItems}
		<ul>
			{#each viewModel.items as item}
				<li>
					{item.name}
					<button onclick={() => viewModel.removeItem(item.id)}>Remove</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p>No items found</p>
	{/if}

	<button onclick={() => viewModel.addItem({ id: Date.now(), name: 'New Item' })}>
		Add Item
	</button>
</div>
```

## Why We Use Runes-in-Classes

### Trade-offs Considered

**Advantages**:

1. **Encapsulation**: Business logic separated from UI rendering
2. **Testability**: ViewModels can be unit tested independently
3. **Reusability**: Same ViewModel can power multiple views
4. **Type Safety**: Classes provide structure for TypeScript/JSDoc
5. **Debugging**: Easier to trace state changes in class methods

**Trade-offs**:

- More verbose than inline reactive statements
- Requires understanding of both Svelte runes AND class patterns
- Can lead to over-engineering for simple components

**Decision**: We use this pattern for **complex state management** where the benefits outweigh the verbosity.

## When to Use What

### Use ViewModel Classes When:

- ✅ Component has complex business logic (> 50 lines)
- ✅ State needs to be shared across multiple components
- ✅ Logic requires unit testing independent of UI
- ✅ Component needs lifecycle management (loading, error states, etc.)

**Examples**: `SessionViewModel`, `WorkspaceNavigationViewModel`, `OnboardingViewModel`

### Use Inline Reactive Statements When:

- ✅ Component is simple (< 50 lines total)
- ✅ Logic is UI-specific (animations, focus management)
- ✅ State is local to a single component
- ✅ Rapid prototyping

**Examples**: Simple form inputs, toggle buttons, modal dialogs

### Use Service Modules (Not Classes) When:

- ✅ No reactive state needed (pure API clients)
- ✅ Singleton behavior required
- ✅ Shared utilities across app

**Examples**: `SessionApiClient`, `SocketService`, utility functions

## How to Implement a ViewModel

### Step-by-Step Guide

#### 1. Create the ViewModel File

File naming convention: `{Feature}ViewModel.svelte.js`

```javascript
// src/lib/client/workspace/WorkspaceViewModel.svelte.js
export class WorkspaceViewModel {
	// Start with state properties
}
```

#### 2. Define Reactive State

```javascript
export class WorkspaceViewModel {
	// Reactive state (use $state for mutable data)
	workspaces = $state([]);
	selectedWorkspace = $state(null);
	loading = $state(false);
	error = $state(null);
}
```

#### 3. Add Derived/Computed Properties

```javascript
export class WorkspaceViewModel {
	workspaces = $state([]);
	selectedWorkspace = $state(null);
	loading = $state(false);
	error = $state(null);

	// Derived values (automatically recompute)
	activeWorkspaces = $derived.by(() => this.workspaces.filter((w) => w.status === 'active'));

	hasSelection = $derived.by(() => this.selectedWorkspace !== null);
}
```

#### 4. Implement Business Logic Methods

```javascript
export class WorkspaceViewModel {
	// ... state and derived properties ...

	constructor(apiClient) {
		this.apiClient = apiClient;
	}

	async loadWorkspaces() {
		this.loading = true;
		this.error = null;

		try {
			const data = await this.apiClient.getWorkspaces();
			this.workspaces = data.workspaces;
		} catch (err) {
			this.error = err.message;
		} finally {
			this.loading = false;
		}
	}

	selectWorkspace(workspace) {
		this.selectedWorkspace = workspace;
	}

	async createWorkspace(name, path) {
		try {
			const newWorkspace = await this.apiClient.createWorkspace({ name, path });
			this.workspaces = [...this.workspaces, newWorkspace];
			return { success: true, workspace: newWorkspace };
		} catch (err) {
			return { success: false, error: err.message };
		}
	}
}
```

#### 5. Wire to Component

```svelte
<script>
	import { getContext } from 'svelte';
	import { WorkspaceViewModel } from './WorkspaceViewModel.svelte.js';

	// Get dependencies from context
	const services = getContext('services');
	const apiClient = services.get('apiClient');

	// Instantiate ViewModel
	const viewModel = new WorkspaceViewModel(apiClient);

	// Load data on mount
	$effect(() => {
		viewModel.loadWorkspaces();
	});
</script>

<!-- UI uses viewModel properties -->
<div>
	{#if viewModel.loading}
		<p>Loading workspaces...</p>
	{:else if viewModel.error}
		<p class="error">{viewModel.error}</p>
	{:else}
		<ul>
			{#each viewModel.activeWorkspaces as workspace}
				<li>
					<button onclick={() => viewModel.selectWorkspace(workspace)}>
						{workspace.name}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
```

## Common Pitfalls

### 1. **Not Using $state for Reactive Properties**

❌ **Wrong**:

```javascript
export class ViewModel {
	items = []; // Not reactive!
}
```

✅ **Correct**:

```javascript
export class ViewModel {
	items = $state([]); // Reactive
}
```

### 2. **Mutating Arrays/Objects Directly**

❌ **Wrong**:

```javascript
addItem(item) {
	this.items.push(item); // Doesn't trigger reactivity
}
```

✅ **Correct**:

```javascript
addItem(item) {
	this.items = [...this.items, item]; // Creates new array, triggers reactivity
}
```

### 3. **Overusing $effect for Data Loading**

❌ **Wrong** (runs on every state change):

```javascript
$effect(() => {
	viewModel.loadData(); // Infinite loop if loadData updates state!
});
```

✅ **Correct** (explicit control):

```javascript
// In component
onMount(() => {
	viewModel.loadData();
});

// OR with explicit dependency
$effect(() => {
	if (someCondition) {
		viewModel.loadData();
	}
});
```

### 4. **Circular Dependencies Between ViewModels**

❌ **Wrong**:

```javascript
// ViewModel A depends on ViewModel B
// ViewModel B depends on ViewModel A
// = Circular dependency
```

✅ **Correct**: Use shared state or event bus pattern

### 5. **Not Cleaning Up Resources**

❌ **Wrong**:

```javascript
export class ViewModel {
	constructor() {
		setInterval(() => this.poll(), 1000); // Never cleaned up!
	}
}
```

✅ **Correct**:

```javascript
export class ViewModel {
	intervalId = null;

	startPolling() {
		this.intervalId = setInterval(() => this.poll(), 1000);
	}

	stopPolling() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}
}

// In component:
onDestroy(() => {
	viewModel.stopPolling();
});
```

## Testing ViewModels

ViewModels can be unit tested independently:

```javascript
// ExampleViewModel.test.js
import { describe, it, expect, vi } from 'vitest';
import { ExampleViewModel } from './ExampleViewModel.svelte.js';

describe('ExampleViewModel', () => {
	it('should load items successfully', async () => {
		const mockApiClient = {
			getItems: vi.fn().mockResolvedValue([{ id: 1, name: 'Item 1' }])
		};

		const viewModel = new ExampleViewModel(mockApiClient);
		await viewModel.loadItems();

		expect(viewModel.items.length).toBe(1);
		expect(viewModel.loading).toBe(false);
		expect(viewModel.error).toBe(null);
	});

	it('should handle errors gracefully', async () => {
		const mockApiClient = {
			getItems: vi.fn().mockRejectedValue(new Error('Network error'))
		};

		const viewModel = new ExampleViewModel(mockApiClient);
		await viewModel.loadItems();

		expect(viewModel.items.length).toBe(0);
		expect(viewModel.error).toBe('Network error');
	});
});
```

## Real-World Examples in Dispatch

### SessionViewModel

Location: `src/lib/client/shared/state/SessionViewModel.svelte.js`

**Purpose**: Manages session lifecycle (create, attach, detach, close)
**Complexity**: High (handles WebSocket reconnection, event replay, multi-tab sync)
**Why ViewModel**: Complex state machine with async operations

### WorkspaceNavigationViewModel

Location: `src/lib/client/shared/state/WorkspaceNavigationViewModel.svelte.js`

**Purpose**: Manages workspace selection and navigation
**Complexity**: Medium (filters, search, metadata)
**Why ViewModel**: Shared state across multiple UI panels

### OnboardingViewModel

Location: `src/lib/client/shared/state/OnboardingViewModel.svelte.js`

**Purpose**: Multi-step onboarding workflow
**Complexity**: Medium (progress tracking, validation)
**Why ViewModel**: Testable step transitions and validation logic

## Resources

- [Svelte 5 Runes Documentation](https://svelte.dev/docs/svelte/$state)
- [MVVM Pattern Overview](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93viewmodel)
- Dispatch codebase examples: Search for `*.svelte.js` files

## Questions?

If you're unsure whether to use a ViewModel for your component, ask:

1. Is the component > 50 lines of logic?
2. Will the logic be reused or tested independently?
3. Does it manage complex async state?

If you answered "yes" to 2+, use a ViewModel. Otherwise, keep it simple with inline reactivity.
