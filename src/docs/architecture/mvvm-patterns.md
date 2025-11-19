# MVVM Patterns in Dispatch

**Last Updated**: 2025-11-19
**Audience**: Developers working with Svelte 5 and the Dispatch MVVM architecture

This guide provides comprehensive patterns, best practices, and anti-patterns for implementing the Model-View-ViewModel (MVVM) architecture in Dispatch using Svelte 5 runes.

## Table of Contents

1. [Overview](#overview)
2. [The Runes-in-Classes Pattern](#the-runes-in-classes-pattern)
3. [When to Use ViewModels vs Simple Modules](#when-to-use-viewmodels-vs-simple-modules)
4. [State Management with Runes](#state-management-with-runes)
5. [Separation of Concerns](#separation-of-concerns)
6. [ServiceContainer Patterns](#servicecontainer-patterns)
7. [Common Anti-Patterns](#common-anti-patterns)
8. [Testing Strategies](#testing-strategies)
9. [Decision Trees](#decision-trees)
10. [Examples](#examples)

---

## Overview

### What is MVVM?

MVVM (Model-View-ViewModel) is an architectural pattern that separates:

- **Model**: Data and business logic (Services, Repositories, API clients)
- **View**: UI components (Svelte components)
- **ViewModel**: Presentation logic and state (Classes with Svelte 5 runes)

### Why MVVM in Dispatch?

1. **Testability**: ViewModels can be unit tested without rendering components
2. **Reusability**: ViewModels can be shared across multiple views
3. **Separation**: Clear boundaries between UI, state, and business logic
4. **Maintainability**: Changes to one layer don't ripple through others

### Architecture Overview

```
┌─────────────┐
│    View     │  Svelte components (.svelte files)
│  (UI Layer) │  - Renders UI based on ViewModel state
└──────┬──────┘  - Calls ViewModel methods on user actions
       │
       │ observes state, calls methods
       │
┌──────▼──────┐
│  ViewModel  │  Classes with $state runes (.svelte.js files)
│   (State)   │  - Manages presentation state
└──────┬──────┘  - Coordinates service calls
       │          - Transforms data for display
       │
       │ calls
       │
┌──────▼──────┐
│   Service   │  Business logic (.js files)
│  (Model)    │  - API calls, data persistence
└─────────────┘  - Business rules, validations
```

---

## The Runes-in-Classes Pattern

### Core Concept

Svelte 5 runes (`$state`, `$derived`, `$effect`) work inside class instances, enabling reactive state management with object-oriented patterns.

### Basic ViewModel Structure

```javascript
// src/lib/client/shared/state/ExampleViewModel.svelte.js

/**
 * ExampleViewModel - Manages state for Example feature
 *
 * Usage:
 *   const viewModel = new ExampleViewModel(serviceContainer);
 *   viewModel.items; // reactive state
 *   viewModel.filteredItems; // derived state
 *   await viewModel.loadItems(); // async operation
 */
export class ExampleViewModel {
	// Reactive state
	items = $state([]);
	loading = $state(false);
	error = $state(null);
	searchQuery = $state('');

	// Derived state
	filteredItems = $derived.by(() => {
		if (!this.searchQuery) return this.items;
		return this.items.filter(item =>
			item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
		);
	});

	// Computed properties (alternative to $derived for simple cases)
	get isEmpty() {
		return this.items.length === 0;
	}

	get itemCount() {
		return this.filteredItems.length;
	}

	constructor(serviceContainer) {
		this.service = serviceContainer.get('exampleService');
	}

	// Methods that modify state
	async loadItems() {
		this.loading = true;
		this.error = null;

		try {
			this.items = await this.service.fetchItems();
		} catch (err) {
			this.error = err.message;
			logger.error('EXAMPLE_VM', 'Failed to load items', err);
		} finally {
			this.loading = false;
		}
	}

	async addItem(name) {
		try {
			const newItem = await this.service.createItem({ name });
			this.items = [...this.items, newItem];
			return newItem;
		} catch (err) {
			this.error = `Failed to create item: ${err.message}`;
			logger.error('EXAMPLE_VM', 'Failed to create item', err);
			return null;
		}
	}

	setSearchQuery(query) {
		this.searchQuery = query;
	}

	clearError() {
		this.error = null;
	}
}
```

### Using the ViewModel in a Component

```svelte
<!-- src/lib/client/shared/components/ExampleList.svelte -->
<script>
	import { onMount } from 'svelte';
	import { ExampleViewModel } from '../state/ExampleViewModel.svelte.js';
	import { useServiceContainer } from '../services/ServiceContainer.svelte.js';

	const container = useServiceContainer();
	const viewModel = new ExampleViewModel(container);

	onMount(async () => {
		await viewModel.loadItems();
	});

	let newItemName = $state('');

	async function handleAddItem() {
		const item = await viewModel.addItem(newItemName);
		if (item) {
			newItemName = '';
		}
	}
</script>

{#if viewModel.loading}
	<p>Loading...</p>
{:else if viewModel.error}
	<div class="error">
		{viewModel.error}
		<button onclick={() => viewModel.clearError()}>Dismiss</button>
	</div>
{:else if viewModel.isEmpty}
	<p>No items found</p>
{:else}
	<input
		type="text"
		bind:value={viewModel.searchQuery}
		placeholder="Search..."
	/>
	<p>Showing {viewModel.itemCount} items</p>
	<ul>
		{#each viewModel.filteredItems as item (item.id)}
			<li>{item.name}</li>
		{/each}
	</ul>
{/if}

<form onsubmit|preventDefault={handleAddItem}>
	<input bind:value={newItemName} placeholder="New item name" />
	<button type="submit">Add Item</button>
</form>
```

---

## When to Use ViewModels vs Simple Modules

### Use ViewModel Classes When:

✅ You need **reactive state** that multiple components observe
✅ You have **complex presentation logic** (filtering, sorting, transformations)
✅ You need to **coordinate multiple services**
✅ State has a **lifecycle** (initialization, cleanup)
✅ You want to **unit test** presentation logic separately from UI

**Example**: `SessionViewModel`, `AuthViewModel`, `WorkspaceState`

### Use Simple Module/Service When:

✅ Pure **business logic** without presentation state
✅ **Stateless utilities** (formatters, validators, converters)
✅ **API clients** that just wrap fetch calls
✅ **Singleton services** that don't need reactive state

**Example**: `SessionApiClient`, `logger`, `formatDate()`

### Decision Tree

```
Does it manage UI state?
├─ No → Use Service/Module
└─ Yes
    └─ Does it need reactivity?
        ├─ No → Use plain object with methods
        └─ Yes
            └─ Is it shared across components?
                ├─ No → Use component-level $state
                └─ Yes → Use ViewModel class
```

---

## State Management with Runes

### `$state` - Reactive State

Use for values that change and should trigger re-renders:

```javascript
export class CounterViewModel {
	count = $state(0);
	isEven = $state(true);

	increment() {
		this.count++;
		this.isEven = this.count % 2 === 0;
	}
}
```

**Best Practices:**
- Initialize with default values
- Keep state as flat as possible
- Use descriptive names (`isLoading` not `loading`)

### `$derived` - Simple Computed Values

Use for values computed from state (simple expressions):

```javascript
export class UserViewModel {
	firstName = $state('John');
	lastName = $state('Doe');

	// Simple derived state
	fullName = $derived(`${this.firstName} ${this.lastName}`);
	initials = $derived(`${this.firstName[0]}${this.lastName[0]}`);
}
```

### `$derived.by()` - Complex Computed Values

Use for values that require complex logic, loops, or conditionals:

```javascript
export class TaskViewModel {
	tasks = $state([]);
	filter = $state('all'); // 'all' | 'active' | 'completed'

	filteredTasks = $derived.by(() => {
		if (this.filter === 'all') return this.tasks;
		if (this.filter === 'active') {
			return this.tasks.filter(t => !t.completed);
		}
		return this.tasks.filter(t => t.completed);
	});

	stats = $derived.by(() => {
		const total = this.tasks.length;
		const completed = this.tasks.filter(t => t.completed).length;
		const active = total - completed;
		return { total, completed, active };
	});
}
```

**When to use `$derived.by()`:**
- Complex filtering/mapping operations
- Multiple conditionals
- Loop-based computations
- Object construction

### `$effect` - Side Effects

**IMPORTANT**: Use `$effect` ONLY for side effects that react to state changes, NOT for initialization.

```javascript
export class LoggerViewModel {
	logLevel = $state('info');
	messages = $state([]);

	constructor() {
		// ✅ Good: React to state changes
		$effect(() => {
			console.log(`Log level changed to: ${this.logLevel}`);
			this.updateLoggerConfig(this.logLevel);
		});

		// ❌ Bad: Use onMount in component instead
		// $effect(() => {
		//     this.loadMessages();
		// });
	}
}
```

**Use `$effect` for:**
- Syncing with localStorage
- Updating external systems when state changes
- Logging state changes
- Setting up event listeners

**Do NOT use `$effect` for:**
- Initial data loading (use `onMount` in component)
- One-time setup (use constructor)
- Calling methods (call them directly)

---

## Separation of Concerns

### The Three Layers

#### 1. View Layer (Svelte Components)

**Responsibilities:**
- Render UI based on ViewModel state
- Handle user interactions
- Lifecycle management (onMount, onDestroy)

**Should NOT:**
- Make API calls directly
- Contain business logic
- Manipulate DOM directly (except refs for libraries)
- Access services directly (use ViewModel)

```svelte
<!-- ✅ Good: View delegates to ViewModel -->
<script>
	import { ExampleViewModel } from './ExampleViewModel.svelte.js';

	const viewModel = new ExampleViewModel();

	function handleClick() {
		viewModel.performAction(); // Delegate to ViewModel
	}
</script>

<button onclick={handleClick}>
	{viewModel.buttonLabel}
</button>

<!-- ❌ Bad: Business logic in View -->
<script>
	import { exampleService } from './services.js';

	let data = $state([]);

	async function handleClick() {
		const response = await exampleService.fetchData();
		data = response.items.filter(i => i.active).map(i => ({
			...i,
			displayName: `${i.firstName} ${i.lastName}`
		}));
	}
</script>
```

#### 2. ViewModel Layer (Classes with Runes)

**Responsibilities:**
- Manage presentation state
- Transform data for display
- Coordinate service calls
- Handle presentation logic

**Should NOT:**
- Make HTTP requests (use Service)
- Know about DOM or browser APIs
- Throw errors (set error state instead)

```javascript
// ✅ Good: ViewModel coordinates and transforms
export class UserListViewModel {
	users = $state([]);
	sortBy = $state('name');

	displayUsers = $derived.by(() => {
		return this.users
			.filter(u => u.active)
			.sort((a, b) => a[this.sortBy].localeCompare(b[this.sortBy]))
			.map(u => ({
				...u,
				displayName: `${u.firstName} ${u.lastName}`
			}));
	});

	constructor(userService) {
		this.userService = userService;
	}

	async loadUsers() {
		try {
			this.users = await this.userService.fetchUsers();
		} catch (err) {
			this.error = 'Failed to load users';
		}
	}
}

// ❌ Bad: ViewModel makes HTTP calls
export class UserListViewModel {
	async loadUsers() {
		const response = await fetch('/api/users');
		this.users = await response.json();
	}
}
```

#### 3. Model/Service Layer (Plain Classes/Modules)

**Responsibilities:**
- API communication
- Data persistence
- Business rules and validations
- Domain logic

**Should NOT:**
- Know about ViewModels or UI
- Manage reactive state (use plain values)

```javascript
// ✅ Good: Service handles API and business logic
export class UserService {
	constructor(apiClient) {
		this.api = apiClient;
	}

	async fetchUsers() {
		const response = await this.api.get('/users');
		return response.users;
	}

	async createUser(userData) {
		// Validation (business logic)
		if (!userData.email || !userData.name) {
			throw new Error('Email and name are required');
		}

		// API call
		return await this.api.post('/users', userData);
	}
}
```

### Communication Flow

```
User Action
    ↓
View catches event
    ↓
Calls ViewModel method
    ↓
ViewModel updates state, calls Service
    ↓
Service performs business logic/API call
    ↓
Returns data to ViewModel
    ↓
ViewModel updates state
    ↓
View automatically re-renders
```

---

## ServiceContainer Patterns

### Overview

The ServiceContainer provides dependency injection for shared services across the application.

### Basic Usage

```javascript
// In a ViewModel
import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';

export class MyViewModel {
	constructor() {
		const container = useServiceContainer();
		this.sessionApi = container.get('sessionApi');
		this.settingsService = container.get('settingsService');
	}
}
```

### Injection Patterns

#### Pattern 1: Constructor Injection (Recommended)

```javascript
export class UserViewModel {
	constructor(serviceContainer) {
		this.userService = serviceContainer.get('userService');
		this.authService = serviceContainer.get('authService');
	}
}

// In component:
const container = useServiceContainer();
const viewModel = new UserViewModel(container);
```

**Pros:**
- Explicit dependencies
- Easy to test (mock container)
- Clear initialization

#### Pattern 2: Lazy Service Access

```javascript
export class UserViewModel {
	#container;

	constructor(serviceContainer) {
		this.#container = serviceContainer;
	}

	async loadData() {
		// Get service only when needed
		const service = this.#container.get('userService');
		this.users = await service.fetchUsers();
	}
}
```

**Pros:**
- Deferred loading
- Reduces initialization cost

**Cons:**
- Hidden dependencies
- Harder to track what's used

### Testing with ServiceContainer

```javascript
import { describe, it, expect, vi } from 'vitest';
import { createTestContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
import { UserViewModel } from './UserViewModel.svelte.js';

describe('UserViewModel', () => {
	it('should load users from service', async () => {
		// Create mock service
		const mockUserService = {
			fetchUsers: vi.fn().mockResolvedValue([
				{ id: 1, name: 'Alice' },
				{ id: 2, name: 'Bob' }
			])
		};

		// Create test container with mocks
		const container = createTestContainer({
			userService: mockUserService
		});

		// Create ViewModel with test container
		const viewModel = new UserViewModel(container);
		await viewModel.loadUsers();

		expect(viewModel.users).toHaveLength(2);
		expect(mockUserService.fetchUsers).toHaveBeenCalledOnce();
	});
});
```

---

## Common Anti-Patterns

### ❌ Anti-Pattern 1: Business Logic in View

```svelte
<!-- BAD: Component has business logic -->
<script>
	import { sessionApi } from './services.js';

	let sessions = $state([]);

	async function createSession(type) {
		const workspace = settingsService.get('defaultWorkspace');
		const settings = type === 'claude'
			? { model: 'sonnet', apiKey: localStorage.getItem('key') }
			: { shell: '/bin/bash' };

		const session = await sessionApi.create({ type, workspace, options: settings });
		sessions = [...sessions, session];
	}
</script>
```

**✅ Solution: Move to ViewModel**

```javascript
// GOOD: ViewModel has business logic
export class SessionViewModel {
	sessions = $state([]);

	constructor(sessionApi, settingsService) {
		this.sessionApi = sessionApi;
		this.settingsService = settingsService;
	}

	async createSession(type) {
		const workspace = this.settingsService.get('defaultWorkspace');
		const settings = this.getDefaultSettings(type);

		const session = await this.sessionApi.create({
			type,
			workspace,
			options: settings
		});

		this.sessions = [...this.sessions, session];
		return session;
	}

	getDefaultSettings(type) {
		if (type === 'claude') {
			return {
				model: this.settingsService.get('claude.model'),
				apiKey: this.settingsService.get('claude.apiKey')
			};
		}
		return {
			shell: this.settingsService.get('terminal.shell')
		};
	}
}
```

### ❌ Anti-Pattern 2: Direct Service Access in Components

```svelte
<!-- BAD: Component imports service directly -->
<script>
	import { settingsService } from '$lib/client/shared/services/SettingsService.svelte.js';

	let defaultWorkspace = $state('');

	onMount(() => {
		defaultWorkspace = settingsService.get('global.defaultWorkspace');
	});
</script>
```

**✅ Solution: Access via ViewModel**

```javascript
// GOOD: ViewModel wraps service access
export class WorkspaceViewModel {
	constructor(settingsService) {
		this.settingsService = settingsService;
	}

	getDefaultWorkspace() {
		return this.settingsService.get('global.defaultWorkspace');
	}
}
```

### ❌ Anti-Pattern 3: DOM Manipulation in ViewModel

```javascript
// BAD: ViewModel has DOM reference
export class ChatViewModel {
	messagesContainer = null;

	async sendMessage(text) {
		this.messages = [...this.messages, { text }];

		// ❌ DOM manipulation in ViewModel
		await tick();
		if (this.messagesContainer) {
			this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
		}
	}
}
```

**✅ Solution: Use Signal Pattern**

```javascript
// GOOD: ViewModel signals View to scroll
export class ChatViewModel {
	messages = $state([]);
	shouldScrollToBottom = $state(false);

	async sendMessage(text) {
		this.messages = [...this.messages, { text }];
		this.shouldScrollToBottom = true; // Signal
	}
}
```

```svelte
<!-- View handles DOM -->
<script>
	let messagesContainer;

	$effect(() => {
		if (viewModel.shouldScrollToBottom && messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
			viewModel.shouldScrollToBottom = false; // Reset signal
		}
	});
</script>

<div bind:this={messagesContainer}>
	{#each viewModel.messages as message}
		<div>{message.text}</div>
	{/each}
</div>
```

### ❌ Anti-Pattern 4: Using `$effect` for Initialization

```javascript
// BAD: Using $effect for one-time initialization
export class DataViewModel {
	data = $state([]);

	constructor() {
		$effect(() => {
			this.loadData(); // Runs on every state change!
		});
	}
}
```

**✅ Solution: Use onMount in Component**

```svelte
<!-- GOOD: Use onMount for initialization -->
<script>
	import { onMount } from 'svelte';

	const viewModel = new DataViewModel();

	onMount(async () => {
		await viewModel.loadData();
	});
</script>
```

### ❌ Anti-Pattern 5: Throwing Errors from ViewModel

```javascript
// BAD: ViewModel throws errors
export class UserViewModel {
	async deleteUser(id) {
		const result = await this.userService.delete(id);
		if (!result.success) {
			throw new Error('Failed to delete user'); // View has to catch
		}
	}
}
```

**✅ Solution: Set Error State**

```javascript
// GOOD: ViewModel sets error state
export class UserViewModel {
	error = $state(null);

	async deleteUser(id) {
		this.error = null;
		try {
			await this.userService.delete(id);
			return true;
		} catch (err) {
			this.error = `Failed to delete user: ${err.message}`;
			logger.error('USER_VM', 'Delete failed', err);
			return false;
		}
	}
}
```

---

## Testing Strategies

### Unit Testing ViewModels

ViewModels are highly testable because they don't depend on the DOM:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskViewModel } from './TaskViewModel.svelte.js';

describe('TaskViewModel', () => {
	let viewModel;
	let mockService;

	beforeEach(() => {
		mockService = {
			fetchTasks: vi.fn(),
			createTask: vi.fn(),
			deleteTask: vi.fn()
		};

		viewModel = new TaskViewModel(mockService);
	});

	describe('loadTasks', () => {
		it('should set loading state during fetch', async () => {
			mockService.fetchTasks.mockImplementation(
				() => new Promise(resolve => setTimeout(() => resolve([]), 100))
			);

			const promise = viewModel.loadTasks();
			expect(viewModel.loading).toBe(true);

			await promise;
			expect(viewModel.loading).toBe(false);
		});

		it('should populate tasks on success', async () => {
			const mockTasks = [
				{ id: 1, title: 'Task 1' },
				{ id: 2, title: 'Task 2' }
			];
			mockService.fetchTasks.mockResolvedValue(mockTasks);

			await viewModel.loadTasks();

			expect(viewModel.tasks).toEqual(mockTasks);
			expect(viewModel.error).toBeNull();
		});

		it('should set error state on failure', async () => {
			mockService.fetchTasks.mockRejectedValue(new Error('Network error'));

			await viewModel.loadTasks();

			expect(viewModel.tasks).toEqual([]);
			expect(viewModel.error).toBeTruthy();
		});
	});

	describe('filteredTasks', () => {
		beforeEach(() => {
			viewModel.tasks = [
				{ id: 1, title: 'Buy milk', completed: false },
				{ id: 2, title: 'Walk dog', completed: true },
				{ id: 3, title: 'Write code', completed: false }
			];
		});

		it('should show all tasks when filter is "all"', () => {
			viewModel.filter = 'all';
			expect(viewModel.filteredTasks).toHaveLength(3);
		});

		it('should show only active tasks when filter is "active"', () => {
			viewModel.filter = 'active';
			expect(viewModel.filteredTasks).toHaveLength(2);
			expect(viewModel.filteredTasks.every(t => !t.completed)).toBe(true);
		});

		it('should show only completed tasks when filter is "completed"', () => {
			viewModel.filter = 'completed';
			expect(viewModel.filteredTasks).toHaveLength(1);
			expect(viewModel.filteredTasks[0].title).toBe('Walk dog');
		});
	});
});
```

### Testing Components with ViewModels

```javascript
import { render, screen } from '@testing-library/svelte';
import { vi } from 'vitest';
import TaskList from './TaskList.svelte';
import { createTestContainer } from '../services/ServiceContainer.svelte.js';

describe('TaskList Component', () => {
	it('should display loading state', () => {
		const mockService = {
			fetchTasks: vi.fn().mockImplementation(
				() => new Promise(() => {}) // Never resolves
			)
		};

		const container = createTestContainer({ taskService: mockService });
		render(TaskList, { props: { serviceContainer: container } });

		expect(screen.getByText('Loading...')).toBeInTheDocument();
	});

	it('should display tasks after loading', async () => {
		const mockService = {
			fetchTasks: vi.fn().mockResolvedValue([
				{ id: 1, title: 'Task 1', completed: false },
				{ id: 2, title: 'Task 2', completed: true }
			])
		};

		const container = createTestContainer({ taskService: mockService });
		render(TaskList, { props: { serviceContainer: container } });

		await screen.findByText('Task 1');
		expect(screen.getByText('Task 2')).toBeInTheDocument();
	});
});
```

---

## Decision Trees

### Should I Create a ViewModel?

```
Is this a Svelte component?
├─ No → It's a Service/Utility
└─ Yes
    └─ Does it have state beyond props?
        ├─ No → Keep it a simple component
        └─ Yes
            └─ Is the state complex or shared?
                ├─ No → Use component-level $state
                └─ Yes
                    └─ Does it coordinate multiple services?
                        ├─ No → Consider a simple reactive module
                        └─ Yes → Create a ViewModel class
```

### Where Does This Logic Belong?

```
What type of logic is it?

├─ UI Rendering / Event Handling
│  └─ View Component

├─ Data Transformation / Filtering / Sorting
│  └─ ViewModel

├─ API Calls / Data Persistence
│  └─ Service

├─ Validation / Business Rules
│  └─ Service or Model

└─ Formatting / Parsing
   └─ Utility Function
```

### How Should I Structure State?

```
Does the state need to be reactive?
├─ No → Use regular class properties or const
└─ Yes
    └─ Is it derived from other state?
        ├─ No → Use $state()
        └─ Yes
            └─ Is the derivation simple (one line)?
                ├─ Yes → Use $derived
                └─ No → Use $derived.by(() => {...})
```

---

## Examples

### Example 1: Simple List ViewModel

```javascript
// src/lib/client/features/todos/TodoListViewModel.svelte.js

export class TodoListViewModel {
	todos = $state([]);
	filter = $state('all');
	newTodoText = $state('');

	filteredTodos = $derived.by(() => {
		if (this.filter === 'all') return this.todos;
		if (this.filter === 'active') return this.todos.filter(t => !t.completed);
		return this.todos.filter(t => t.completed);
	});

	get stats() {
		return {
			total: this.todos.length,
			active: this.todos.filter(t => !t.completed).length,
			completed: this.todos.filter(t => t.completed).length
		};
	}

	constructor(todoService) {
		this.todoService = todoService;
	}

	async loadTodos() {
		this.todos = await this.todoService.fetchAll();
	}

	async addTodo() {
		if (!this.newTodoText.trim()) return;

		const todo = await this.todoService.create({
			text: this.newTodoText,
			completed: false
		});

		this.todos = [...this.todos, todo];
		this.newTodoText = '';
	}

	async toggleTodo(id) {
		const todo = this.todos.find(t => t.id === id);
		if (!todo) return;

		await this.todoService.update(id, { completed: !todo.completed });
		this.todos = this.todos.map(t =>
			t.id === id ? { ...t, completed: !t.completed } : t
		);
	}

	setFilter(filter) {
		this.filter = filter;
	}
}
```

### Example 2: Form ViewModel with Validation

```javascript
// src/lib/client/features/users/UserFormViewModel.svelte.js

export class UserFormViewModel {
	// Form fields
	email = $state('');
	name = $state('');
	role = $state('user');

	// Form state
	submitting = $state(false);
	errors = $state({});

	// Validation
	isValid = $derived.by(() => {
		return this.email.trim().length > 0
			&& this.name.trim().length > 0
			&& Object.keys(this.errors).length === 0;
	});

	constructor(userService) {
		this.userService = userService;
	}

	validate() {
		const errors = {};

		if (!this.email.includes('@')) {
			errors.email = 'Invalid email address';
		}

		if (this.name.trim().length < 2) {
			errors.name = 'Name must be at least 2 characters';
		}

		this.errors = errors;
		return Object.keys(errors).length === 0;
	}

	async submit() {
		if (!this.validate()) return false;

		this.submitting = true;

		try {
			await this.userService.create({
				email: this.email,
				name: this.name,
				role: this.role
			});

			this.reset();
			return true;
		} catch (err) {
			this.errors = { submit: err.message };
			return false;
		} finally {
			this.submitting = false;
		}
	}

	reset() {
		this.email = '';
		this.name = '';
		this.role = 'user';
		this.errors = {};
	}
}
```

### Example 3: Complex Coordinator ViewModel

```javascript
// src/lib/client/features/workspace/WorkspaceViewModel.svelte.js

/**
 * WorkspaceViewModel - Coordinates workspace, sessions, and settings
 */
export class WorkspaceViewModel {
	// State from multiple sources
	currentWorkspace = $state(null);
	sessions = $state([]);
	settings = $state({});

	// UI state
	creating = $state(false);
	error = $state(null);

	// Computed state
	activeSessions = $derived(
		this.sessions.filter(s => s.status === 'running')
	);

	sessionsByType = $derived.by(() => {
		const grouped = {};
		for (const session of this.sessions) {
			if (!grouped[session.type]) {
				grouped[session.type] = [];
			}
			grouped[session.type].push(session);
		}
		return grouped;
	});

	constructor(workspaceService, sessionService, settingsService) {
		this.workspaceService = workspaceService;
		this.sessionService = sessionService;
		this.settingsService = settingsService;
	}

	async initialize(workspacePath) {
		this.currentWorkspace = await this.workspaceService.get(workspacePath);
		this.sessions = await this.sessionService.listByWorkspace(workspacePath);
		this.settings = await this.settingsService.getWorkspaceSettings(workspacePath);
	}

	async createSession(type) {
		this.creating = true;
		this.error = null;

		try {
			const defaults = this.getDefaultSettings(type);
			const session = await this.sessionService.create({
				type,
				workspacePath: this.currentWorkspace.path,
				options: defaults
			});

			this.sessions = [...this.sessions, session];
			return session;
		} catch (err) {
			this.error = `Failed to create session: ${err.message}`;
			return null;
		} finally {
			this.creating = false;
		}
	}

	getDefaultSettings(type) {
		const key = `${type}.defaults`;
		return this.settingsService.get(key, {});
	}
}
```

---

## Summary

### Key Takeaways

1. **Use ViewModels** for complex, reactive presentation logic
2. **Keep Views simple** - just render and delegate to ViewModels
3. **Services are stateless** - no runes, just business logic
4. **Runes work in classes** - `$state`, `$derived`, `$effect` all work
5. **Dependency injection** via ServiceContainer enables testability
6. **Set error state**, don't throw from ViewModels
7. **Use `onMount`** for initialization, not `$effect`
8. **Test ViewModels** without rendering components

### Quick Reference

```javascript
// ViewModel Template
export class MyViewModel {
	// State
	data = $state([]);
	loading = $state(false);
	error = $state(null);

	// Derived
	computed = $derived.by(() => {
		// Complex computation
	});

	// Constructor with DI
	constructor(serviceContainer) {
		this.service = serviceContainer.get('myService');
	}

	// Async operations
	async loadData() {
		this.loading = true;
		this.error = null;
		try {
			this.data = await this.service.fetch();
		} catch (err) {
			this.error = err.message;
		} finally {
			this.loading = false;
		}
	}
}
```

---

**Last Updated**: 2025-11-19
**Maintainer**: Dispatch Team
**Related Docs**: [Adapter Registration Guide](./adapter-guide.md), [Error Handling Guide](../contributing/error-handling.md)
