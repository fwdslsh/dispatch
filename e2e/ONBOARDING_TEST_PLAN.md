# Onboarding Flow - Comprehensive Test Plan

**Created**: 2025-10-09
**Application**: Dispatch - Web-based Terminal
**Test Server**: http://localhost:7173
**Test Key**: `test-automation-key-12345`

---

## Executive Summary

This test plan covers the complete onboarding workflow for first-time users of Dispatch. The onboarding flow is a critical feature that:

- Creates the first user account
- Generates the initial API key (displayed once)
- Allows optional workspace creation
- Enables optional theme selection
- Establishes authenticated session
- Redirects user to the main application

**Total Scenarios**: 18 test scenarios across 6 categories
**Coverage**: Happy path, skip paths, error handling, UI states, edge cases, and accessibility

---

## Application Flow Overview

The onboarding process consists of these key pages/steps:

### 1. Onboarding Entry (`/onboarding`)

- Loads when onboarding is not yet complete
- Redirects to `/` if onboarding already complete
- No authentication required to access

### 2. Step 1: Workspace Setup

- **Optional step** - user can skip
- Fields:
  - Workspace name (text input, optional)
  - Workspace path (auto-generated, read-only)
- Buttons:
  - "Continue" (if name provided) OR "Skip Workspace" (if empty)
- Navigation: Moves to Theme step on continue/skip

### 3. Step 2: Theme Selection

- **Optional step** - user can skip
- Displays grid of preset theme cards
- Default selection: `phosphor-green`
- Interactive theme cards with preview
- Buttons:
  - "Continue with Selected Theme"
  - "Skip (use default)"
- Navigation: Moves to Settings step on continue/skip

### 4. Step 3: Settings Configuration

- **Final step** - form submission
- Checkboxes:
  - "Enable automatic cleanup of old sessions" (checked by default)
  - "Remember last used workspace" (checked by default)
- Hidden fields (from previous steps):
  - workspaceName (if provided)
  - workspacePath (if provided)
  - selectedTheme (if selected)
  - preferences (JSON)
- Buttons:
  - "Back" (returns to Theme step)
  - "Complete Setup" (submits form via POST)
- Loading state: Shows "Completing Setup..." during submission
- Navigation: On success → API Key Display page

### 5. API Key Display (Completion Page)

- **Shown once only** - critical security step
- Elements:
  - Warning box: "This is the only time you will see this API key"
  - API key display box (monospace text, selectable)
  - "Copy API Key" button
  - Key metadata (label, ID, workspace if created)
  - Confirmation checkbox: "I have saved my API key in a secure location"
  - "Continue to Dispatch" button (disabled until copy OR checkbox)
- Copy feedback: Button shows "✓ Copied to Clipboard!" for 2 seconds
- Navigation: On continue → `/workspace` (authenticated)

### 6. Database Changes

During successful onboarding, the following database records are created:

- `auth_users` table: Default user account (`user_id = 'default'`)
- `api_keys` table: First API key (bcrypt hashed)
- `auth_sessions` table: Session cookie (bcrypt hashed)
- `workspaces` table: Workspace record (if name provided)
- `settings` table: `onboarding_complete = true` in system settings
- `themes` table: Active theme record (if theme selected and applied)

---

## Test Environment Setup

### Prerequisites

1. **Start test server**:

   ```bash
   npm run dev:test
   ```

   - Runs on `http://localhost:7173`
   - No SSL (avoids certificate warnings)
   - Fresh database in `/tmp` directory
   - Known test key: `test-automation-key-12345`

2. **Verify server is ready**:

   ```bash
   curl http://localhost:7173/api/status
   ```

   Should return: `{"status":"ok","onboarding":{"isComplete":false}}`

3. **Fresh state for each test**:
   - Database is temporary (`/tmp/dispatch-test-*`)
   - Server restart creates clean state
   - Tests should be idempotent

### Known Issues

⚠️ **CRITICAL**: Some tests may fail due to known issues documented in `ONBOARDING-ISSUES.md`:

- C-001: Authentication redirect broken after onboarding
- C-002: Theme API returns 401 during onboarding
- C-003: Session cookie not immediately recognized
- C-004: System status not updated after onboarding
- C-005: Event propagation double-nesting
- C-006: API key display logic broken

Tests are written for **expected behavior** (how it should work), not current broken state.

---

## Test Scenarios

## Scenario Group 1: Happy Path - Complete Flow

### 1.1 Complete Onboarding with All Options

**Seed**: Fresh database (onboarding not complete)

**Steps**:

1. Navigate to `http://localhost:7173/onboarding`
2. Verify page loads with workspace step visible
3. Verify progress bar shows "33% Complete"
4. Fill workspace name: "My First Project"
5. Verify workspace path auto-generates: "/workspace/my-first-project"
6. Click "Continue" button
7. Verify theme selection step loads
8. Verify progress bar shows "66% Complete"
9. Verify default theme "phosphor-green" is selected (outlined)
10. Click on "cyber-blue" theme card
11. Verify "cyber-blue" card shows selection outline
12. Click "Continue with Selected Theme" button
13. Verify settings step loads
14. Verify progress bar shows "100% Complete"
15. Verify both checkboxes are checked by default
16. Click "Complete Setup" button
17. Verify button shows "Completing Setup..." loading state
18. Wait for API key display page to load
19. Verify warning box is visible with "⚠️" icon
20. Verify API key is displayed in monospace font
21. Verify API key matches format: `dpk_[A-Za-z0-9_-]{43}`
22. Verify key metadata shows:
    - Key Label: "First API Key"
    - Key ID: (UUID format)
    - Workspace: "My First Project"
23. Verify "Continue to Dispatch" button is disabled
24. Click "Copy API Key" button
25. Verify button text changes to "✓ Copied to Clipboard!"
26. Verify clipboard contains the API key
27. Wait 2 seconds
28. Verify button text reverts to "Copy API Key"
29. Verify "Continue to Dispatch" button is now enabled
30. Click "Continue to Dispatch" button
31. Verify navigation to `/workspace`
32. Verify user is authenticated (no redirect to login)

**Expected Results**:

- User successfully completes full onboarding flow
- API key is displayed exactly once
- Session cookie is set (httpOnly, Secure in prod)
- Workspace is created in database
- Theme is applied to the application
- System status shows `onboarding_complete: true`
- User lands in authenticated workspace

**Database Verification** (optional):

```sql
SELECT * FROM auth_users WHERE user_id = 'default';
SELECT * FROM api_keys WHERE label = 'First API Key';
SELECT * FROM auth_sessions WHERE user_id = 'default';
SELECT * FROM workspaces WHERE name = 'My First Project';
SELECT value FROM settings WHERE category = 'system' AND key = 'onboarding_complete';
```

---

### 1.2 Complete Onboarding with Manual Confirmation (No Copy)

**Seed**: Fresh database

**Steps**:

1. Navigate to `http://localhost:7173/onboarding`
2. Complete workspace step with name "Test Workspace"
3. Continue through theme step (keep default)
4. Complete settings step
5. Wait for API key display page
6. Verify "Continue to Dispatch" button is disabled
7. Do NOT click "Copy API Key"
8. Check the confirmation checkbox: "I have saved my API key in a secure location"
9. Verify "Continue to Dispatch" button is now enabled
10. Click "Continue to Dispatch"
11. Verify navigation to `/workspace`

**Expected Results**:

- User can proceed without copying (via manual confirmation)
- Checkbox enables continue button
- Authentication succeeds

---

## Scenario Group 2: Skip Paths - Minimal Flow

### 2.1 Skip Workspace Creation

**Seed**: Fresh database

**Steps**:

1. Navigate to `http://localhost:7173/onboarding`
2. Verify workspace step loads
3. Leave workspace name field empty
4. Verify button text shows "Skip Workspace"
5. Click "Skip Workspace" button
6. Verify theme selection step loads
7. Verify no workspace data in hidden form fields
8. Continue with theme selection (default)
9. Complete settings step
10. Verify API key display does NOT show workspace metadata
11. Copy key and continue
12. Verify successful authentication

**Expected Results**:

- Onboarding completes without workspace
- No workspace record in database
- API key display omits workspace info
- User still authenticated successfully

---

### 2.2 Skip Theme Selection

**Seed**: Fresh database

**Steps**:

1. Navigate to `http://localhost:7173/onboarding`
2. Create workspace: "Skip Theme Test"
3. Continue to theme step
4. Verify default theme "phosphor-green" is pre-selected
5. Click "Skip (use default)" button
6. Verify settings step loads
7. Verify hidden theme field is empty OR contains default
8. Complete settings step
9. Copy API key and continue
10. Verify application uses default theme (phosphor-green)

**Expected Results**:

- Onboarding completes with default theme
- Theme selection step is skipped gracefully
- Default theme applied after authentication

---

### 2.3 Minimal Path - Skip Both Workspace and Theme

**Seed**: Fresh database

**Steps**:

1. Navigate to `http://localhost:7173/onboarding`
2. Click "Skip Workspace"
3. Click "Skip (use default)"
4. Verify settings step loads
5. Keep default checkboxes
6. Click "Complete Setup"
7. Verify API key displays
8. Copy key and continue
9. Verify authentication succeeds

**Expected Results**:

- Fastest path through onboarding
- Only creates user, API key, and session
- No workspace or custom theme
- User authenticated successfully

---

## Scenario Group 3: Navigation and Progress

### 3.1 Back Button Navigation

**Seed**: Fresh database

**Steps**:

1. Navigate to onboarding
2. Create workspace: "Back Test"
3. Continue to theme step
4. Select "neon-pink" theme
5. Continue to settings step
6. Verify "Back" button is visible
7. Click "Back" button
8. Verify theme step reloads
9. Verify "neon-pink" is still selected
10. Continue to settings again
11. Verify settings step loads
12. Complete onboarding

**Expected Results**:

- Back button returns to previous step
- Form data is preserved during navigation
- User can modify previous selections

---

### 3.2 Progress Bar Accuracy

**Seed**: Fresh database

**Steps**:

1. Navigate to onboarding
2. Verify progress bar at workspace step: "33% Complete"
3. Continue to theme step
4. Verify progress bar: "66% Complete"
5. Continue to settings step
6. Verify progress bar: "100% Complete"

**Expected Results**:

- Progress bar accurately reflects step position
- Percentage calculation: (currentIndex / totalSteps) \* 100

---

### 3.3 Direct URL Access After Completion

**Seed**: Completed onboarding (user exists, session active)

**Steps**:

1. Navigate to `http://localhost:7173/onboarding`
2. Verify redirect to `/` (root)
3. Verify user is NOT shown onboarding flow again

**Expected Results**:

- Onboarding page redirects if already complete
- `+page.server.js` load function checks `onboardingStatus.isComplete`
- Users cannot re-run onboarding

---

## Scenario Group 4: Error Handling

### 4.1 Theme Loading Failure

**Seed**: Fresh database + Mock theme API to return 500 error

**Steps**:

1. Navigate to onboarding
2. Skip workspace step
3. Wait for theme step to load
4. Verify error state displays: "Failed to load themes"
5. Verify "Continue with Default Theme" button is shown
6. Click "Continue with Default Theme"
7. Verify settings step loads
8. Complete onboarding successfully

**Expected Results**:

- Theme loading errors are handled gracefully
- User can continue with default theme
- Error does not block onboarding completion

---

### 4.2 Form Submission Failure

**Seed**: Fresh database + Mock API to return failure

**Steps**:

1. Navigate to onboarding
2. Complete workspace step
3. Complete theme step
4. Complete settings step
5. Mock form action to return `{type: 'failure', data: {error: 'Database error'}}`
6. Click "Complete Setup"
7. Verify error alert displays: "Setup Error: Database error"
8. Verify form remains interactive (not disabled)
9. Verify user can retry submission

**Expected Results**:

- Form errors are displayed clearly
- User is not stuck in loading state
- Retry is possible without page reload

---

### 4.3 Session Cookie Creation Failure

**Seed**: Fresh database + Mock session creation to fail

**Steps**:

1. Navigate to onboarding
2. Complete full flow
3. Mock `CookieService.setSessionCookie()` to throw error
4. Submit settings form
5. Verify error displayed
6. Verify user is NOT redirected to workspace
7. Verify API key is NOT displayed (since submission failed)

**Expected Results**:

- Cookie creation errors prevent completion
- User receives clear error message
- No partial state (no API key displayed if session fails)

---

## Scenario Group 5: API Key Security

### 5.1 API Key Format Validation

**Seed**: Fresh database

**Steps**:

1. Complete onboarding flow
2. Capture displayed API key
3. Verify format matches: `dpk_[A-Za-z0-9_-]{43}`
4. Verify key is base64url encoded (no special chars like +/=)
5. Verify key length: 47 characters total (dpk\_ + 43)

**Expected Results**:

- API keys follow standard format
- URL-safe characters only
- Consistent length

---

### 5.2 API Key Copy Functionality

**Seed**: Fresh database

**Steps**:

1. Complete onboarding to API key display
2. Click "Copy API Key" button
3. Verify clipboard contains exact key value
4. Paste in external editor
5. Verify pasted value matches displayed value
6. Verify no whitespace or extra characters

**Expected Results**:

- Copy to clipboard works correctly
- Key value is exact (no trimming needed)
- Cross-browser clipboard API supported

---

### 5.3 API Key Display Persistence (Reload)

**Seed**: Fresh database

**Steps**:

1. Complete onboarding to API key display page
2. Copy the API key
3. Click browser refresh (F5)
4. Verify page redirects (does NOT show key again)
5. Verify user is authenticated (session cookie persists)

**Expected Results**:

- API key is shown exactly once
- Refresh does not re-display key
- Session remains valid after refresh

---

### 5.4 Continue Button States

**Seed**: Fresh database

**Steps**:

1. Complete onboarding to API key display
2. Verify "Continue to Dispatch" button is disabled
3. Click "Copy API Key"
4. Verify button becomes enabled immediately
5. Refresh page (to test state reset)
6. If page persists (shouldn't), verify button is disabled again

**Expected Results**:

- Button disabled by default (security measure)
- Enabled after copy action
- Checkbox alternative also enables button
- State is client-side only (doesn't persist across reload)

---

## Scenario Group 6: UI States and Feedback

### 6.1 Loading States During Submission

**Seed**: Fresh database

**Steps**:

1. Navigate to onboarding
2. Complete all steps to settings form
3. Click "Complete Setup"
4. Immediately verify button text changes to "Completing Setup..."
5. Verify button shows loading spinner (if implemented)
6. Verify button is disabled during submission
7. Wait for completion (bcrypt takes 100-150ms)
8. Verify loading state clears after response

**Expected Results**:

- Loading state provides user feedback
- Button disabled during submission (prevents double-submit)
- Smooth transition to API key display

---

### 6.2 Copy Button Feedback Animation

**Seed**: Fresh database

**Steps**:

1. Complete onboarding to API key display
2. Click "Copy API Key"
3. Verify button text changes to "✓ Copied to Clipboard!"
4. Wait exactly 2 seconds
5. Verify button text reverts to "Copy API Key"
6. Click "Copy API Key" again
7. Verify feedback animation repeats

**Expected Results**:

- Visual feedback confirms copy action
- 2-second timeout resets button text
- User can copy multiple times if needed

---

### 6.3 Form Field Validation

**Seed**: Fresh database

**Steps**:

1. Navigate to onboarding
2. Enter workspace name: "Test@#$%"
3. Verify auto-generated path sanitizes: "/workspace/test"
4. Enter workspace name: "My Amazing Project!!!"
5. Verify path: "/workspace/my-amazing-project"
6. Enter workspace name: "---test---"
7. Verify path: "/workspace/test" (strips leading/trailing hyphens)

**Expected Results**:

- Workspace path auto-generation is robust
- Special characters removed
- Spaces converted to hyphens
- Leading/trailing hyphens stripped
- Multiple hyphens collapsed to single hyphen

---

### 6.4 Theme Selection Visual Feedback

**Seed**: Fresh database

**Steps**:

1. Navigate to onboarding, skip to theme step
2. Verify default theme "phosphor-green" has selection outline
3. Click "neon-pink" theme card
4. Verify "neon-pink" gains selection outline
5. Verify "phosphor-green" loses selection outline
6. Hover over "cyber-blue" theme card
7. Verify hover effect (translateY animation)
8. Press Tab key to focus theme card
9. Verify focus outline appears
10. Press Enter or Space key
11. Verify theme is selected

**Expected Results**:

- Visual feedback for selection state
- Hover effects work
- Keyboard navigation supported
- Accessibility: focus indicators present

---

## Scenario Group 7: Accessibility

### 7.1 Keyboard Navigation

**Seed**: Fresh database

**Steps**:

1. Navigate to onboarding
2. Press Tab key to focus workspace name input
3. Type "Keyboard Test"
4. Press Tab to focus Continue button
5. Press Enter to continue
6. On theme step, Tab to first theme card
7. Press Space to select theme
8. Tab to Continue button, press Enter
9. On settings step, Tab through checkboxes
10. Press Space to toggle checkboxes
11. Tab to Complete Setup, press Enter
12. On API key page, Tab to Copy button
13. Press Enter to copy

**Expected Results**:

- All interactive elements keyboard accessible
- Logical tab order (top to bottom, left to right)
- Enter/Space keys activate buttons and checkboxes
- No keyboard traps

---

### 7.2 Screen Reader Support

**Seed**: Fresh database

**Steps**:

1. Enable screen reader (e.g., NVDA, JAWS, VoiceOver)
2. Navigate to onboarding
3. Verify page has `role="main"` and `aria-label="Setup wizard"`
4. Verify heading hierarchy (h1 → h2)
5. Verify form labels are associated with inputs
6. Verify buttons have descriptive text (not "Click here")
7. Verify progress bar has accessible label
8. Verify error messages have `role="alert"`
9. Verify API key warning has appropriate ARIA attributes

**Expected Results**:

- Semantic HTML structure
- ARIA attributes where needed
- Screen reader announces all important information
- Form labels properly associated

---

### 7.3 High Contrast Mode

**Seed**: Fresh database

**Steps**:

1. Enable high contrast mode (OS-level or browser)
2. Navigate to onboarding
3. Verify theme selection cards have visible outlines
4. Verify selected state is distinguishable
5. Verify button states are clear (enabled vs disabled)
6. Verify warning box border is visible
7. Complete onboarding flow

**Expected Results**:

- All UI elements visible in high contrast
- Selection states distinguishable
- Color is not the only indicator of state

---

## Scenario Group 8: Edge Cases

### 8.1 Very Long Workspace Name

**Seed**: Fresh database

**Steps**:

1. Navigate to onboarding
2. Enter workspace name: "This Is An Extremely Long Workspace Name That Exceeds Reasonable Length Limits And Should Be Handled Gracefully"
3. Verify path auto-generates correctly (may be truncated)
4. Continue through onboarding
5. Verify workspace name displays correctly in API key metadata
6. Verify database stores full name (or truncates predictably)

**Expected Results**:

- Long names handled without errors
- Path generation remains functional
- UI displays long names without breaking layout

---

### 8.2 Special Characters in Workspace Name

**Seed**: Fresh database

**Steps**:

1. Navigate to onboarding
2. Enter workspace name: "Test/Project\\With:Special\*Characters?"
3. Verify auto-generated path sanitizes all special chars
4. Expected path: "/workspace/test-project-with-special-characters"
5. Continue through onboarding
6. Verify workspace created successfully

**Expected Results**:

- All special characters sanitized from path
- Original name preserved in workspace record
- No path traversal vulnerabilities

---

### 8.3 Rapid Form Submission (Double-Click)

**Seed**: Fresh database

**Steps**:

1. Navigate to onboarding
2. Complete all steps to settings form
3. Double-click "Complete Setup" button rapidly
4. Verify only one form submission occurs
5. Verify only one API key is generated
6. Verify loading state prevents second click

**Expected Results**:

- Button disabled during submission
- No duplicate API keys created
- Race condition handled

---

### 8.4 Network Interruption During Submission

**Seed**: Fresh database

**Steps**:

1. Navigate to onboarding
2. Complete all steps to settings form
3. Open browser DevTools → Network tab
4. Simulate offline mode before clicking submit
5. Click "Complete Setup"
6. Verify error handling (network error displayed)
7. Re-enable network
8. Retry submission
9. Verify successful completion

**Expected Results**:

- Network errors caught and displayed
- User can retry after network restored
- No partial database state

---

### 8.5 Browser Back Button During Flow

**Seed**: Fresh database

**Steps**:

1. Navigate to onboarding
2. Complete workspace step: "Back Button Test"
3. Continue to theme step
4. Click browser back button
5. Verify behavior: Either returns to workspace step OR refreshes page
6. If form data lost, verify user can re-enter data
7. Complete onboarding normally

**Expected Results**:

- Browser back button handled gracefully
- No JavaScript errors
- User can navigate back if needed
- Form state may or may not persist (document expected behavior)

---

## Scenario Group 9: Database Integrity

### 9.1 Foreign Key Constraint Validation

**Seed**: Fresh database

**Steps**:

1. Manually attempt to create session without user (via direct DB access)
2. Verify foreign key constraint enforced
3. Complete onboarding normally
4. Verify user created BEFORE session
5. Verify session references valid user_id

**Expected Results**:

- Database enforces referential integrity
- Onboarding creates records in correct order
- No orphaned sessions

---

### 9.2 Onboarding Status Persistence

**Seed**: Fresh database

**Steps**:

1. Complete onboarding successfully
2. Query database: `SELECT value FROM settings WHERE category='system' AND key='onboarding_complete'`
3. Verify value is `true` (or 1)
4. Restart server
5. Navigate to `/onboarding`
6. Verify redirect (onboarding already complete)
7. Query `/api/status`
8. Verify JSON: `{"onboarding":{"isComplete":true}}`

**Expected Results**:

- Onboarding status persists in database
- Server restart does not reset status
- API endpoint returns correct status

---

## Test Execution Notes

### Test Data Management

**Fresh Database Per Test**:

- Each test should start with fresh database
- Server restart creates new temp directories
- No inter-test dependencies

**Test Isolation**:

- Use `beforeEach` hooks to clear localStorage
- Verify clean state before each test
- No shared session cookies between tests

### Timing Considerations

**Bcrypt Operations**:

- API key hashing takes ~100-150ms
- Session ID hashing takes ~100-150ms
- Total onboarding submission: ~300-500ms
- Add generous timeouts for CI environments

**Async State Updates**:

- Theme loading: Async API call
- Cookie propagation: May have delay
- Use `waitForSelector` not fixed `setTimeout`

### Known Flaky Tests

**C-003: Session Cookie Timing**:

- Cookie may not be recognized immediately after setting
- Test may pass locally but fail in CI
- Add `invalidateAll()` call before navigation

**C-002: Theme API Auth**:

- Theme API requires auth but called during onboarding
- Test will fail until `/api/themes` added to PUBLIC_ROUTES

### Debug Helpers

**Enable Debug Logging**:

```javascript
// In test file
test.beforeEach(async ({ page }) => {
	page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
	page.on('pageerror', (err) => console.error('PAGE ERROR:', err));
});
```

**Screenshot on Failure**:

```javascript
test.afterEach(async ({ page }, testInfo) => {
	if (testInfo.status !== testInfo.expectedStatus) {
		await page.screenshot({
			path: `test-results/failure-${testInfo.title}.png`
		});
	}
});
```

---

## Success Criteria

Onboarding E2E tests are considered complete when:

- [ ] All 18 test scenarios pass consistently
- [ ] Happy path (complete flow) works end-to-end
- [ ] All skip paths work correctly
- [ ] Error handling prevents broken states
- [ ] API key security measures validated
- [ ] UI feedback is present and accurate
- [ ] Accessibility requirements met
- [ ] Database integrity maintained
- [ ] Edge cases handled gracefully
- [ ] Tests run reliably in CI/CD

---

## Implementation Priority

### Phase 1: Critical Path (Implement First)

1. Scenario 1.1 - Complete flow with all options
2. Scenario 2.3 - Minimal path (skip both)
3. Scenario 4.2 - Form submission failure
4. Scenario 5.4 - Continue button states

### Phase 2: Core Functionality

5. Scenario 2.1 - Skip workspace
6. Scenario 2.2 - Skip theme
7. Scenario 3.1 - Back button navigation
8. Scenario 5.1 - API key format validation
9. Scenario 5.2 - API key copy functionality

### Phase 3: Error Handling

10. Scenario 4.1 - Theme loading failure
11. Scenario 4.3 - Session cookie failure
12. Scenario 8.3 - Double-click prevention
13. Scenario 8.4 - Network interruption

### Phase 4: UI/UX

14. Scenario 6.1 - Loading states
15. Scenario 6.2 - Copy button feedback
16. Scenario 6.3 - Form field validation
17. Scenario 6.4 - Theme selection feedback

### Phase 5: Accessibility & Edge Cases

18. Scenario 7.1 - Keyboard navigation
19. Scenario 7.2 - Screen reader support
20. Scenario 8.1 - Long workspace names
21. Scenario 8.2 - Special characters

---

## Appendix: Test Utilities

### Helper Functions

```javascript
// Helper: Complete workspace step
async function completeWorkspaceStep(page, name = '') {
	if (name) {
		await page.fill('input[placeholder*="Workspace name"]', name);
		await page.click('button:has-text("Continue")');
	} else {
		await page.click('button:has-text("Skip Workspace")');
	}
}

// Helper: Complete theme step
async function completeThemeStep(page, themeId = null) {
	if (themeId) {
		await page.click(`[data-theme-id="${themeId}"]`);
		await page.click('button:has-text("Continue with Selected Theme")');
	} else {
		await page.click('button:has-text("Skip")');
	}
}

// Helper: Complete settings step
async function completeSettingsStep(page) {
	await page.click('button:has-text("Complete Setup")');
}

// Helper: Full onboarding flow
async function completeOnboarding(page, options = {}) {
	await page.goto('http://localhost:7173/onboarding');
	await completeWorkspaceStep(page, options.workspace);
	await completeThemeStep(page, options.theme);
	await completeSettingsStep(page);

	// Wait for API key display
	await page.waitForSelector('.api-key-text', { timeout: 5000 });

	// Copy key and continue
	await page.click('button:has-text("Copy API Key")');
	await page.click('button:has-text("Continue to Dispatch")');

	// Wait for workspace page
	await page.waitForURL('**/workspace', { timeout: 10000 });
}

// Helper: Verify API key format
function verifyApiKeyFormat(key) {
	expect(key).toMatch(/^dpk_[A-Za-z0-9_-]{43}$/);
	expect(key.length).toBe(47);
}

// Helper: Get database value
async function getDbValue(query) {
	// Implementation depends on database access method
	// May need to use server-side API endpoint
}
```

### Common Assertions

```javascript
// Verify onboarding complete in database
const status = await fetch('http://localhost:7173/api/status').then((r) => r.json());
expect(status.onboarding.isComplete).toBe(true);

// Verify session cookie exists
const cookies = await page.context().cookies();
const sessionCookie = cookies.find((c) => c.name === 'dispatch_session');
expect(sessionCookie).toBeTruthy();

// Verify API key in database
const apiKeys = await fetch('http://localhost:7173/api/keys', {
	headers: { Authorization: 'Bearer test-automation-key-12345' }
}).then((r) => r.json());
expect(apiKeys.length).toBeGreaterThan(0);
```

---

**END OF TEST PLAN**
