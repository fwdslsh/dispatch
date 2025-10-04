# Async Error Handling Guide

**Last Updated**: 2025-10-01
**Audience**: All contributors to Dispatch

## Overview

Consistent error handling is critical for a good user experience. This guide establishes standard patterns for handling asynchronous operations, displaying errors, and managing loading states across Dispatch.

## Standard Async Return Shape

All async functions that interact with APIs or perform fallible operations should follow this pattern:

### The Standard Shape

```typescript
{
	success: boolean,      // Whether operation succeeded
	data?: any,           // Result data (if successful)
	error?: string        // Error message (if failed)
}
```

### Why This Shape?

**Advantages**:

1. **Predictable**: Every async function returns the same structure
2. **Type-safe**: Easy to type with TypeScript
3. **Testable**: Simple to mock and assert
4. **User-friendly**: Error messages are strings, ready to display

**Example Implementation**:

```javascript
/**
 * Create a new workspace
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createWorkspace(name, path) {
	try {
		const response = await fetch('/api/workspaces', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, path, authKey: getAuthKey() })
		});

		if (!response.ok) {
			const errorData = await response.json();
			return {
				success: false,
				error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
			};
		}

		const workspace = await response.json();
		return {
			success: true,
			data: workspace
		};
	} catch (error) {
		return {
			success: false,
			error: error.message || 'Failed to create workspace'
		};
	}
}
```

### Using the Result

```javascript
const result = await createWorkspace('My Project', '/workspace/my-project');

if (result.success) {
	console.log('Created workspace:', result.data);
	// Update UI with new workspace
} else {
	console.error('Failed to create workspace:', result.error);
	// Display error to user
}
```

## Loading State Management

Use Svelte 5's `$state` rune to manage loading states consistently.

### Pattern 1: Simple Loading Flag

```javascript
let loading = $state(false);
let error = $state(null);
let data = $state(null);

async function loadData() {
	loading = true;
	error = null;

	try {
		const response = await fetch('/api/data');
		data = await response.json();
	} catch (err) {
		error = err.message;
	} finally {
		loading = false; // Always reset loading
	}
}
```

### Pattern 2: ViewModel with Loading States

```javascript
export class DataViewModel {
	items = $state([]);
	loading = $state(false);
	error = $state(null);

	// Derived state for UI
	isEmpty = $derived.by(() => this.items.length === 0);
	hasError = $derived.by(() => this.error !== null);
	isReady = $derived.by(() => !this.loading && !this.hasError);

	async loadItems() {
		this.loading = true;
		this.error = null;

		const result = await apiClient.getItems();

		if (result.success) {
			this.items = result.data;
		} else {
			this.error = result.error;
		}

		this.loading = false;
	}
}
```

### Pattern 3: Per-Operation Loading States

When you have multiple async operations, track each separately:

```javascript
export class WorkspaceViewModel {
	workspaces = $state([]);

	// Separate loading states
	loadingWorkspaces = $state(false);
	creatingWorkspace = $state(false);
	deletingWorkspace = $state(null); // Store ID of workspace being deleted

	async loadWorkspaces() {
		this.loadingWorkspaces = true;
		// ... fetch workspaces
		this.loadingWorkspaces = false;
	}

	async createWorkspace(name, path) {
		this.creatingWorkspace = true;
		// ... create workspace
		this.creatingWorkspace = false;
	}

	async deleteWorkspace(id) {
		this.deletingWorkspace = id;
		// ... delete workspace
		this.deletingWorkspace = null;
	}
}
```

Usage in component:

```svelte
<button
	onclick={() => viewModel.deleteWorkspace(workspace.id)}
	disabled={viewModel.deletingWorkspace === workspace.id}
>
	{viewModel.deletingWorkspace === workspace.id ? 'Deleting...' : 'Delete'}
</button>
```

## Error Display Patterns

### Pattern 1: Toast Notifications (Transient Errors)

Use for non-critical errors that don't block the workflow:

```javascript
import { showToast } from '$lib/client/shared/utils/toast.js';

async function saveSettings() {
	const result = await apiClient.updateSettings(settings);

	if (result.success) {
		showToast('Settings saved successfully', 'success');
	} else {
		showToast(result.error, 'error');
	}
}
```

**When to use**:

- Save confirmations
- Non-blocking validation errors
- Background operation failures

### Pattern 2: Inline Error Messages (Form Validation)

Display errors next to the relevant form field:

```svelte
<script>
	let email = $state('');
	let emailError = $state(null);

	function validateEmail() {
		if (!email.includes('@')) {
			emailError = 'Invalid email address';
			return false;
		}
		emailError = null;
		return true;
	}

	async function submitForm() {
		if (!validateEmail()) return;

		const result = await apiClient.register(email);

		if (!result.success) {
			emailError = result.error;
		}
	}
</script>

<div class="form-group">
	<label for="email">Email</label>
	<input
		id="email"
		type="email"
		bind:value={email}
		class:error={emailError}
		onblur={validateEmail}
	/>
	{#if emailError}
		<div class="error-message" role="alert">{emailError}</div>
	{/if}
</div>
```

**When to use**:

- Form validation
- Field-specific errors
- Real-time validation feedback

### Pattern 3: Error Boundary (Page-Level Errors)

For critical errors that prevent the entire page from functioning:

```svelte
<script>
	let fatalError = $state(null);
	let data = $state(null);
	let loading = $state(true);

	async function loadPageData() {
		const result = await apiClient.getCriticalData();

		if (result.success) {
			data = result.data;
		} else {
			fatalError = result.error;
		}

		loading = false;
	}

	$effect(() => {
		loadPageData();
	});
</script>

{#if loading}
	<div class="loading-state">
		<p>Loading...</p>
	</div>
{:else if fatalError}
	<div class="error-boundary">
		<h2>Something went wrong</h2>
		<p>{fatalError}</p>
		<button onclick={loadPageData}>Try Again</button>
	</div>
{:else}
	<!-- Normal page content -->
	<div class="page-content">
		{/* ... */}
	</div>
{/if}
```

**When to use**:

- Critical data loading failures
- Authentication errors
- Server unavailable

## Complete Example: createSession with Full Error Handling

This example demonstrates all patterns combined:

```javascript
// ViewModel: SessionViewModel.svelte.js
export class SessionViewModel {
	sessions = $state([]);
	loading = $state(false);
	creating = $state(false);
	error = $state(null);

	constructor(apiClient) {
		this.apiClient = apiClient;
	}

	async loadSessions() {
		this.loading = true;
		this.error = null;

		const result = await this.apiClient.listSessions();

		if (result.success) {
			this.sessions = result.data.sessions;
		} else {
			this.error = result.error;
		}

		this.loading = false;
	}

	async createSession(type, workspacePath) {
		// Validate inputs
		if (!type) {
			return { success: false, error: 'Session type is required' };
		}

		if (!workspacePath) {
			return { success: false, error: 'Workspace path is required' };
		}

		// Set creating state
		this.creating = true;
		this.error = null;

		try {
			// Call API with error handling
			const result = await this.apiClient.createSession({
				type,
				workspacePath,
				options: {}
			});

			if (result.success) {
				// Add new session to list
				this.sessions = [...this.sessions, result.data];
				return { success: true, data: result.data };
			} else {
				// Store error for display
				this.error = result.error;
				return { success: false, error: result.error };
			}
		} catch (error) {
			// Handle unexpected errors
			const errorMessage = error.message || 'Unexpected error creating session';
			this.error = errorMessage;
			return { success: false, error: errorMessage };
		} finally {
			// Always reset creating state
			this.creating = false;
		}
	}
}
```

```svelte
<!-- Component: SessionCreator.svelte -->
<script>
	import { showToast } from '$lib/client/shared/utils/toast.js';

	let { viewModel } = $props();

	let sessionType = $state('pty');
	let workspacePath = $state('/workspace/my-project');
	let validationError = $state(null);

	async function handleCreateSession() {
		// Clear previous validation errors
		validationError = null;

		// Client-side validation
		if (!workspacePath.startsWith('/')) {
			validationError = 'Workspace path must start with /';
			return;
		}

		// Create session
		const result = await viewModel.createSession(sessionType, workspacePath);

		if (result.success) {
			// Show success toast
			showToast('Session created successfully', 'success');

			// Reset form
			workspacePath = '/workspace/my-project';
		} else {
			// Show error (could be toast or inline based on error type)
			if (result.error.includes('permission')) {
				// Critical error - show inline
				validationError = result.error;
			} else {
				// Transient error - show toast
				showToast(result.error, 'error');
			}
		}
	}
</script>

<div class="session-creator">
	<h3>Create New Session</h3>

	<!-- Global error message -->
	{#if viewModel.error}
		<div class="error-banner" role="alert">
			<strong>Error:</strong>
			{viewModel.error}
		</div>
	{/if}

	<div class="form-group">
		<label for="session-type">Session Type</label>
		<select id="session-type" bind:value={sessionType} disabled={viewModel.creating}>
			<option value="pty">Terminal (PTY)</option>
			<option value="claude">Claude Code</option>
			<option value="file-editor">File Editor</option>
		</select>
	</div>

	<div class="form-group">
		<label for="workspace-path">Workspace Path</label>
		<input
			id="workspace-path"
			type="text"
			bind:value={workspacePath}
			class:error={validationError}
			disabled={viewModel.creating}
			placeholder="/workspace/my-project"
		/>

		<!-- Inline validation error -->
		{#if validationError}
			<div class="error-message" role="alert">{validationError}</div>
		{/if}
	</div>

	<button
		onclick={handleCreateSession}
		disabled={viewModel.creating || !sessionType || !workspacePath}
		class="btn btn-primary"
	>
		{#if viewModel.creating}
			Creating...
		{:else}
			Create Session
		{/if}
	</button>
</div>

<style>
	.error-banner {
		background-color: #fee;
		border: 1px solid #fcc;
		padding: 1rem;
		margin-bottom: 1rem;
		border-radius: 4px;
	}

	.error-message {
		color: #c00;
		font-size: 0.875rem;
		margin-top: 0.25rem;
	}

	.form-group input.error {
		border-color: #c00;
	}
</style>
```

## Error Message Guidelines

### Good Error Messages

✅ **Specific and actionable**:

```javascript
"Workspace path '/invalid path' contains invalid characters. Use only letters, numbers, and hyphens.";
```

✅ **Include context**:

```javascript
'Failed to create session: Terminal key authentication required';
```

✅ **Suggest next steps**:

```javascript
'Session limit reached (10/10). Please close an existing session before creating a new one.';
```

### Bad Error Messages

❌ **Too vague**:

```javascript
'Error'; // What error? Why did it happen?
```

❌ **Technical jargon**:

```javascript
'ECONNREFUSED 127.0.0.1:3030'; // User doesn't know what this means
```

❌ **No recovery path**:

```javascript
'Something went wrong'; // What should the user do now?
```

## Testing Error Handling

Always test both success and error paths:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { SessionViewModel } from './SessionViewModel.svelte.js';

describe('SessionViewModel - Error Handling', () => {
	it('should handle successful session creation', async () => {
		const mockApiClient = {
			createSession: vi.fn().mockResolvedValue({
				success: true,
				data: { id: '123', type: 'pty' }
			})
		};

		const viewModel = new SessionViewModel(mockApiClient);
		const result = await viewModel.createSession('pty', '/workspace/test');

		expect(result.success).toBe(true);
		expect(viewModel.sessions.length).toBe(1);
		expect(viewModel.error).toBeNull();
	});

	it('should handle API errors gracefully', async () => {
		const mockApiClient = {
			createSession: vi.fn().mockResolvedValue({
				success: false,
				error: 'Permission denied'
			})
		};

		const viewModel = new SessionViewModel(mockApiClient);
		const result = await viewModel.createSession('pty', '/workspace/test');

		expect(result.success).toBe(false);
		expect(result.error).toBe('Permission denied');
		expect(viewModel.error).toBe('Permission denied');
		expect(viewModel.sessions.length).toBe(0);
	});

	it('should handle network errors', async () => {
		const mockApiClient = {
			createSession: vi.fn().mockRejectedValue(new Error('Network error'))
		};

		const viewModel = new SessionViewModel(mockApiClient);
		const result = await viewModel.createSession('pty', '/workspace/test');

		expect(result.success).toBe(false);
		expect(result.error).toContain('Network error');
	});

	it('should reset loading state even on error', async () => {
		const mockApiClient = {
			createSession: vi.fn().mockRejectedValue(new Error('Test error'))
		};

		const viewModel = new SessionViewModel(mockApiClient);
		await viewModel.createSession('pty', '/workspace/test');

		// Loading should be false even though error occurred
		expect(viewModel.creating).toBe(false);
	});
});
```

## Summary Checklist

When implementing async operations:

- [ ] Return `{success, data?, error?}` shape
- [ ] Use `$state` for loading flags
- [ ] Reset loading state in `finally` block
- [ ] Store error messages in state for display
- [ ] Choose appropriate error display pattern (toast/inline/boundary)
- [ ] Write error messages that are specific and actionable
- [ ] Test both success and error paths
- [ ] Handle network errors separately from API errors
- [ ] Validate inputs before making API calls
- [ ] Disable UI during async operations

## Resources

- **Real Examples**: See `SessionViewModel.svelte.js`, `WorkspaceNavigationViewModel.svelte.js`
- **API Client**: `SessionApiClient.js` demonstrates the return shape pattern
- **Testing**: See `tests/client/viewmodels/` for error handling test examples

## Questions?

If unsure how to handle an error scenario, check existing ViewModels for similar patterns or ask in code review.
