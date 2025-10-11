# Onboarding Implementation Issues - Comprehensive TODO

**Created**: 2025-10-09
**Branch**: `009-cookie-auth-refactor`
**Specification**: `specs/009-cookie-auth-refactor/spec.md`, `tasks.md`
**Status**: ❌ **CRITICAL ISSUES - ONBOARDING FLOW BROKEN**

---

## Executive Summary

**Total Issues Found**: 24 unique issues
**Critical**: 7
**High**: 8
**Medium**: 6
**Low**: 3

**Estimated Total Effort**: 14-18 hours

**Primary Failure**: Users complete onboarding but cannot access the application due to authentication/redirect issues. Session cookies are created but not properly recognized by authentication middleware.

---

## CRITICAL ISSUES (Must Fix Before Commit)

### C-001: Authentication Redirect Broken After Onboarding

**Priority**: CRITICAL
**Files**:

- `src/hooks.server.js:38-49`
- `src/routes/onboarding/+page.svelte:135`

**Problem**: After onboarding completes and user clicks "Continue to Dispatch", the app redirects to `/workspace` which is NOT in `PUBLIC_ROUTES`. Authentication middleware intercepts the request and redirects to `/login?redirect=/workspace` despite user having valid session cookie.

**Current Flow**:

1. User completes onboarding → session cookie set
2. User clicks "Continue to Dispatch" → `goto('/workspace')`
3. `/workspace` requires auth → middleware redirect to `/login`
4. **USER STUCK ON LOGIN PAGE**

**Expected Flow**:

1. User completes onboarding → session cookie set
2. User clicks "Continue" → navigate to authenticated area
3. User lands in workspace successfully

**Root Cause**:

- `/workspace` not in PUBLIC_ROUTES
- Session cookie may not be sent on immediate next request
- Redirect happens before cookie propagates

**Recommended Fix**:

```javascript
// Option 1: Change redirect destination to '/' (root)
async function continueToApp() {
  await goto('/', { replaceState: true });
}

// Option 2: Add /workspace to PUBLIC_ROUTES temporarily
const PUBLIC_ROUTES = [
  '/login',
  '/onboarding',
  '/workspace',  // ADD THIS
  // ...
];

// Option 3 (BEST): Fix +layout.svelte redirect logic
// In src/routes/+layout.svelte:233
} else if (!shouldOnboard && isOnOnboardingPage) {
  goto('/workspace', { replaceState: true });  // Change from '/'
}
```

**Effort**: 1hr
**Spec Reference**: FR-003, T021, T022

---

### C-002: Theme API Returns 401 During Onboarding

**Priority**: CRITICAL
**Files**:

- `src/routes/api/themes/+server.js:20-22`
- `src/hooks.server.js:48`
- `src/lib/client/onboarding/ThemeSelectionStep.svelte:23-24`

**Problem**: Theme selection step calls `themeState.loadThemes()` which fetches from `/api/themes` - a protected route. User is not yet authenticated during onboarding, so fetch returns 401 Unauthorized.

**Impact**: Theme step fails to load, users see error state, cannot select theme.

**Current Code** (hooks.server.js:48):

```javascript
const PUBLIC_ROUTES = [
	'/login',
	'/onboarding'
	// /api/themes is NOT here - requires auth!
];
```

**Recommended Fix**:

```javascript
// hooks.server.js:48 - Add themes API to public routes
const PUBLIC_ROUTES = [
	'/login',
	'/onboarding',
	'/api/themes', // ADD THIS - themes are safe to query without auth
	'/api/themes/active',
	'/api/themes/preset'
];
```

**Alternative Fix**: Keep themes protected, pre-load theme list in onboarding server load function and pass to client.

**Effort**: 15min
**Spec Reference**: T007, T008

---

### C-003: Session Cookie Not Immediately Recognized

**Priority**: CRITICAL
**Files**:

- `src/hooks.server.js:78-106`
- `src/routes/onboarding/+page.server.js:71`

**Problem**: After `CookieService.setSessionCookie(cookies, session.sessionId)` sets cookie in HTTP response, the browser may not include it in the immediate next request. Authentication middleware expects cookie in `event.cookies` (populated from `Cookie:` header).

**Impact**: Race condition where session exists but isn't validated on first authenticated request.

**Root Cause**: Cookie propagation timing - browser receives Set-Cookie in response but may not send Cookie in immediate next request.

**Recommended Fix**:

```javascript
// In onboarding/+page.svelte handleOnboardingComplete
async function handleOnboardingComplete(event) {
	const result = event.detail;
	if (result?.apiKey) {
		showApiKey = true;
		form = { success: true, ...result };

		// Wait for cookie to propagate before allowing navigation
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
}

// In continueToApp
async function continueToApp() {
	// Double-check cookie is set before navigating
	const hasAuth = document.cookie.includes('dispatch_session');
	if (!hasAuth) {
		console.warn('Session cookie not found, waiting...');
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	await goto('/workspace', { replaceState: true });
}
```

**Better Fix**: Use SvelteKit's invalidation system:

```javascript
import { invalidateAll } from '$app/navigation';

async function continueToApp() {
	await invalidateAll(); // Force server to re-check auth
	await goto('/workspace', { replaceState: true });
}
```

**Effort**: 2hrs
**Spec Reference**: FR-003

---

### C-004: System Status Not Updated After Onboarding

**Priority**: CRITICAL
**Files**:

- `src/routes/onboarding/+page.server.js:100-103`
- `src/lib/server/database/SettingsRepository.js`
- `src/routes/api/status/+server.js`

**Problem**: Onboarding calls `updateSettings('system', { onboarding_complete: true })`, but when `/api/status` is queried immediately after, it returns `{onboarding: {isComplete: false}}`.

**Evidence**: Test server logs confirm onboarding status remains false after completion.

**Root Cause**: Either:

1. Settings update not being committed to database, OR
2. `getSystemStatus()` not reading updated value, OR
3. Cache invalidation issue

**Recommended Fix**:

```javascript
// In onboarding/+page.server.js after updateSettings
await services.settingsManager.updateSettings('system', {
	onboarding_complete: true
});

// Force flush/commit
await services.database.run('PRAGMA wal_checkpoint(TRUNCATE)'); // If using WAL mode

// Verify write succeeded
const status = await services.settingsManager.getSystemStatus();
if (!status.onboarding.isComplete) {
	throw new Error('Failed to mark onboarding as complete');
}
```

**Alternative**: Check SettingsRepository.getSystemStatus() implementation:

```javascript
// In SettingsRepository.js
async getSystemStatus() {
  const settings = await this.getSettings('system');
  return {
    onboarding: {
      isComplete: settings.onboarding_complete === true  // Ensure boolean conversion
    }
  };
}
```

**Effort**: 1hr
**Spec Reference**: FR-001, T001

---

### C-005: Event Propagation Double-Nesting

**Priority**: CRITICAL
**Files**:

- `src/lib/client/onboarding/OnboardingFlow.svelte:56`
- `src/routes/onboarding/+page.svelte:76-79`

**Problem**: OnboardingFlow calls `onComplete({ detail: result.data })`, creating double-nested structure. Parent expects `event.detail` to contain result directly, but actually gets `event.detail.detail`.

**Current Code**:

```javascript
// OnboardingFlow.svelte:56
onComplete({ detail: result.data }); // Creates {detail: {detail: {...}}}

// +page.svelte:79
const result = event.detail; // Gets {detail: {...}} instead of {...}
if (result?.apiKey) {
	// ALWAYS FALSE - apiKey is at result.detail.apiKey
	showApiKey = true;
}
```

**Impact**: API key never displayed because `result?.apiKey` is always undefined.

**Recommended Fix**:

```javascript
// Option 1: Remove detail wrapper in OnboardingFlow.svelte:56
onComplete(result.data); // Pass data directly, not wrapped

// Option 2: Unwrap in +page.svelte:79
const result = event.detail?.detail || event.detail;
```

**Effort**: 15min
**Spec Reference**: FR-002

---

### C-006: API Key Display Logic Broken

**Priority**: CRITICAL
**Files**:

- `src/routes/onboarding/+page.svelte:168-222`
- `src/routes/onboarding/+page.svelte:76-90`

**Problem**: Due to event propagation issue (C-005), `showApiKey` never set to true because `result?.apiKey` check fails. Users complete onboarding but never see generated API key.

**Current Flow**:

1. Form submission succeeds
2. `handleOnboardingComplete` receives double-nested event
3. `result?.apiKey` is undefined (actually at `result.detail.apiKey`)
4. `showApiKey` remains false
5. API key display block never renders
6. **USER CANNOT LOG IN - NO API KEY**

**Recommended Fix**: Fix event propagation first (C-005), then verify:

```javascript
// After fixing C-005, verify this works:
async function handleOnboardingComplete(event) {
	const result = event.detail; // Should now be correct
	console.log('Onboarding result:', result); // DEBUG

	if (result?.apiKey) {
		showApiKey = true;
		form = { success: true, ...result };
	} else {
		console.error('No API key in result:', result); // DEBUG
		await goto('/workspace');
	}
}
```

**Effort**: 15min (after C-005 fixed)
**Spec Reference**: FR-002

---

### C-007: Theme Selection Never Applied Post-Auth

**Priority**: CRITICAL
**Files**:

- `src/lib/client/onboarding/ThemeSelectionStep.svelte:44`
- `src/routes/+layout.svelte` (missing code)

**Problem**: Theme selection stores choice in `localStorage['onboarding-selected-theme']`, but there's NO code that reads this value and applies the theme after authentication completes.

**Current Code**:

```javascript
// ThemeSelectionStep.svelte:44
localStorage.setItem('onboarding-selected-theme', selectedThemeId);

// +layout.svelte - NO CODE READS THIS VALUE!
```

**Impact**: User selects theme during onboarding, but app loads with default theme anyway.

**Recommended Fix**:

```javascript
// Add to src/routes/+layout.svelte onMount
onMount(async () => {
	// ... existing code ...

	// Apply theme selected during onboarding
	const pendingTheme = localStorage.getItem('onboarding-selected-theme');
	if (pendingTheme) {
		try {
			const themeState = await serviceContainer.get('themeState');
			await themeState.activateTheme(pendingTheme);
			localStorage.removeItem('onboarding-selected-theme');
			console.log('[Layout] Applied onboarding theme:', pendingTheme);
		} catch (error) {
			console.error('[Layout] Failed to apply onboarding theme:', error);
			localStorage.removeItem('onboarding-selected-theme');
		}
	}
});
```

**Effort**: 1hr
**Spec Reference**: T007, T008

---

## HIGH PRIORITY ISSUES

### H-001: Theme Should Be Part of Onboarding Form Submission

**Priority**: HIGH
**Files**:

- `src/lib/client/onboarding/OnboardingViewModel.svelte.js:18-22`
- `src/lib/client/onboarding/OnboardingFlow.svelte:147-157`
- `src/routes/onboarding/+page.server.js:38-40`

**Problem**: Theme selection handled separately via localStorage instead of being part of atomic onboarding form submission. Violates single-transaction requirement.

**Current Architecture**:

1. User selects theme → stored in localStorage
2. User submits form → workspace, preferences sent
3. Server creates session
4. Client reads localStorage → applies theme

**Expected Architecture** (per spec):

1. User selects theme → stored in ViewModel state
2. User submits form → workspace, preferences, **theme** sent
3. Server creates session **and applies theme**
4. Client receives confirmation

**Root Cause**: Theme application requires authentication, but original design had theme selected before auth. Workaround was localStorage.

**Recommended Fix**:

```javascript
// 1. Add theme to OnboardingViewModel.svelte.js:18-22
formData = $state({
	workspaceName: '',
	workspacePath: '',
	preferences: {},
	selectedTheme: 'phosphor-green' // ADD THIS
});

// 2. Update theme when selected
updateFormData('selectedTheme', themeId);

// 3. Include in form submission (OnboardingFlow.svelte:147-157)
<input type="hidden" name="selectedTheme" value={viewModel.formData.selectedTheme} />;

// 4. Extract in server action (+page.server.js:38-40)
const theme = formData.get('selectedTheme');

// 5. Apply theme server-side
if (theme) {
	await services.themeManager.activateTheme(theme, 'default');
}
```

**Effort**: 2hrs
**Spec Reference**: Planning docs, atomic operations requirement

---

### H-002: Missing E2E Test for Complete Flow

**Priority**: HIGH
**Files**: None (test missing)

**Problem**: No automated test validates complete onboarding journey: start → theme selection → workspace → completion → API key display → continue → authenticated state.

**Impact**: Regression risk high, core functionality not covered.

**Recommended Fix**: Create `e2e/onboarding-complete-flow.spec.js`:

```javascript
test('complete onboarding flow', async ({ page }) => {
	// Navigate to onboarding
	await page.goto('http://localhost:7173/onboarding');

	// Complete workspace step
	await page.fill('[name="workspaceName"]', 'Test Workspace');
	await page.click('button:has-text("Next")');

	// Select theme
	await page.click('[data-theme-id="phosphor-green"]');
	await page.click('button:has-text("Continue")');

	// Complete settings step
	await page.click('button:has-text("Complete Setup")');

	// Verify API key displayed
	await expect(page.locator('.api-key-text')).toBeVisible();
	const apiKey = await page.locator('.api-key-text').textContent();
	expect(apiKey).toMatch(/^dpk_[A-Za-z0-9_-]{43}$/);

	// Copy key and continue
	await page.click('button:has-text("Copy API Key")');
	await page.click('button:has-text("Continue to Dispatch")');

	// Verify authenticated
	await expect(page).toHaveURL('http://localhost:7173/workspace');
	await expect(page.locator('[data-auth-status="authenticated"]')).toBeVisible();
});
```

**Effort**: 2hrs
**Spec Reference**: T025-T030 (manual testing tasks)

---

### H-003: Foreign Key Constraint Ordering Risk

**Priority**: HIGH
**Files**:

- `src/routes/onboarding/+page.server.js:46-51`
- `src/lib/server/shared/db/migrate.js:550`

**Problem**: User creation uses `INSERT OR IGNORE`, which silently fails if user exists. If user creation fails for any OTHER reason (e.g., constraint violation), the error is swallowed, but session creation will fail with FK constraint error.

**Current Code**:

```javascript
await services.database.run(
  `INSERT OR IGNORE INTO auth_users (user_id, email, name, created_at, last_login)
   VALUES (?, NULL, ?, ?, ?)`,
  ['default', 'Default User', now, now]
);
// No check if insertion succeeded!

// Later: session creation assumes user exists
const session = await services.sessionManager.createSession('default', ...);
// WILL FAIL if user doesn't exist
```

**Recommended Fix**:

```javascript
// Check if user exists first
const existingUser = await services.database.get(
  'SELECT user_id FROM auth_users WHERE user_id = ?',
  ['default']
);

if (!existingUser) {
  // User doesn't exist, create it
  const result = await services.database.run(
    `INSERT INTO auth_users (user_id, email, name, created_at, last_login)
     VALUES (?, NULL, ?, ?, ?)`,
    ['default', 'Default User', now, now]
  );

  if (result.changes === 0) {
    throw new Error('Failed to create default user');
  }
}

// Now safe to create session
const session = await services.sessionManager.createSession('default', ...);
```

**Effort**: 30min
**Spec Reference**: FR-003

---

### H-004: Continue Button State Management Broken

**Priority**: HIGH
**Files**: `src/routes/onboarding/+page.svelte:202-209, 142-144`

**Problem**: Checkbox confirmation sets `canContinue = event.target.checked`, but if user unchecks the box after checking, `canContinue` remains true while checkbox appears unchecked (visual inconsistency).

**Current Code**:

```javascript
function confirmWithoutCopy(event) {
	canContinue = event.target.checked; // Sets true when checked
	// But canContinue is ALSO set true by copyApiKey()
	// So unchecking box doesn't disable button if key was copied
}
```

**Impact**: Minor UX issue - user can continue even after unchecking confirmation box (if they previously copied the key).

**Recommended Fix**:

```javascript
let apiKeyCopied = $state(false);
let manualConfirmation = $state(false);

// Derived state
let canContinue = $derived(apiKeyCopied || manualConfirmation);

function confirmWithoutCopy(event) {
  manualConfirmation = event.target.checked;
}

// In template
<input
  type="checkbox"
  bind:checked={manualConfirmation}  <!-- Use bind for two-way sync -->
/>
```

**Effort**: 30min
**Spec Reference**: T021

---

### H-005: Missing Loading State During Submission

**Priority**: HIGH
**Files**: `src/lib/client/onboarding/OnboardingFlow.svelte:195-204`

**Problem**: Form submission uses `use:enhance`, but doesn't update `viewModel.isLoading`. User sees no loading indicator during bcrypt operation (100-150ms).

**Current Code**:

```javascript
function handleFormSubmit() {
	return async ({ result, update }) => {
		// viewModel.isLoading is NOT updated here!
		if (result.type === 'success') {
			// ...
		}
	};
}
```

**Recommended Fix**:

```javascript
function handleFormSubmit() {
	return async ({ result, update }) => {
		viewModel.isLoading = true; // ADD THIS
		try {
			if (result.type === 'success') {
				localStorage.setItem('onboarding-complete', 'true');
				onComplete({ detail: result.data });
			} else if (result.type === 'failure') {
				viewModel.error = result.data?.error || 'Onboarding failed';
			}
			await update();
		} finally {
			viewModel.isLoading = false; // ADD THIS
		}
	};
}
```

**Effort**: 30min
**Spec Reference**: UX best practices

---

### H-006: Error Handling Too Generic

**Priority**: HIGH
**Files**: `src/routes/onboarding/+page.server.js:123-128`

**Problem**: Generic catch block with single error message doesn't differentiate between foreign key errors, bcrypt failures, or database connection issues.

**Current Code**:

```javascript
} catch (err) {
  logger.error('ONBOARDING', `Failed to complete onboarding: ${err.message}`);
  return {
    success: false,
    error: err.message || 'Failed to complete onboarding'  // Generic!
  };
}
```

**Impact**: Users receive vague error messages; debugging is difficult.

**Recommended Fix**:

```javascript
} catch (err) {
  logger.error('ONBOARDING', `Failed to complete onboarding: ${err.message}`);

  let errorMessage = 'Failed to complete onboarding';

  if (err.message?.includes('FOREIGN KEY constraint')) {
    errorMessage = 'Database setup error. Please contact support.';
  } else if (err.message?.includes('UNIQUE constraint')) {
    errorMessage = 'User already exists. This should not happen during onboarding.';
  } else if (err.message?.includes('bcrypt')) {
    errorMessage = 'Failed to secure your API key. Please try again.';
  } else if (err.code === 'SQLITE_BUSY') {
    errorMessage = 'Database is busy. Please try again in a moment.';
  }

  return {
    success: false,
    error: errorMessage,
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  };
}
```

**Effort**: 1hr
**Spec Reference**: Error handling best practices

---

### H-007: MVVM Violation in ThemeSelectionStep

**Priority**: HIGH (Architecture)
**Files**: `src/lib/client/onboarding/ThemeSelectionStep.svelte:17`

**Problem**: Component creates `new ThemeState()` directly instead of using ServiceContainer dependency injection.

**Current Code**:

```javascript
const themeState = new ThemeState(); // Direct instantiation!
```

**Impact**:

- Testing is harder (can't inject mocks)
- State not shared if multiple components need themes
- Violates dependency injection pattern

**Recommended Fix**:

```javascript
import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';

// In script
const serviceContainer = useServiceContainer();
let themeState = $state(null);

onMount(async () => {
	const themeStatePromise = serviceContainer.get('themeState');
	themeState = await (typeof themeStatePromise?.then === 'function'
		? themeStatePromise
		: Promise.resolve(themeStatePromise));

	await themeState.loadThemes();
});
```

**Effort**: 30min
**Spec Reference**: MVVM architecture guide

---

### H-008: Database Migration Validation Missing

**Priority**: HIGH
**Files**: `src/lib/server/shared/db/migrate.js:527-584`

**Problem**: Migration 2 creates tables with foreign key constraints, but no validation that default user exists before onboarding can create sessions.

**Impact**: Fresh database → complete onboarding → FK constraint violation possible.

**Recommended Fix**:

```javascript
// In migration 2, after creating tables, insert default user
async function migrate_002(db) {
	// ... create tables ...

	// Ensure default user exists for onboarding
	await db.run(
		`
    INSERT OR IGNORE INTO auth_users (user_id, email, name, created_at, last_login)
    VALUES ('default', NULL, 'Default User', ?, ?)
  `,
		[Date.now(), Date.now()]
	);

	logger.info('MIGRATION', 'Migration 2: Default user created');
}
```

**Effort**: 30min
**Spec Reference**: Database integrity

---

## MEDIUM PRIORITY ISSUES

### M-001: localStorage 'onboarding-complete' Serves No Purpose

**Priority**: MEDIUM
**Files**: `src/lib/client/onboarding/OnboardingFlow.svelte:52`

**Problem**: Sets `localStorage.setItem('onboarding-complete', 'true')` but no code reads this value. Onboarding completion tracked server-side in settings.

**Current Code**:

```javascript
// OnboardingFlow.svelte:52
localStorage.setItem('onboarding-complete', 'true'); // NEVER READ!
```

**Impact**: Code clutter, confusing for maintainers.

**Recommended Fix**: Remove this line entirely. Server-side tracking is sufficient.

**Effort**: 5min
**Spec Reference**: Cookie-only authentication requirement (FR-002, FR-003)

---

### M-002: Missing Workspace Creation Feedback

**Priority**: MEDIUM
**Files**: `src/routes/onboarding/+page.server.js:74-86`

**Problem**: Workspace creation failures logged but NOT returned to user. User doesn't know if workspace was created successfully.

**Current Code**:

```javascript
} catch (err) {
  logger.warn('ONBOARDING', `Failed to create workspace: ${err.message}`);
  // Don't fail onboarding if workspace creation fails
  // BUT also don't tell user!
}
```

**Recommended Fix**:

```javascript
let workspaceWarning = null;

try {
  workspace = await services.workspaceManager.createWorkspace({...});
} catch (err) {
  logger.warn('ONBOARDING', `Failed to create workspace: ${err.message}`);
  workspaceWarning = `Could not create workspace: ${err.message}`;
}

// In return statement
return {
  success: true,
  apiKey: {...},
  workspace: workspace || null,
  warnings: workspaceWarning ? [workspaceWarning] : []
};
```

**Effort**: 30min
**Spec Reference**: UX best practices

---

### M-003: Error Handling Doesn't Follow Architecture Guide

**Priority**: MEDIUM (Code Quality)
**Files**: `src/routes/onboarding/+page.server.js`

**Problem**: Error handling doesn't follow patterns in `src/docs/contributing/error-handling.md` (structured error types, error codes).

**Impact**: Code quality, debugging harder.

**Recommended Fix**: Implement structured error handling per architecture guide:

```javascript
import { createError, ErrorTypes } from '$lib/server/shared/errors.js';

try {
	// ... onboarding logic ...
} catch (err) {
	if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
		throw createError(ErrorTypes.DATABASE_CONSTRAINT, 'User setup failed', { originalError: err });
	}
	// ... other specific error types ...
}
```

**Effort**: 1hr
**Spec Reference**: `docs/contributing/error-handling.md`

---

### M-004: Deprecated submit() Method Still Present

**Priority**: MEDIUM (Code Quality)
**Files**: `src/lib/client/onboarding/OnboardingViewModel.svelte.js:122-165`

**Problem**: Method marked `@deprecated` but still has full implementation. Should either remove or keep without deprecation warning.

**Current Code**:

```javascript
/**
 * @deprecated This method is no longer used by OnboardingFlow.svelte...
 */
async submit() {
  // 40 lines of implementation!
}
```

**Recommended Fix**:

```javascript
// Option 1: Remove entirely if truly unused
// (Delete lines 122-165)

// Option 2: Keep as fallback, remove @deprecated
/**
 * Programmatic onboarding submission (fallback)
 * Note: OnboardingFlow.svelte uses form actions by default
 */
async submit() {
  // ...
}
```

**Effort**: 15min
**Spec Reference**: Code maintenance

---

### M-005: API Key Display Should Be Separate Component

**Priority**: MEDIUM (Architecture)
**Files**: `src/routes/onboarding/+page.svelte:168-222`

**Problem**: API key display screen implemented directly in route component. Should be separate component for reusability and testability.

**Impact**: Route component has too many responsibilities, violates MVVM pattern.

**Recommended Fix**:
Create `src/lib/client/onboarding/ApiKeyDisplayStep.svelte`:

```svelte
<script>
	import { ApiKeyDisplayViewModel } from './ApiKeyDisplayViewModel.svelte.js';

	let { apiKey, workspace, onContinue } = $props();
	const viewModel = new ApiKeyDisplayViewModel(apiKey);
</script>

<!-- Move display logic here -->
```

Then use in `+page.svelte`:

```svelte
{#if showApiKey && form?.apiKey}
	<ApiKeyDisplayStep apiKey={form.apiKey} workspace={form.workspace} onContinue={continueToApp} />
{/if}
```

**Effort**: 1hr
**Spec Reference**: MVVM pattern

---

### M-006: Missing Onboarding Status Check in load Function

**Priority**: MEDIUM (Security)
**Files**: `src/routes/onboarding/+page.server.js:11-24`

**Problem**: `load` function checks onboarding status but doesn't verify user has valid session cookie. Since `/onboarding` is PUBLIC_ROUTE, user could access onboarding page even after completion if they clear cookies.

**Current Code**:

```javascript
export async function load({ locals }) {
	const status = await services.settingsManager.getSystemStatus();

	if (status.onboarding.isComplete) {
		throw redirect(303, '/'); // No session check!
	}
	// ...
}
```

**Security Impact**: Low - user could re-access onboarding page but couldn't re-complete it (already marked complete in settings).

**Recommended Fix**:

```javascript
export async function load({ locals, cookies }) {
	const status = await services.settingsManager.getSystemStatus();

	if (status.onboarding.isComplete) {
		// If onboarding complete, verify user has valid session
		const sessionId = CookieService.extractSessionId(cookies);
		if (sessionId) {
			// Has session, send to app
			throw redirect(303, '/workspace');
		} else {
			// No session, send to login
			throw redirect(303, '/login');
		}
	}

	return { onboardingStatus: status.onboarding };
}
```

**Effort**: 30min
**Spec Reference**: Security best practices

---

## LOW PRIORITY ISSUES

### L-001: Hardcoded Label for First API Key

**Priority**: LOW
**Files**: `src/routes/onboarding/+page.server.js:55`

**Problem**: First API key always labeled `'First API Key'`. Could allow user customization (optional enhancement).

**Current Code**:

```javascript
const apiKey = await services.apiKeyManager.generateKey('default', 'First API Key');
```

**Impact**: Minor UX limitation, not a spec violation.

**Recommended Enhancement**:

```javascript
// Allow user to customize label during onboarding
const keyLabel = formData.get('apiKeyLabel') || 'First API Key';
const apiKey = await services.apiKeyManager.generateKey('default', keyLabel);
```

**Effort**: 30min
**Spec Reference**: Enhancement idea

---

### L-002: Missing Retry Logic for Theme Loading

**Priority**: LOW
**Files**: `src/lib/client/onboarding/ThemeSelectionStep.svelte:29`

**Problem**: If theme loading fails, user sees error state with no auto-retry.

**Current Code**:

```javascript
onMount(async () => {
	try {
		await themeState.loadThemes();
	} catch (error) {
		console.error('Failed to load themes:', error);
		// No retry!
	}
});
```

**Recommended Enhancement**:

```javascript
async function loadThemesWithRetry(maxRetries = 3) {
	for (let i = 0; i < maxRetries; i++) {
		try {
			await themeState.loadThemes();
			return;
		} catch (error) {
			if (i === maxRetries - 1) {
				console.error('Failed to load themes after retries:', error);
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
		}
	}
}
```

**Effort**: 30min
**Spec Reference**: UX enhancement

---

### L-003: Inconsistent Naming - OnboardingViewModel vs OnboardingFlow

**Priority**: LOW (Code Quality)
**Files**: Multiple files

**Problem**:

- `OnboardingViewModel.svelte.js` manages local UI state only
- `OnboardingFlow.svelte` orchestrates steps and form submission

**Impact**: Naming unclear - ViewModel behaves more like "FormState" than full ViewModel.

**Recommended Refactor**:

```javascript
// Rename OnboardingViewModel → OnboardingFormState
export class OnboardingFormState {
	// ... same implementation ...
}

// OR extend OnboardingViewModel to include service coordination
export class OnboardingViewModel {
	#formState = new OnboardingFormState();
	#apiClient;
	#themeService;

	// Coordinate services and form state
}
```

**Effort**: 1hr
**Spec Reference**: MVVM clarity

---

## TESTING CHECKLIST

After fixing critical issues, validate:

### Manual Testing

- [ ] Fresh database → complete onboarding → see API key
- [ ] Copy API key → continue → land in authenticated workspace
- [ ] Select theme → complete → theme is applied
- [ ] Navigate away mid-flow → can resume onboarding
- [ ] Complete onboarding → session cookie persists across page reload
- [ ] Clear cookies after onboarding → redirected to login
- [ ] Try to access `/onboarding` after completion → redirected to app

### Automated Testing

- [ ] E2E test: complete flow from start to authenticated state
- [ ] E2E test: API key copy functionality
- [ ] E2E test: theme selection and application
- [ ] Unit test: OnboardingViewModel form data management
- [ ] Unit test: Event propagation from OnboardingFlow to page
- [ ] Integration test: Onboarding form action with mocked services
- [ ] Error path test: Foreign key constraint failure
- [ ] Error path test: bcrypt failure
- [ ] Error path test: Database connection failure

---

## IMPLEMENTATION PLAN

### Phase 1: Critical Path (Day 1)

**Goal**: Enable basic onboarding completion

1. **C-005**: Fix event propagation (15min)
2. **C-006**: Fix API key display (15min)
3. **C-002**: Make theme API public (15min)
4. **C-004**: Fix system status update (1hr)
5. **C-003**: Fix cookie recognition timing (2hr)
6. **C-001**: Fix authentication redirect (1hr)
7. **Manual Test**: Verify complete flow works

**Total**: ~5 hours

### Phase 2: Data Flow (Day 2)

**Goal**: Fix theme integration and form submission

8. **C-007**: Apply theme after auth (1hr)
9. **H-001**: Include theme in form submission (2hr)
10. **H-003**: Fix foreign key constraint handling (30min)
11. **H-004**: Fix continue button state (30min)
12. **H-005**: Add loading state (30min)
13. **Manual Test**: Verify theme selection works

**Total**: ~4.5 hours

### Phase 3: Quality & Testing (Day 3)

**Goal**: Improve error handling and add tests

14. **H-002**: Add E2E test (2hr)
15. **H-006**: Improve error handling (1hr)
16. **H-007**: Fix MVVM violation (30min)
17. **H-008**: Add migration validation (30min)
18. **M-001 to M-006**: Address medium priority issues (3hr)
19. **Automated Testing**: Run full test suite

**Total**: ~7 hours

### Phase 4: Polish (Optional)

**Goal**: Code quality and enhancements

20. **L-001 to L-003**: Address low priority issues (2hr)
21. **Code Review**: Self-review all changes
22. **Documentation**: Update CLAUDE.md if needed

**Total**: ~3 hours

---

## SUCCESS CRITERIA

Onboarding implementation considered complete when:

- [ ] User can complete full onboarding flow without errors
- [ ] API key is displayed exactly once with clear warning
- [ ] User is authenticated (has session cookie) after onboarding
- [ ] User lands in authenticated workspace after clicking continue
- [ ] Selected theme is applied after authentication
- [ ] All E2E tests pass
- [ ] No console errors during onboarding flow
- [ ] System status correctly shows `onboardingComplete: true`
- [ ] User can log in with generated API key
- [ ] Onboarding cannot be re-accessed after completion

---

## NOTES

**Architecture Decisions to Discuss**:

1. Should theme be part of atomic onboarding submission, or is async application acceptable?
2. Should `/workspace` be in PUBLIC_ROUTES, or should we redirect to `/` instead?
3. Should deprecated OnboardingViewModel.submit() be removed or kept as fallback?
4. Should we add transaction support to onboarding action for rollback capability?

**Known Limitations**:

- Theme selection requires two-step process (select during onboarding, apply after auth)
- Workspace creation failures are non-fatal (logged but not surfaced to user)
- No onboarding resume capability if user navigates away
- No telemetry for tracking where users drop off in flow

**Future Enhancements**:

- Add onboarding progress indicator (step 1 of 4, etc.)
- Add keyboard navigation support for theme selection
- Add onboarding walkthrough/tutorial after completion
- Add email notification with API key (requires email setup)
- Add backup codes for account recovery

---

**END OF REPORT**
