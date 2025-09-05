# Svelte 5 Style Guide (runes mode)

This style guide focuses on Svelte 5's runes-mode features and new API surface. It is based on the Svelte 5 reference material and emphasizes runes, component patterns, MVVM architecture, and API proxy/client objects.

Principles
- Prefer runes-based reactivity ($state, $derived, $effect, $props, $bindable, etc.) over manual stores or frameworks-specific helpers.
- Keep components declarative and small; favor composition and snippets over complex inheritance.
- Use MVVM (Model-View-ViewModel) for app structure. Views are `.svelte` components, ViewModels hold reactive runes and logic (can be `.svelte.js` modules), and Models are plain objects used by API client proxies.
- Expose side-effect boundaries: use `$effect` for DOM or third-party interactions; use `$derived` for pure computed values.
- Use API proxy/client objects for server communication and abstract fetch/transport in a thin client module.

Contract (tiny)
- Inputs: component props via `$props()` and bindables via `$bindable()`.
- Outputs: UI rendering and event callbacks; ViewModels expose functions and bindable state.
- Error modes: errors thrown in setup render phase are caught by error boundaries; runtime event handler errors are not caught.

Runes guidance

$state
- Always declare reassignable reactive state with `let`:

let count = $state(0);

- Prefer deep proxies for collections and objects. Avoid destructuring reactive objects if you need reactivity on properties.

// Avoid
let { done } = todos[0]; // breaks reactivity

// Preferred
let todos = $state([{ id: 1, done: false }]);

$derived
- Use `$derived` for pure computed values. For longer computations, prefer `$derived.by(() => ...)`.

let doubled = $derived(count * 2);
let total = $derived.by(() => numbers.reduce((s, n) => s + n, 0));

- Do not perform side-effects inside derived expressions.

$effect
- Use `$effect` for imperative work (DOM, subscriptions, timers, third-party lib integration).
- Avoid updating state inside `$effect` when it causes immediate cycles; use `$derived` or scheduled updates instead.
- Use `$effect.pre` for work that must run before DOM updates.

$props and $bindable
- Read props via `$props()` and destructure them for convenience. Use `$bindable()` for two-way binding.

let { value = $bindable(), label = 'Label' } = $props();

- Don't mutate non-bindable props directly; use bindable props or callbacks.

Other runes
- `$inspect` for dev-time introspection only.
- `$attach` for element-bound attachments that need cleanup.
- `$host` when building custom elements.

MVVM pattern and vertical-slice layout
- We use MVVM to separate concerns, and we organize code in vertical feature slices under `src/lib/` so Models, ViewModels and Views for a feature live together.
  - Model: plain JavaScript objects that define data shapes and business logic (documented with JSDoc).
  - ViewModel: `.svelte.js` modules that declare `$state`, `$derived`, and expose actions; written in plain JavaScript with JSDoc annotations. API clients are injected into ViewModel constructors.
  - View: `.svelte` component consuming the ViewModel via imports, props, or snippets.
  - API Client: classes that handle server communication, injected into ViewModel constructors. They take model objects as function parameters and return model objects from function calls.

Layout pattern (vertical slices)

Each feature lives under `src/lib/<feature>/` and contains the model, viewmodel, and components for that feature. Large features can use subfolders to further organize code. A shared folder holds global utilities and cross-cutting pieces.

Example layout

src/lib/
  shared/                # global utilities, base components, types (JSDoc), helpers
    components/
    utils/
    ApiClientBase.js
    ViewModelBase.js
  todos/                 # vertical slice for the "todos" feature
    model.js             # data shapes, plain objects, JSDoc types
    TodosApiClient.js    # API client class for this feature
    TodosViewModel.svelte.js    # ViewModel class using runes
    Todos.svelte         # View consuming ViewModel
    components/          # feature-specific subcomponents
  large-feature/         # large feature may use nested subfolders
    subfeatureA/
    subfeatureB/

ViewModel pattern
- A ViewModel exports runes-backed state and functions, with API clients injected via constructor:

```javascript
// Todos.svelte.js
/**
 * ViewModel for managing todos
 */
export class TodosViewModel {
  #todosApiClient;
  
  /**
   * @param {TodosApiClient} todosApiClient - Injected API client
   */
  constructor(todosApiClient) {
    this.#todosApiClient = todosApiClient;
    this.todos = $state([]);
    this.loading = $state(false);
  }

  /**
   * Load todos from the API
   * @returns {Promise<void>}
   */
  async load() {
    this.loading = true;
    try {
      this.todos = await this.#todosApiClient.fetchTodos();
    } finally {
      this.loading = false;
    }
  }

  /**
   * Add a new todo
   * @param {Todo} todo - The todo model object to add
   * @returns {Promise<void>}
   */
  async addTodo(todo) {
    const savedTodo = await this.#todosApiClient.saveTodo(todo);
    this.todos.push(savedTodo);
  }
}
```

API proxy / client objects
- API clients are classes that centralize network logic for a specific domain. They are injected into ViewModel constructors to enable interaction with various APIs.
- API clients take model objects as function parameters and return model objects from function calls.
- Keep retries, auth headers, and response normalization logic within the API client class.

```javascript
// TodosApiClient.js
/**
 * API client for todos operations
 */
export class TodosApiClient {
  #baseUrl;

  /**
   * @param {string} baseUrl - Base URL for the API
   */
  constructor(baseUrl = '/api') {
    this.#baseUrl = baseUrl;
  }

  /**
   * Fetch all todos from the API
   * @returns {Promise<Todo[]>} Array of todo model objects
   */
  async fetchTodos() {
    const res = await fetch(`${this.#baseUrl}/todos`);
    if (!res.ok) throw new Error(`Failed to fetch todos: ${res.statusText}`);
    return res.json();
  }

  /**
   * Save a todo to the API
   * @param {Todo} todo - The todo model object to save
   * @returns {Promise<Todo>} The saved todo model object
   */
  async saveTodo(todo) {
    const method = todo.id ? 'PUT' : 'POST';
    const url = todo.id ? `${this.#baseUrl}/todos/${todo.id}` : `${this.#baseUrl}/todos`;
    
    const res = await fetch(url, {
      method,
      body: JSON.stringify(todo),
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!res.ok) throw new Error(`Failed to save todo: ${res.statusText}`);
    return res.json();
  }
}
```

Patterns and best practices
- Prefer `$derived` over `$effect` for computed values.
- Use `bind:` sparingly; prefer explicit ViewModel functions for complex interactions.
- Keep side-effects in top-level `$effect` blocks inside the ViewModel or component where they belong.
- Use snippets over slots for reusable markup.
- Keyed each blocks for list rendering.

Plain JavaScript and JSDoc
- Our codebase uses plain JavaScript with JSDoc for types and documentation. Prefer clear JSDoc comments on public APIs, models, and ViewModel exports.

Examples

/**
 * @typedef {Object} Todo
 * @property {string} id
 * @property {string} text
 * @property {boolean} done
 */

/**
 * Load todos from the API
 * @returns {Promise<Todo[]>}
 */
async function fetchTodos() {
  const res = await fetch('/api/todos');
  return res.json();
}

// In components and ViewModels, prefer `let { x } = $props();` and annotate with JSDoc where helpful.

Testing
- Unit test ViewModels as plain modules (they are JS modules with runes) by importing & exercising exported functions and state.
- For components, prefer component-level tests with Svelte testing library.

Examples

Simple component using ViewModel and runes

<script>
  import { TodosViewModel } from './TodosViewModel.svelte.js';
  import { TodosApiClient } from './TodosApiClient.js';

  const viewModel = new TodosViewModel(new TodosApiClient());
  onMount(() => {
    viewModel.load();
  });
</script>

{#if loading}
  <p>loading...</p>
{:else}
  <ul>
    {#each todos as todo (todo.id)}
      <li>{todo.text}</li>
    {/each}
  </ul>
{/if}

Notes and gotchas
- Destructuring reactive state breaks reactivity.
- Reassign whole objects/arrays to trigger proxying when needed.
- $effect does not run during SSR; guard any browser-only APIs.

Quick checklist (for PRs)
- Uses Svelte 5 runes exclusivly.
- ViewModel and API client patterns applied.
- No reactive-destructuring bugs.
- Tests for ViewModel logic added.

---

This file is a focused Svelte 5 style guide derived from the Svelte 5 reference. It emphasizes runes, MVVM, and API proxy/client patterns for robust Svelte apps.
