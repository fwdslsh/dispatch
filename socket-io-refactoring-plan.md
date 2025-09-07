# Socket.IO Communication Refactoring Plan

## Problem Analysis

### Current Issues

1. **Inconsistent Patterns**: Mixed use of async/Promise patterns and callbacks
2. **Promise Wrapping**: Unnecessary Promise wrapping around socket.io callbacks
3. **API Complexity**: Different method signatures across clients
4. **ViewModel Integration**: Difficult to integrate with reactive ViewModels due to Promise-based APIs
5. **Socket.IO Misalignment**: Fighting against socket.io's natural callback-based API

### Current Architecture Analysis

**Handler Classes (Server-side):**

- BaseHandler.js - ✅ Good foundation, uses socket.io callbacks
- AuthHandler.js - Need to review
- ProjectHandler.js - Need to review
- SessionHandler.js - Need to review
- ClaudeHandler.server.js - ✅ Uses callbacks correctly
- ShellHandler.server.js - Need to review
- TerminalHandler.server.js - Need to review

**Client Classes (Client-side):**

- BaseClient.js - ✅ Good foundation with emit/on methods
- AuthClient.js - Need to review
- ProjectClient.js - ❌ Uses Promise wrapping (authenticate, etc)
- SessionClient.js - ❌ Uses Promise wrapping (create, attach, etc)
- ClaudeClient.js - ❌ Uses Promise wrapping (checkAuth, createSession, etc)
- TerminalClient.js - Need to review
- ShellClient.js - Need to review

## Desired Pattern

### Core Principles

1. **Callback-First API**: All methods use `(error, result)` callback pattern
2. **Event-Driven**: Primary communication via socket events
3. **Simple & Predictable**: Consistent method signatures across all clients
4. **ViewModel Friendly**: Easy integration with reactive ViewModels using callback patterns

### Standard Method Signatures

**For request/response operations:**

```javascript
// Current (Promise-based) - AVOID
async methodName(params) {
    return new Promise((resolve, reject) => { ... });
}

// Desired (Callback-based) - USE
methodName(params, callback) {
    this.emit('event:name', params, callback);
}

// Where callback follows Node.js convention: callback(error, result)
```

**For event-only operations:**

```javascript
// Fire and forget
sendData(data) {
    this.emit('event:name', data);
}
```

### Enhanced BaseClient Pattern

The BaseClient should provide utilities for consistent callback handling:

```javascript
class BaseClient {
	// Core emit with callback support
	emit(event, data, callback) {
		return this.socket.emit(event, data, callback);
	}

	// Utility for consistent error handling
	_handleResponse(callback) {
		return (response) => {
			if (response && response.success !== false) {
				callback(null, response);
			} else {
				callback(new Error(response?.error || 'Operation failed'), null);
			}
		};
	}

	// Optional: Promise wrapper for convenience (but not primary API)
	_promisify(method, ...args) {
		return new Promise((resolve, reject) => {
			method(...args, (error, result) => {
				if (error) reject(error);
				else resolve(result);
			});
		});
	}
}
```

## Detailed Refactoring Tasks

### Phase 1: Client Class Refactoring

#### 1.1 Update ClaudeClient.js

**Current Issues:**

- `checkAuth()` - Promise-wrapped
- `createSession()` - Promise-wrapped
- `sendMessage()` - Promise-wrapped
- `getHistory()` - Promise-wrapped
- `clearChat()` - Promise-wrapped
- `endSession()` - Promise-wrapped
- `startAuth()` - Promise-wrapped
- `submitToken()` - Promise-wrapped

**Refactoring:**

```javascript
// Replace this:
async checkAuth() {
    return new Promise((resolve, reject) => {
        this.emit('claude:auth', (response) => {
            // ... promise handling
        });
    });
}

// With this:
checkAuth(callback) {
    this.emit('claude:auth', this._handleResponse(callback));
}

// Optional Promise version:
checkAuthAsync() {
    return this._promisify(this.checkAuth);
}
```

#### 1.2 Update SessionClient.js

**Current Issues:**

- `create()` - Promise-wrapped
- `attach()` - Promise-wrapped
- `detach()` - Promise-wrapped
- `list()` - Promise-wrapped
- `end()` - Promise-wrapped

**Refactoring:** Apply same callback-first pattern as above.

#### 1.3 Update ProjectClient.js

**Current Issues:**

- `authenticate()` - Promise-wrapped
- `listProjects()` - Promise-wrapped
- `createProject()` - Promise-wrapped
- `deleteProject()` - Promise-wrapped

**Refactoring:** Apply same callback-first pattern.

#### 1.4 Review and Update Other Clients

- AuthClient.js
- TerminalClient.js
- ShellClient.js

### Phase 2: Update ViewModels

All ViewModels that use these clients need to be updated to use callback pattern:

#### 2.1 ClaudeSessionViewModel.svelte.js

**Current Usage:**

```javascript
const response = await this.#claudeClient.checkAuth();
```

**New Usage:**

```javascript
this.#claudeClient.checkAuth((error, response) => {
	if (error) {
		this.error = error.message;
		return;
	}
	// Handle success...
});
```

#### 2.2 Other ViewModels

- ClaudeCreationFormViewModel.svelte.js
- SessionsViewModel.svelte.js
- ProjectsViewModel.svelte.js
- DirectoryPickerViewModel.svelte.js

### Phase 3: Handler Class Review

Review all Handler classes to ensure they follow proper callback patterns:

#### 3.1 ClaudeHandler.server.js ✅

Already uses callbacks correctly - no changes needed.

#### 3.2 Other Handlers to Review

- AuthHandler.js
- ProjectHandler.js
- SessionHandler.js
- ShellHandler.server.js
- TerminalHandler.server.js

### Phase 4: Integration Testing

#### 4.1 End-to-End Testing

- Test Claude authentication flow
- Test session creation/management
- Test project operations
- Test shell/terminal operations

#### 4.2 ViewModel Reactivity Testing

- Verify reactive state updates work correctly with callback pattern
- Test error handling and user feedback
- Verify loading states work properly

## Implementation Strategy

### Step 1: Update BaseClient with Helper Methods

Add `_handleResponse` and `_promisify` utility methods to BaseClient.

### Step 2: Refactor One Client at a Time

Start with ClaudeClient as it's most complex, then SessionClient, then ProjectClient.

### Step 3: Update Corresponding ViewModels

Update each ViewModel after its client is refactored.

### Step 4: Test Each Component

Test functionality after each client/ViewModel pair is updated.

### Step 5: Review Handlers

Ensure all handlers use proper callback patterns.

### Step 6: Final Integration Testing

Full end-to-end testing of all functionality.

## Benefits of This Approach

1. **Simpler Code**: Eliminates unnecessary Promise wrapping
2. **Better Performance**: Reduces Promise overhead
3. **Natural Socket.IO**: Aligns with socket.io's callback-based API
4. **ViewModel Friendly**: Callbacks integrate naturally with reactive state
5. **Consistent API**: All clients follow same pattern
6. **Easier Debugging**: Simpler control flow
7. **Error Handling**: Consistent error handling across all operations

## Checklist

### Phase 1 - Client Refactoring

- [ ] Update BaseClient with helper methods
- [ ] Refactor ClaudeClient.js to callback-first API
- [ ] Refactor SessionClient.js to callback-first API
- [ ] Refactor ProjectClient.js to callback-first API
- [ ] Review and update AuthClient.js
- [ ] Review and update TerminalClient.js
- [ ] Review and update ShellClient.js

### Phase 2 - ViewModel Updates

- [ ] Update ClaudeSessionViewModel.svelte.js
- [ ] Update ClaudeCreationFormViewModel.svelte.js
- [ ] Update SessionsViewModel.svelte.js
- [ ] Update ProjectsViewModel.svelte.js (if exists)
- [ ] Update DirectoryPickerViewModel.svelte.js
- [ ] Update any other ViewModels using socket clients

### Phase 3 - Handler Review

- [ ] Review AuthHandler.js
- [ ] Review ProjectHandler.js
- [ ] Review SessionHandler.js
- [ ] Review ShellHandler.server.js
- [ ] Review TerminalHandler.server.js
- [ ] Verify ClaudeHandler.server.js (already good)

### Phase 4 - Testing & Validation

- [ ] Test Claude authentication flow
- [ ] Test Claude session creation and messaging
- [ ] Test session management (create, attach, end)
- [ ] Test project operations
- [ ] Test shell/terminal functionality
- [ ] Test error handling and edge cases
- [ ] Verify all ViewModels update reactively
- [ ] Performance testing

### Phase 5 - Cleanup

- [ ] Remove any unused Promise-based code
- [ ] Update any remaining async/await usage
- [ ] Code review and documentation updates
- [ ] Final integration testing

## Success Criteria

- [ ] All socket.io communication uses callback-first API
- [ ] All ViewModels integrate smoothly with callback-based clients
- [ ] Consistent error handling across all operations
- [ ] No Promise-wrapping of socket.io operations
- [ ] Improved performance and reduced complexity
- [ ] Full functionality maintained throughout refactoring
