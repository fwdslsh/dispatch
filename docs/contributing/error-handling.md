# Error Handling Guide

**Version:** 1.0
**Last Updated:** 2025-01-09
**Status:** Standard Practice

## Overview

This guide establishes consistent error handling patterns for async operations in Dispatch ViewModels and Services. Consistency in error handling improves code reliability, makes debugging easier, and provides better user experience.

## Core Principles

1. **Fail Fast**: Errors should be caught and handled as close to the source as possible
2. **Be Explicit**: Error states should be clear and unambiguous
3. **Stay Consistent**: Use the same pattern for similar operation types
4. **Preserve Context**: Always log errors with sufficient context for debugging
5. **Set State**: Update ViewModel error state for UI feedback

## Error Handling Patterns

Dispatch uses **two primary patterns** based on operation type:

### Pattern 1: Throw Errors (Critical Operations)

Use this pattern for **operations that must succeed** or that have no meaningful fallback.

**When to use:**

- Data loading operations (loadSessions, loadThemes)
- Critical initialization (initialize, setupWorkspace)
- Operations with no meaningful partial success state

**Implementation:**

```javascript
/**
 * Load sessions from API
 * @throws {Error} If loading fails
 */
async loadSessions() {
    this.loading = true;
    this.error = null;

    try {
        const result = await this.sessionApi.list();
        this.sessions = result.sessions || [];
        log.info('Sessions loaded successfully');
    } catch (error) {
        this.error = error.message || 'Failed to load sessions';
        log.error('Failed to load sessions', error);
        throw error; // Re-throw for caller to handle
    } finally {
        this.loading = false;
    }
}
```

**Caller handling:**

```javascript
try {
	await viewModel.loadSessions();
	// Continue with loaded data
} catch (error) {
	// Show error UI or retry
	showError(error.message);
}
```

**Benefits:**

- Forces callers to handle errors explicitly
- No ambiguity about success/failure
- Stack traces preserved for debugging
- Follows "fail-fast" principle

---

### Pattern 2: Return Result Object (User Operations)

Use this pattern for **user-initiated operations** where you want to provide structured feedback.

**When to use:**

- Form submissions (login, createKey)
- User actions with explicit success/failure feedback (deleteKey, toggleKey)
- Operations where the caller needs detailed error information

**TypeScript-style Result type:**

```javascript
/**
 * @typedef {Object} Result
 * @property {boolean} success - Whether operation succeeded
 * @property {any} [data] - Result data (only present if success=true)
 * @property {string} [error] - Error message (only present if success=false)
 */
```

**Implementation:**

```javascript
/**
 * Create a new API key
 * @param {string} label - User-friendly label
 * @returns {Promise<Result>} Result with key data or error
 */
async createKey(label) {
    this.loading = true;
    this.error = '';

    try {
        const response = await fetch('/api/auth/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ label })
        });

        if (response.ok) {
            const data = await response.json();
            log.info('API key created successfully', { id: data.id });

            return {
                success: true,
                data: {
                    id: data.id,
                    key: data.key,
                    label: data.label
                }
            };
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData?.error || 'Failed to create API key';
            this.error = errorMessage;
            log.error('Failed to create API key', errorMessage);

            return {
                success: false,
                error: errorMessage
            };
        }
    } catch (err) {
        const errorMessage = 'Unable to reach server';
        this.error = errorMessage;
        log.error('Create key error', err);

        return {
            success: false,
            error: errorMessage
        };
    } finally {
        this.loading = false;
    }
}
```

**Caller handling:**

```javascript
const result = await apiKeyState.createKey('My API Key');

if (result.success) {
	// Show success message with result.data
	showKey(result.data.key);
} else {
	// Show error message
	showError(result.error);
}
```

**Benefits:**

- Explicit success/failure without try/catch
- Structured error information
- Type-safe (with TypeScript/JSDoc)
- Better for form handling

---

## Pattern Comparison

| Aspect              | Throw Errors                 | Return Result Object  |
| ------------------- | ---------------------------- | --------------------- |
| **Use Case**        | Critical operations          | User operations       |
| **Error Signal**    | Exception thrown             | `success: false`      |
| **Caller Handling** | `try/catch`                  | `if (result.success)` |
| **Fail Fast**       | ✅ Yes                       | ❌ No (graceful)      |
| **Type Safety**     | ⚠️ Limited                   | ✅ Excellent          |
| **Best For**        | Data loading, initialization | Forms, user actions   |

---

## Anti-Patterns to Avoid

### ❌ Returning null on Error

```javascript
// BAD: Ambiguous - is null an error or valid result?
async createSession() {
    try {
        return await api.create();
    } catch (error) {
        log.error(error);
        return null; // DON'T DO THIS
    }
}
```

**Why it's bad:**

- Callers can't distinguish between "operation failed" and "no result"
- Silently swallows errors
- Makes debugging harder

**Fix:** Use Pattern 1 (throw) or Pattern 2 (Result object)

---

### ❌ Mixing Patterns

```javascript
// BAD: Inconsistent error handling
async operation1() {
    return null; // Returns null on error
}

async operation2() {
    throw error; // Throws on error
}

async operation3() {
    return { success: false }; // Returns Result
}
```

**Why it's bad:**

- Unpredictable for callers
- Requires callers to know implementation details
- Hard to maintain

**Fix:** Choose one pattern per ViewModel/Service based on operation type

---

### ❌ Swallowing Errors Without State Update

```javascript
// BAD: Error is logged but not exposed
async loadData() {
    try {
        this.data = await api.load();
    } catch (error) {
        log.error(error); // Logged but not accessible to UI
        // Missing: this.error = error.message;
    }
}
```

**Why it's bad:**

- UI has no way to show error feedback
- Silent failures lead to poor UX

**Fix:** Always set error state for UI feedback

---

## Standard Implementation Template

### For Data Loading Operations (Pattern 1: Throw)

```javascript
/**
 * Load [resource] from API
 * @throws {Error} If loading fails
 */
async load[Resource]() {
    this.loading = true;
    this.error = null;

    try {
        // 1. Perform operation
        const result = await this.api.load();

        // 2. Update state
        this.[resource] = result;

        // 3. Log success
        log.info('[Resource] loaded successfully');

        // 4. No return value needed (void)
    } catch (error) {
        // 5. Set error state
        this.error = error.message || 'Failed to load [resource]';

        // 6. Log error with context
        log.error('Failed to load [resource]', error);

        // 7. Re-throw for caller
        throw error;
    } finally {
        // 8. Always cleanup
        this.loading = false;
    }
}
```

### For User Operations (Pattern 2: Result Object)

```javascript
/**
 * [Action description]
 * @param {Type} param - Parameter description
 * @returns {Promise<Result>} Result with data or error
 */
async [action](param) {
    this.loading = true;
    this.error = '';

    try {
        // 1. Perform operation
        const response = await fetch('/api/endpoint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ param })
        });

        // 2. Handle success
        if (response.ok) {
            const data = await response.json();
            log.info('[Action] successful', { id: data.id });

            return {
                success: true,
                data: data
            };
        }

        // 3. Handle API error
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error || 'Operation failed';
        this.error = errorMessage;
        log.error('[Action] failed', errorMessage);

        return {
            success: false,
            error: errorMessage
        };
    } catch (err) {
        // 4. Handle network error
        const errorMessage = 'Unable to reach server';
        this.error = errorMessage;
        log.error('[Action] error', err);

        return {
            success: false,
            error: errorMessage
        };
    } finally {
        // 5. Always cleanup
        this.loading = false;
    }
}
```

---

## Migration Guide

When updating existing code to follow these patterns:

### 1. Identify Operation Type

Ask: Is this operation **critical** (must succeed) or **user-initiated** (provide feedback)?

- **Critical** → Use Pattern 1 (Throw)
- **User-initiated** → Use Pattern 2 (Result)

### 2. Update Method Signature

**Before (returns null):**

```javascript
async createSession() {
    // ...
    return null; // on error
}
```

**After (Pattern 1 - Throw):**

```javascript
/**
 * @throws {Error} If creation fails
 */
async createSession() {
    // ...
    throw error; // on error
}
```

**After (Pattern 2 - Result):**

```javascript
/**
 * @returns {Promise<Result>} Result with session or error
 */
async createSession() {
    // ...
    return { success: false, error: message };
}
```

### 3. Update All Callers

**Pattern 1 callers:**

```javascript
// OLD
const session = await createSession();
if (!session) {
	// handle error
}

// NEW
try {
	const session = await createSession();
	// use session
} catch (error) {
	// handle error
}
```

**Pattern 2 callers:**

```javascript
// OLD
const session = await createSession();
if (!session) {
	// handle error
}

// NEW
const result = await createSession();
if (result.success) {
	// use result.data
} else {
	// handle result.error
}
```

### 4. Update Tests

Ensure tests reflect the new error handling pattern:

```javascript
// Pattern 1 tests
test('throws on API error', async () => {
	mockApi.load.mockRejectedValue(new Error('API error'));
	await expect(viewModel.loadSessions()).rejects.toThrow('API error');
});

// Pattern 2 tests
test('returns error on API failure', async () => {
	mockApi.create.mockRejectedValue(new Error('API error'));
	const result = await viewModel.createKey('label');
	expect(result.success).toBe(false);
	expect(result.error).toContain('API error');
});
```

---

## Current Status (2025-01-09)

### Fully Compliant ViewModels

✅ **ThemeState** - All methods use Pattern 1 (Throw) consistently
✅ **AuthViewModel.loginWithKey()** - Uses Pattern 2 (Result) correctly

### ViewModels Needing Updates

🔶 **SessionViewModel** - Mixed patterns (returns null on some, void on others)
🔶 **ApiKeyState** - Mixed patterns (returns null on createKey, boolean on others)

---

## References

- [Svelte 5 Error Handling](https://svelte.dev/docs/svelte/error-handling)
- [SvelteKit Error Handling](https://kit.svelte.dev/docs/errors)
- [CODE_REVIEW_FINDINGS.md](../../CODE_REVIEW_FINDINGS.md) - Issue 4: Error Handling Analysis

---

## Questions & Answers

### Q: When should I use try/catch in components?

**A:** Use try/catch when calling ViewModels that throw errors (Pattern 1). For Result objects (Pattern 2), check the `success` flag instead.

### Q: Should I set error state AND throw?

**A:** Yes! Always set `this.error` for UI feedback, then throw to signal the caller. ThemeState demonstrates this pattern correctly.

### Q: What about void operations that can fail?

**A:** Use Pattern 1 (throw). Even with no return value, errors should be thrown for caller to handle. Example: `loadThemes()`.

### Q: Can I return both data and error?

**A:** No. In Pattern 2, `data` is only present when `success=true`, and `error` is only present when `success=false`. Keep them mutually exclusive.

---

## Refactoring Roadmap for Existing Code

This section identifies specific methods in existing ViewModels that need refactoring to match the documented patterns. All changes are **optional** quality-of-life improvements - the current code is functional.

### Priority: Medium (4-6 hours total)

These changes would improve consistency and make error handling more predictable across the codebase.

---

### 1. SessionViewModel (`src/lib/client/shared/state/SessionViewModel.svelte.js`)

**Status:** ❌ Mixed patterns - needs standardization

**Recommended Pattern:** Pattern 1 (Throw) - Critical session operations

#### Methods Needing Updates:

**a) `createSession()` - Lines 133-177**

**Current:** Returns `null` on error, returns `Session` on success

```javascript
async createSession({ type, workspacePath, options = {} }) {
    try {
        const result = await this.sessionApi.create(sessionData);
        return newSession; // Success
    } catch (error) {
        log.error('Failed to create session', error);
        this.operationState.error = error.message;
        return null; // ❌ Ambiguous
    }
}
```

**Recommended:** Pattern 1 - Throw on error

```javascript
/**
 * Create a new session
 * @param {Object} params - Session parameters
 * @returns {Promise<Session>} Created session
 * @throws {Error} If session creation fails
 */
async createSession({ type, workspacePath, options = {} }) {
    if (this.operationState.creating) {
        throw new Error('Session creation already in progress');
    }

    this.operationState.creating = true;
    this.operationState.error = null;
    this.appStateManager.ui.setLoading('creatingSession', true);

    try {
        const sessionData = { type, workspacePath, ...options };
        const result = await this.sessionApi.create(sessionData);
        const newSession = this.validateAndNormalizeSession(result);

        this.appStateManager.createSession(newSession);
        log.info('Session created successfully', newSession.id);

        return newSession;
    } catch (error) {
        this.operationState.error = error.message || 'Failed to create session';
        this.appStateManager.sessions.setError(error.message);
        log.error('Failed to create session', error);
        throw error; // ✅ Explicit failure
    } finally {
        this.operationState.creating = false;
        this.appStateManager.ui.setLoading('creatingSession', false);
    }
}
```

**Callers to Update:**

- Search for: `const session = await.*createSession\(`
- Pattern: Wrap in try/catch instead of null check
- Example locations: SessionContainer.svelte, CreateSessionModal.svelte

---

**b) `updateSession()` - Lines 184-212**

**Current:** Returns `null` on error

```javascript
async updateSession(sessionId, updates) {
    try {
        // ... update logic
        return updatedSession;
    } catch (error) {
        log.error('Failed to update session', error);
        return null; // ❌ Ambiguous
    }
}
```

**Recommended:** Pattern 1 - Throw on error

```javascript
/**
 * Update session properties
 * @param {string} sessionId - Session ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Session>} Updated session
 * @throws {Error} If update fails
 */
async updateSession(sessionId, updates) {
    try {
        log.info('Updating session', sessionId, updates);
        const result = await this.sessionApi.update({
            action: 'rename',
            sessionId,
            newTitle: updates.title
        });
        const updatedSession = this.validateAndNormalizeSession(result);
        this.appStateManager.sessions.updateSession(sessionId, updatedSession);
        log.info('Session updated successfully', sessionId);
        return updatedSession;
    } catch (error) {
        this.operationState.error = error.message || 'Failed to update session';
        this.appStateManager.sessions.setError(error.message);
        log.error('Failed to update session', error);
        throw error; // ✅ Explicit failure
    }
}
```

---

**c) `resumeSession()` - Lines 301-348**

**Current:** Returns `null` on error

```javascript
async resumeSession(sessionId, workspacePath) {
    try {
        // ... resume logic
        return resumedSession;
    } catch (error) {
        log.error('Failed to resume session', error);
        return null; // ❌ Ambiguous
    }
}
```

**Recommended:** Pattern 1 - Throw on error

```javascript
/**
 * Resume an existing session
 * @param {string} sessionId - Session ID
 * @param {string} workspacePath - Workspace path
 * @returns {Promise<Session>} Resumed session
 * @throws {Error} If resume fails
 */
async resumeSession(sessionId, workspacePath) {
    try {
        log.info('Resuming session', sessionId);

        const existingSession = this.appStateManager.sessions.getSession(sessionId);
        const sessionType = existingSession?.sessionType || SESSION_TYPE.PTY;
        const resolvedWorkspace = existingSession?.workspacePath || workspacePath;

        const result = await this.sessionApi.create({
            type: sessionType,
            workspacePath: resolvedWorkspace,
            resume: true,
            sessionId
        });
        const resumedSession = this.validateAndNormalizeSession(result);

        // Update or create in state
        const existingInState = this.appStateManager.sessions.getSession(sessionId);
        if (existingInState) {
            this.appStateManager.sessions.updateSession(sessionId, {
                ...resumedSession,
                isActive: true
            });
        } else {
            this.appStateManager.createSession({ ...resumedSession, isActive: true });
        }

        log.info('Session resumed successfully', sessionId);
        return resumedSession;
    } catch (error) {
        this.operationState.error = error.message || 'Failed to resume session';
        this.appStateManager.sessions.setError(error.message);
        log.error('Failed to resume session', error);
        throw error; // ✅ Explicit failure
    }
}
```

---

**d) `loadSessions()` - Lines 83-124**

**Current:** Doesn't throw, only sets error state

```javascript
async loadSessions(filters = {}) {
    try {
        // ... load logic
    } catch (error) {
        log.error('Failed to load sessions', error);
        this.operationState.error = error.message;
        // Missing: throw error
    } finally {
        this.loading = false;
    }
}
```

**Recommended:** Pattern 1 - Throw on error

```javascript
/**
 * Load sessions from API
 * @param {Object} [filters={}] - Optional filters
 * @throws {Error} If loading fails
 */
async loadSessions(filters = {}) {
    this.operationState.loading = true;
    this.operationState.error = null;
    this.appStateManager.sessions.setLoading(true);

    try {
        const shouldIncludeAll = filters.includeAll ?? true;
        const requestOptions = { includeAll: shouldIncludeAll };
        if (filters.workspace) {
            requestOptions.workspace = filters.workspace;
        }

        const result = await this.sessionApi.list(requestOptions);
        const validatedSessions = this.validateAndNormalizeSessions(result.sessions || []);

        this.appStateManager.loadSessions(validatedSessions);
        log.info('Successfully loaded sessions');
    } catch (error) {
        this.operationState.error = error.message || 'Failed to load sessions';
        this.appStateManager.sessions.setError(error.message);
        log.error('Failed to load sessions', error);
        throw error; // ✅ Add throw
    } finally {
        this.operationState.loading = false;
        this.appStateManager.sessions.setLoading(false);
    }
}
```

**Estimated Effort:** 2-3 hours (includes updating callers and tests)

---

### 2. ApiKeyState (`src/lib/client/shared/state/ApiKeyState.svelte.js`)

**Status:** ❌ Mixed patterns - needs standardization

**Recommended Pattern:** Pattern 2 (Result) - User operations with feedback

#### Methods Needing Updates:

**a) `createKey()` - Lines 122-159**

**Current:** Returns `null` on error, returns object on success

```javascript
async createKey(label) {
    try {
        // ... create logic
        return { id, key, label, message };
    } catch (err) {
        this.error = errorMessage;
        return null; // ❌ Ambiguous
    }
}
```

**Recommended:** Pattern 2 - Return Result object

```javascript
/**
 * Create a new API key
 * @param {string} label - User-friendly label
 * @returns {Promise<Result>} Result with key data or error
 */
async createKey(label) {
    this.loading = true;
    this.error = '';

    try {
        log.info('Creating new API key', { label });

        const response = await fetch('/api/auth/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ label })
        });

        if (response.ok) {
            const data = await response.json();
            log.info('API key created successfully', { id: data.id });

            // Reload keys to get updated list
            await this.loadKeys();

            return {
                success: true,
                data: {
                    id: data.id,
                    key: data.key,
                    label: data.label,
                    message: data.message
                }
            }; // ✅ Explicit success
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData?.error || 'Failed to create API key';
            this.error = errorMessage;
            log.error('Failed to create API key', errorMessage);

            return {
                success: false,
                error: errorMessage
            }; // ✅ Explicit failure
        }
    } catch (err) {
        const errorMessage = 'Unable to reach server';
        this.error = errorMessage;
        log.error('Create key error', err);

        return {
            success: false,
            error: errorMessage
        }; // ✅ Explicit failure
    } finally {
        this.loading = false;
    }
}
```

**Callers to Update:**

- Search for: `const.*= await.*createKey\(`
- Pattern: Check `result.success` instead of null
- Example: AuthenticationSettings.svelte

---

**b) `loadKeys()` - Lines 86-115**

**Current:** Doesn't throw, only sets error state

```javascript
async loadKeys() {
    try {
        // ... load logic
    } catch (err) {
        this.error = errorMessage;
        // Missing: throw error
    }
}
```

**Recommended:** Pattern 1 - Throw on error (critical data loading)

```javascript
/**
 * Load all API keys from server
 * @throws {Error} If loading fails
 */
async loadKeys() {
    this.loading = true;
    this.error = '';

    try {
        log.info('Loading API keys');

        const response = await fetch('/api/auth/keys', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            this.keys = data.keys || [];
            log.info(`Loaded ${this.keys.length} API keys`);
        } else {
            const data = await response.json().catch(() => ({}));
            const errorMessage = data?.error || 'Failed to load API keys';
            this.error = errorMessage;
            log.error('Failed to load API keys', errorMessage);
            throw new Error(errorMessage); // ✅ Add throw
        }
    } catch (err) {
        const errorMessage = err.message || 'Unable to reach server';
        this.error = errorMessage;
        log.error('Load keys error', err);
        throw err; // ✅ Add throw
    } finally {
        this.loading = false;
    }
}
```

---

**c) `deleteKey()` and `toggleKey()` - Consider Pattern 2**

**Current:** Returns boolean (acceptable but could be improved)

```javascript
async deleteKey(keyId) {
    try {
        // ... delete logic
        return true; // ⚠️ Acceptable but limited
    } catch (err) {
        return false;
    }
}
```

**Optional Improvement:** Pattern 2 - Return Result for better error messages

```javascript
/**
 * Delete an API key permanently
 * @param {string} keyId - API key ID to delete
 * @returns {Promise<Result>} Result with success status or error
 */
async deleteKey(keyId) {
    this.loading = true;
    this.error = '';

    try {
        log.info('Deleting API key', { keyId });

        const response = await fetch(`/api/auth/keys/${keyId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            log.info('API key deleted successfully', { keyId });
            await this.loadKeys();

            return {
                success: true,
                data: { keyId }
            }; // ✅ Can add success message
        } else {
            const data = await response.json().catch(() => ({}));
            const errorMessage = data?.error || 'Failed to delete API key';
            this.error = errorMessage;
            log.error('Failed to delete API key', errorMessage);

            return {
                success: false,
                error: errorMessage
            }; // ✅ Specific error message
        }
    } catch (err) {
        const errorMessage = 'Unable to reach server';
        this.error = errorMessage;
        log.error('Delete key error', err);

        return {
            success: false,
            error: errorMessage
        };
    } finally {
        this.loading = false;
    }
}
```

**Estimated Effort:** 2-3 hours (includes updating callers and tests)

---

### Implementation Strategy

**Recommended Approach:**

1. **Start with SessionViewModel** (2-3 hours)
   - Update all 4 methods to use Pattern 1 (Throw)
   - Update callers to use try/catch
   - Update tests to expect throws
   - Most impact on code consistency

2. **Then ApiKeyState** (2-3 hours)
   - Update `createKey()` to use Pattern 2 (Result) - already partially done in AuthViewModel
   - Update `loadKeys()` to throw on error
   - Optionally improve `deleteKey()` and `toggleKey()` to Result pattern
   - Better user feedback in settings UI

3. **Update Tests** (included in above estimates)
   - Pattern 1: `await expect(method()).rejects.toThrow()`
   - Pattern 2: `expect(result.success).toBe(false)`

---

### Testing Checklist

After refactoring, verify:

- ✅ All unit tests pass
- ✅ E2E tests for session creation/management pass
- ✅ E2E tests for API key management pass
- ✅ Error messages display correctly in UI
- ✅ Loading states work as expected
- ✅ No console errors during normal operations
- ✅ Error boundaries catch and display errors appropriately

---

### Breaking Changes

**Impact:** Medium - Requires caller updates

**Affected Areas:**

- Components calling `SessionViewModel` methods
- Components calling `ApiKeyState.createKey()`
- Any tests mocking these methods

**Migration Path:**

1. Update ViewModel methods first
2. Update component callers
3. Update tests
4. Test thoroughly in development
5. Deploy with release notes

---

**Total Estimated Effort:** 4-6 hours

**Priority:** Optional - Current code is functional, this improves consistency

**Benefits:**

- Predictable error handling across the codebase
- Better developer experience (clearer APIs)
- Improved error messages for users
- Easier debugging with stack traces
- Foundation for future development

---

**This is a living document. Update as patterns evolve or new cases emerge.**
