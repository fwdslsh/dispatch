# Code Review - End-to-End Analysis

**Date:** 2025-09-30
**Reviewer:** Claude Code
**Scope:** Dispatch Codebase - Settings, Preferences, Onboarding, and Retention Systems

## Executive Summary

### Overall Assessment: **Good** (with notable issues)

The Dispatch codebase demonstrates solid architectural principles with clean MVVM separation, comprehensive API design, and good test coverage. However, there are critical functionality continuity issues, missing authentication in key endpoints, and some over-engineered patterns that could be simplified.

### Key Strengths
- Clean MVVM architecture with Svelte 5 runes for reactive state management
- Comprehensive event sourcing with session management
- Well-documented API endpoints with clear consolidation strategy
- Strong E2E test coverage with realistic scenarios

### Critical Issues Requiring Immediate Attention


2. **Inconsistent API authentication patterns** - Mix of query params, headers, body
3. **Over-engineered service patterns** - Unused services creating maintenance burden

### Estimated Effort for Recommended Changes
- **Critical Fixes:** 4-8 hours
- **Consistency Improvements:** 8-16 hours
- **Simplification/Cleanup:** 16-24 hours
- **Total:** 28-48 hours

---

## Functionality Continuity Issues


### 3. **Inconsistent Authentication Patterns Across API Endpoints**

**Location:** Multiple API endpoints

**Issue:**
The codebase uses three different authentication patterns:

**Pattern A - Query Parameter (Settings API):**
```javascript
// /api/settings/+server.js line 23
const authKey = url.searchParams.get('authKey');
```

**Pattern B - Authorization Header (Preferences API):**
```javascript
// /api/preferences/+server.js line 11
const authHeader = request.headers.get('Authorization');
const authKey = authHeader?.replace('Bearer ', '');
```

**Pattern C - Request Body (Onboarding POST):**
```javascript
// /api/settings/onboarding/+server.js line 59
const body = await request.json();
// Uses body but doesn't validate authKey
```

**Impact:**
🟡 **HIGH** - Client code must remember which pattern each endpoint uses. Increases cognitive load and error probability.

**Recommendation:**
Standardize on **Authorization header** for all authenticated requests:

```javascript
// Shared auth helper in /src/lib/server/shared/auth.js
export function getAuthKeyFromRequest(request) {
	// Try Authorization header first (preferred)
	const authHeader = request.headers.get('Authorization');
	if (authHeader) {
		return authHeader.replace('Bearer ', '');
	}
	
	return null;
}

// Usage in endpoints
const authKey = getAuthKeyFromRequest(request);
if (!validateKey(authKey)) {
	return json({ error: 'Authentication required' }, { status: 401 });
}
```

**Why Authorization Header:**
- Industry standard (OAuth 2.0, JWT)
- Keeps auth out of URLs (not logged by proxies)
- Consistent with SessionApiClient implementation (line 58-64)

---

### 4. **Broken Error Handling in RetentionSettings Component**

**Location:** `/src/lib/client/settings/RetentionSettings.svelte` (lines 24-49)

**Current Code:**
```javascript
onMount(async () => {
	try {
		if (!serviceContainer) {
			throw new Error('Service container not available');
		}

		const apiClient = await serviceContainer.get('apiClient');
		if (!apiClient) {
			throw new Error('API client not available');
		}
		// ...
	} catch (error) {
		console.error('Failed to initialize RetentionSettings:', error);
		// NO USER-VISIBLE ERROR FEEDBACK
	}
});
```

**Issue:**
Errors during initialization are caught but never shown to the user. The component remains in "loading" state forever.

**Impact:**
🟡 **MEDIUM** - Users see infinite spinner when retention settings fail to load. No way to diagnose or recover.

**Recommendation:**
```javascript
let initError = $state(null);

onMount(async () => {
	try {
		// ... initialization code
	} catch (error) {
		console.error('Failed to initialize RetentionSettings:', error);
		initError = error.message || 'Failed to initialize retention settings';
	}
});

// In template:
{#if initError}
	<div class="error-message" role="alert">
		<strong>Error:</strong> {initError}
		<button onclick={() => window.location.reload()}>Retry</button>
	</div>
{:else if !viewModel || viewModel.isLoading}
	<!-- Loading state -->
{:else}
	<!-- Normal UI -->
{/if}
```

---

### 6. **SessionApiClient - Incorrect Parameter Mapping**

**Location:** `/src/lib/client/shared/services/SessionApiClient.js` (lines 200-209)

**Current Code:**
```javascript
const body = {
	kind: type, // API expects 'kind' not 'type'
	cwd: workspacePath, // API expects 'cwd' not 'workspacePath'
	options
};
```

**Issue:**
While the comment claims the API expects `kind` and `cwd`, the actual `/api/sessions/+server.js` endpoint documentation suggests it accepts multiple formats. This creates confusion.

**Recommendation:**
Verify actual API contract and document it explicitly:

```javascript
/**
 * Create session with unified API parameters
 * @param {Object} options
 * @param {string} options.type - Session type (pty, claude, file-editor)
 * @param {string} options.workspacePath - Workspace path
 *
 * NOTE: API endpoint accepts both naming conventions:
 * - type/kind (session type)
 * - workspacePath/cwd (working directory)
 * Using 'kind' and 'cwd' for backwards compatibility
 */
async create({ type, workspacePath, options = {} }) {
	// ...
}
```

---

## Over-Engineering

### 1. **Unused Server-Side Service Classes**

**Location:** `/src/lib/server/shared/services/`

**Files Found:**
- `RetentionService.js` - Not imported or used anywhere
- `MaintenanceService.js` - Not imported or used anywhere
- `WorkspaceService.js` - Not imported or used anywhere
- `WorkspaceTemplateService.js` - Not imported or used anywhere
- `EventSourcingService.js` - Not imported or used anywhere

**Issue:**
These service classes were likely created during an earlier architecture iteration but are now superseded by:
- Direct DatabaseManager calls in API routes
- RunSessionManager for session operations
- Simple utility functions

**Impact:**
🟡 **LOW** - Creates maintenance burden and confusion about which code path to use. Dead code accumulates over time.

**Recommendation:**
```bash
# Remove unused service files
rm src/lib/server/shared/services/RetentionService.js
rm src/lib/server/shared/services/MaintenanceService.js
rm src/lib/server/shared/services/WorkspaceService.js
rm src/lib/server/shared/services/WorkspaceTemplateService.js
rm src/lib/server/shared/services/EventSourcingService.js

# Verify no imports remain
git grep "RetentionService" src/
git grep "MaintenanceService" src/
```

**If these are intentionally kept for future use:** Add clear comments explaining the future architecture plan.

---

### 2. **Duplicate Service Patterns in Client Code**

**Location:** `/src/lib/client/shared/services/`

**Issue:**
Multiple service patterns exist for the same concerns:

```
SettingsService.js          (unused)
SettingsService.svelte.js   (used)
```

**Recommendation:**
Consolidate to single pattern. If `.svelte.js` is the current standard (for Svelte 5 runes), remove the plain `.js` version:

```bash
rm src/lib/client/shared/services/SettingsService.js
```

---

### 3. **Complex PreferencesViewModel Structure**

**Location:** `/src/lib/client/state/PreferencesViewModel.svelte.js`

**Issue:**
The ViewModel manages a complex nested preferences structure with manual change tracking:

```javascript
this.preferences = $state(structuredClone(defaultPreferences));
this.originalPreferences = $state.raw(structuredClone(defaultPreferences));

this.hasChanges = $derived.by(() => {
	return (
		JSON.stringify($state.snapshot(this.preferences)) !==
		JSON.stringify(this.originalPreferences)
	);
});
```

**Impact:**
🟢 **LOW** - Works correctly but uses heavyweight JSON serialization for change detection.

**Recommendation:**
For better performance with larger preference objects, consider:

```javascript
// Use Immer for immutable updates and structural sharing
import { produce } from 'immer';

// Or use shallow comparison per category
this.hasChanges = $derived.by(() => {
	const current = $state.snapshot(this.preferences);
	for (const category in current) {
		if (JSON.stringify(current[category]) !==
		    JSON.stringify(this.originalPreferences[category])) {
			return true;
		}
	}
	return false;
});
```

**Note:** This is a micro-optimization. Current approach is fine for typical use cases.

---

### 4. **RetentionPolicyViewModel Depends on PreferencesViewModel**

**Location:** `/src/lib/client/state/RetentionPolicyViewModel.svelte.js` (lines 24-36)

**Current Design:**
```javascript
constructor(preferencesViewModel, authKey) {
	this.#preferencesViewModel = preferencesViewModel;
	this.#authKey = authKey;
}
```

**Issue:**
RetentionPolicyViewModel takes PreferencesViewModel as a dependency but never uses it. All API calls go directly to `/api/preferences` and `/api/maintenance` endpoints.

**Impact:**
🟢 **LOW** - Confusing API design. Suggests tight coupling that doesn't actually exist.

**Recommendation:**
```javascript
// Simplified constructor
constructor(authKey) {
	this.#authKey = authKey;
}

// Usage in components
const retentionVM = new RetentionPolicyViewModel(authKey);
```

---

## Missing Implementations

### 1. **Incomplete Error Recovery in SessionViewModel**

**Location:** `/src/lib/client/shared/state/SessionViewModel.svelte.js` (lines 305-348)

**Current Code:**
```javascript
async closeSession(sessionId) {
	try {
		// ... deletion logic
	} catch (error) {
		log.error('Failed to close session', error);
		this.operationState.error = error.message || 'Failed to close session';

		// Dispatch error
		this.appStateManager.sessions.setError(error.message);
	} finally {
		this.sessionOperations.delete(sessionId);
	}
}
```

**Issue:**
If session deletion fails on the server, the session remains in the UI with no recovery mechanism. User cannot retry or force-delete.

**Recommendation:**
```javascript
async closeSession(sessionId, force = false) {
	try {
		// ... existing logic
	} catch (error) {
		if (force) {
			// Force removal from UI even if server delete fails
			log.warn('Force removing session from UI after failed deletion', sessionId);
			this.appStateManager.removeSession(sessionId);
		} else {
			// Show error with retry/force options
			this.operationState.error = {
				message: error.message,
				sessionId,
				actions: ['retry', 'force']
			};
		}
	}
}
```

---

### 2. **Missing Workspace Validation in OnboardingFlow**

**Location:** `/src/lib/client/onboarding/OnboardingFlow.svelte` (lines 225-257)

**Current Code:**
```javascript
<input
	type="text"
	placeholder="Workspace path"
	class="input input-bordered w-full"
	bind:value={workspacePath}
/>
```

**Issue:**
No validation for workspace path format:
- User could enter Windows path on Linux (`C:\workspace`)
- Relative paths like `../../../etc/passwd`
- Spaces or special characters that break shell commands
- Empty or whitespace-only paths

**Recommendation:**
```javascript
// Add validation
let workspacePathError = $state(null);

function validateWorkspacePath(path) {
	if (!path || !path.trim()) {
		return 'Workspace path is required';
	}

	// Must be absolute path
	if (!path.startsWith('/')) {
		return 'Workspace path must be absolute (start with /)';
	}

	// No directory traversal
	if (path.includes('..')) {
		return 'Workspace path cannot contain ".."';
	}

	// No special shell characters
	if (/[;&|<>$`]/.test(path)) {
		return 'Workspace path contains invalid characters';
	}

	return null;
}

// In template
{#if workspacePathError}
	<div class="error-text">{workspacePathError}</div>
{/if}
```

---

### 3. **No Cleanup Preview Feedback in RetentionSettings**

**Location:** `/src/lib/client/settings/RetentionSettings.svelte` (lines 64-67)

**Current Code:**
```javascript
async function handlePreview() {
	if (!viewModel) return;
	await viewModel.generatePreview();
}
```

**Issue:**
The `generatePreview()` method saves the policy first if changed (line 118-120 in RetentionPolicyViewModel):

```javascript
if (this.hasChanges) {
	await this.savePolicy();
}
```

This is unexpected behavior - clicking "Preview" shouldn't save changes permanently.

**Recommendation:**
```javascript
// In RetentionPolicyViewModel.svelte.js
async generatePreview() {
	if (!this.isValid) return;

	this.isGeneratingPreview = true;
	try {
		// DON'T save changes, just send current values to preview endpoint
		const response = await fetch('/api/maintenance', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.#authKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				action: 'preview',
				sessionRetentionDays: this.sessionDays,
				logRetentionDays: this.logDays
			})
		});
		// ...
	}
}
```

**Update API endpoint** `/src/routes/api/maintenance/+server.js` to accept preview parameters in request body instead of reading from preferences.

---

### 4. **Missing Session Count Validation**

**Location:** `/src/routes/api/workspaces/[workspaceId]/+server.js`

**Issue:**
The DELETE endpoint for workspaces should check if any sessions are still active in that workspace. Current implementation is missing this check according to documentation (CLAUDE.md line 143).

**Expected Behavior:**
```
DELETE /api/workspaces/{workspaceId}
# Should fail if active sessions exist
```

**Recommendation:**
```javascript
export async function DELETE({ params, url, locals }) {
	const { workspaceId } = params;
	const database = locals.services.database;

	try {
		// Check for active sessions
		const sessions = await database.all(
			`SELECT run_id FROM sessions
			 WHERE status='running'
			 AND json_extract(meta_json, '$.workspacePath') = ?`,
			[workspaceId]
		);

		if (sessions.length > 0) {
			return json({
				error: `Cannot delete workspace with ${sessions.length} active session(s)`,
				activeSessions: sessions.map(s => s.run_id)
			}, { status: 409 }); // 409 Conflict
		}

		// Proceed with deletion
		await database.run('DELETE FROM workspaces WHERE path = ?', [workspaceId]);

		return json({ success: true });
	} catch (error) {
		return json({ error: error.message }, { status: 500 });
	}
}
```

---

## Code Quality Issues

### 1. **Violation of Single Responsibility Principle - SessionApiClient**

**Location:** `/src/lib/client/shared/services/SessionApiClient.js`

**Issue:**
SessionApiClient handles too many concerns in one class (970 lines):

- Session CRUD operations
- Layout management
- History queries
- Claude-specific operations
- Onboarding API calls
- Retention policy API calls
- User preferences API calls
- Workspace management

**Impact:**
🟡 **MEDIUM** - Class is difficult to test and maintain. Changes to onboarding affect session code.

**Recommendation:**
Split into focused API clients:

```javascript
// Core session operations
class SessionApiClient {
	list()
	create()
	update()
	delete()
	getHistory()
}

// Layout management
class LayoutApiClient {
	getLayout()
	setSessionLayout()
	removeSessionLayout()
}

// Settings and preferences
class PreferencesApiClient {
	getUserPreferences()
	updateUserPreferences()
	resetPreferences()
}

// Onboarding
class OnboardingApiClient {
	getOnboardingStatus()
	updateProgress()
	completeOnboarding()
}

// Maintenance
class MaintenanceApiClient {
	getRetentionPolicy()
	updateRetentionPolicy()
	previewRetentionChanges()
	executeCleanup()
}

// Workspaces
class WorkspaceApiClient {
	getWorkspaces()
	createWorkspace()
	updateWorkspace()
	deleteWorkspace()
}
```

**Then use composition in ServiceContainer:**
```javascript
export class ServiceContainer {
	async get(serviceName) {
		if (serviceName === 'sessionApi') {
			return new SessionApiClient(config);
		}
		if (serviceName === 'preferencesApi') {
			return new PreferencesApiClient(config);
		}
		// etc.
	}
}
```

---

### 2. **Inconsistent Error Types**

**Location:** Multiple ViewModels

**Issue:**
Error handling uses inconsistent types:

```javascript
// Sometimes string
this.error = $state(null); // then = 'Error message'

// Sometimes object
this.operationState.error = {
	message: error.message,
	sessionId,
	actions: ['retry', 'force']
};
```

**Recommendation:**
Define consistent error shape:

```javascript
/**
 * @typedef {Object} ErrorState
 * @property {string} message - Human-readable error message
 * @property {string} [code] - Machine-readable error code
 * @property {Date} timestamp - When error occurred
 * @property {Object} [context] - Additional error context
 * @property {string[]} [actions] - Available recovery actions
 */

// Use consistently
this.error = $state(/** @type {ErrorState|null} */ null);

// Set errors consistently
this.error = {
	message: err.message || 'Operation failed',
	code: err.code,
	timestamp: new Date(),
	context: { sessionId },
	actions: ['retry', 'dismiss']
};
```

---

### 3. **Deep Nesting in DatabaseManager**

**Location:** `/src/lib/server/shared/db/DatabaseManager.js` (lines 630-674)

**Issue:**
The `initializeDefaultSettings()` method has deeply nested structure with inline category definitions.

**Recommendation:**
```javascript
// Extract to separate file for maintainability
// src/lib/server/shared/db/default-settings.js
export const DEFAULT_SETTINGS = [
	{
		category: 'global',
		settings: {
			theme: 'retro'
		},
		description: 'Global application settings'
	},
	{
		category: 'claude',
		settings: {
			model: 'claude-3-5-sonnet-20241022',
			permissionMode: 'default',
			executable: 'auto',
			maxTurns: null,
			includePartialMessages: false,
			continueConversation: false
		},
		description: 'Default Claude session settings'
	},
	{
		category: 'workspace',
		settings: {
			envVariables: {}
		},
		description: 'Workspace-level environment variables'
	}
];

// In DatabaseManager.js
import { DEFAULT_SETTINGS } from './default-settings.js';

async initializeDefaultSettings() {
	for (const categoryData of DEFAULT_SETTINGS) {
		const existing = await this.getSettingsByCategory(categoryData.category);
		if (Object.keys(existing).length === 0) {
			await this.setSettingsForCategory(
				categoryData.category,
				categoryData.settings,
				categoryData.description
			);
		}
	}
}
```

---

### 4. **Lack of Input Sanitization**

**Location:** Multiple API endpoints

**Issue:**
User inputs are not sanitized before database insertion:

```javascript
// /api/settings/[category]/+server.js line 48
await database.setSettingsForCategory(
	category,
	updatedSettings,
	`Settings for ${category} category` // Unsanitized category in description
);
```

**While SQLite prepared statements prevent SQL injection**, there's no validation that:
- Category names are valid (could be `../../etc/passwd`)
- Settings objects don't contain malicious content
- String values don't exceed reasonable lengths

**Recommendation:**
```javascript
// src/lib/server/shared/validation.js
export function validateSettingsCategory(category) {
	const VALID_CATEGORIES = [
		'global', 'claude', 'workspace', 'authentication',
		'onboarding', 'ui', 'terminal'
	];

	if (!VALID_CATEGORIES.includes(category)) {
		throw new Error(`Invalid settings category: ${category}`);
	}

	return category;
}

export function sanitizeSettingsValue(value, maxLength = 10000) {
	if (typeof value === 'string') {
		// Truncate overly long strings
		if (value.length > maxLength) {
			throw new Error(`Value exceeds maximum length of ${maxLength}`);
		}
		// Remove null bytes
		return value.replace(/\0/g, '');
	}
	return value;
}

// Use in endpoints
const validCategory = validateSettingsCategory(category);
const sanitizedSettings = Object.fromEntries(
	Object.entries(body.settings).map(([k, v]) => [k, sanitizeSettingsValue(v)])
);
```

---

### 5. **Missing TypeScript/JSDoc Types**

**Location:** Multiple files

**Issue:**
Many functions lack JSDoc type annotations, making it difficult to understand expected parameters:

```javascript
// Current - no types
async updateWorkspace(workspaceId, updates) {
	// What shape is updates?
}

// Better - with JSDoc
/**
 * Update workspace metadata
 * @param {string} workspaceId - Workspace path (e.g., '/workspace/my-project')
 * @param {Object} updates - Updates to apply
 * @param {string} [updates.name] - New workspace name
 * @param {'new'|'active'|'archived'} [updates.status] - New workspace status
 * @returns {Promise<Object>} Updated workspace object
 * @throws {Error} If workspace not found or update fails
 */
async updateWorkspace(workspaceId, updates) {
	// ...
}
```

**Recommendation:**
Add JSDoc to all public methods, especially:
- API endpoint handlers
- ViewModel methods
- Service methods
- Database operations

This provides IntelliSense benefits even without full TypeScript migration.

---

## Recommendations Summary

### Must Fix (Critical)

4. **Add error UI in RetentionSettings component** (30 min)
   - Lines 46-48
   - Prevents infinite loading states

5. **Standardize authentication patterns** (4 hours)
   - Create `getAuthKeyFromRequest()` helper
   - Update all endpoints to use Authorization header
   - Maintain backwards compatibility with query params

6. **Split SessionApiClient into focused API clients** (4 hours)
   - Improves testability and maintainability
   - Reduces coupling between features

7. **Add workspace path validation in onboarding** (1 hour)
   - Prevents directory traversal attacks
   - Improves user experience with clear validation errors

8. **Fix preview-saves-changes behavior in RetentionPolicyViewModel** (2 hours)
   - Update generatePreview() to not save policy
   - Update API endpoint to accept preview parameters
   - Users expect preview to be non-destructive

9. **Add active session check to workspace deletion** (1 hour)
   - Prevents data loss
   - Matches documented API behavior

10. **Remove unused server-side service classes** (1 hour)
    - Reduces maintenance burden
    - Clarifies architecture

11. **Remove duplicate SettingsService.js** (15 min)
    - Keep only .svelte.js version
    - Reduces confusion

12. **Add comprehensive JSDoc types** (8 hours)
    - Improves developer experience
    - Catches errors earlier

13. **Extract default settings to separate file** (30 min)
    - Improves readability
    - Makes settings easier to maintain

14. **Add input sanitization utilities** (2 hours)
    - Defense in depth
    - Prevents edge case failures

### Future (Technical Debt)

16. **Optimize PreferencesViewModel change tracking** (2 hours)
    - Use structural sharing or shallow comparison
    - Only needed if preferences grow large

17. **Implement retry/force options in SessionViewModel** (4 hours)
    - Improves error recovery
    - Better user experience for edge cases

---

## Testing Gaps

### Unit Tests

**Missing Coverage:**
1. `OnboardingViewModel` - No unit tests found
2. `RetentionPolicyViewModel` - Deleted test file (tests/client/viewmodels/RetentionPolicyViewModel.test.js)
3. `PreferencesViewModel` - No tests found
4. API endpoints:
   - `/api/settings/+server.js` - No tests
   - `/api/settings/onboarding/+server.js` - No tests
   - `/api/maintenance/+server.js` - No tests

**Recommendation:**
Add unit tests for ViewModels:

```javascript
// tests/client/viewmodels/OnboardingViewModel.test.js
describe('OnboardingViewModel', () => {
	it('should initialize with auth step', async () => {
		const mockApiClient = createMockApiClient();
		const vm = new OnboardingViewModel(mockApiClient);
		await vm.loadState();

		expect(vm.currentStep).toBe('auth');
		expect(vm.isComplete).toBe(false);
	});

	it('should validate current step before proceeding', () => {
		const vm = new OnboardingViewModel(mockApiClient);
		vm.currentStep = 'workspace';
		vm.completedSteps = []; // Auth not completed

		expect(vm.canProceed).toBe(false);
	});

	// ... more tests
});
```

### Integration Tests

**Missing Coverage:**
1. Full onboarding flow with database persistence
2. Retention policy update → preview → cleanup flow
3. Authentication header vs query param compatibility
4. Error recovery flows

---

## Architecture Observations

### Positive Patterns

1. **MVVM Separation:** Clean separation between ViewModels (business logic) and Views (UI components)
2. **Svelte 5 Runes:** Effective use of `$state`, `$derived`, `$effect` for reactive data
3. **Event Sourcing:** Session events with monotonic sequence numbers enable robust replay
4. **Dependency Injection:** ServiceContainer pattern provides testability
5. **Comprehensive E2E Tests:** Good coverage of user workflows

### Areas for Improvement

1. **Service Proliferation:** Too many services for a single-user application
2. **API Inconsistency:** Three different authentication patterns, multiple parameter naming conventions
3. **Tight Coupling:** Some components directly import ViewModels instead of using dependency injection

---

## Performance Considerations

### Database

**Current Implementation:**
- SQLite with WAL mode ✅
- Foreign keys enabled ✅
- Busy timeout: 5 seconds ✅
- Retry logic with exponential backoff ✅


### Client-Side

**Current Implementation:**
- Svelte 5 reactive system (very efficient)
- LocalStorage for auth persistence ✅
- Derived state for computed values ✅

**Potential Issues:**
- Deep object comparison via JSON.stringify for change tracking (PreferencesViewModel line 66-70)
- No debouncing on form inputs in settings components

**Recommendations:**
```javascript
// Add debouncing to form inputs
import { debounce } from '../utils/debounce.js';

const debouncedValidate = debounce((value) => {
	workspacePathError = validateWorkspacePath(value);
}, 300);

<input
	bind:value={workspacePath}
	oninput={(e) => debouncedValidate(e.target.value)}
/>
```

---

## Security Analysis

### Authentication

**Current State:**
- Terminal key stored in localStorage ⚠️
- Session tokens with 30-day expiration ✅
- validateKey() checks cached terminal key ✅

**Concerns:**
1. LocalStorage is vulnerable to XSS attacks
2. No HTTPS enforcement mentioned in docs
3. No rate limiting on auth endpoints
4. Terminal key never rotated

**Recommendations:**
```javascript
// 1. Add rate limiting middleware
// src/lib/server/shared/rate-limit.js
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({
	tokensPerInterval: 5,
	interval: 'minute'
});

export async function checkRateLimit(request) {
	const clientIp = request.headers.get('x-forwarded-for') ||
	                request.connection.remoteAddress;

	const allowed = await limiter.removeTokens(1);
	if (!allowed) {
		throw new Error('Rate limit exceeded');
	}
}

// 2. Add HTTPS redirect in hooks.server.js
export async function handle({ event, resolve }) {
	if (!event.url.protocol.startsWith('https') &&
	    process.env.NODE_ENV === 'production') {
		return new Response('HTTPS Required', { status: 403 });
	}

	return resolve(event);
}

// 3. Consider httpOnly cookies instead of localStorage
// Set-Cookie: authToken=xxx; HttpOnly; Secure; SameSite=Strict
```

### SQL Injection

**Status:** ✅ **Protected**
All database queries use prepared statements with parameterized queries.

**Example from DatabaseManager.js:**
```javascript
await this.run('SELECT * FROM sessions WHERE run_id = ?', [runId]);
```

### XSS Prevention

**Status:** ✅ **Mostly Protected**
Svelte automatically escapes all interpolated values in templates.

**Potential Risk:**
```svelte
<!-- Dangerous if title comes from user input -->
{@html session.title}

<!-- Safe -->
{session.title}
```

**Recommendation:** Audit codebase for `{@html}` usage.

---

## Conclusion

The Dispatch codebase demonstrates solid architectural foundations with clean MVVM patterns, comprehensive testing, and thoughtful API design. However, critical functionality issues—particularly in the onboarding flow—require immediate attention before the application can function correctly for first-time users.

The main areas for improvement are:

2. **Standardizing API authentication patterns** for consistency
3. **Removing unused code** to reduce maintenance burden
4. **Adding validation and error recovery** for better user experience

With these fixes, the codebase would move from "Good" to "Excellent" quality.

---

## Appendix: File Reference

### Files Reviewed
- `/src/routes/api/settings/+server.js`
- `/src/routes/api/settings/onboarding/+server.js`
- `/src/routes/api/settings/[category]/+server.js`
- `/src/routes/api/preferences/+server.js`
- `/src/routes/api/maintenance/+server.js`
- `/src/lib/client/onboarding/OnboardingFlow.svelte`
- `/src/lib/client/onboarding/OnboardingViewModel.svelte.js`
- `/src/lib/client/state/PreferencesViewModel.svelte.js`
- `/src/lib/client/state/RetentionPolicyViewModel.svelte.js`
- `/src/lib/client/settings/RetentionSettings.svelte`
- `/src/lib/client/shared/services/SessionApiClient.js`
- `/src/lib/client/shared/state/SessionViewModel.svelte.js`
- `/src/lib/server/shared/db/DatabaseManager.js`
- `/src/lib/server/shared/index.js`
- `/e2e/onboarding.spec.js`
- `/e2e/retention-settings.spec.js`

### Documentation Referenced
- `/CLAUDE.md`
- Git status showing modified files
- E2E test specifications

---

**End of Code Review**