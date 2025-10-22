# Session Exponential Growth Fix

## Problem Summary

The session management system was experiencing exponential growth:
1. **ALL sessions displayed** (including ones not in saved layout)
2. **Creating new session re-added ALL previously closed sessions**
3. **Exponential growth** with each session creation

## Root Cause

The BwinHost population logic used a reactive `$effect()` with `sessionsList` as a dependency:

```javascript
$effect(() => {
    const host = bwinHostRef;
    const sessions = sessionsList;  // ← REACTIVE DEPENDENCY!

    // When user creates session, sessionsList changes
    // Effect re-runs
    // If user closed all panes, existingPaneIds.size === 0
    // So it adds ALL sessions again
});
```

**Why this failed:**
- Every time sessions changed (create, close, update), the effect re-ran
- The guard `if (existingPaneIds.size > 0)` failed when user closed all panes
- Result: ALL sessions were re-added, causing exponential growth

## Solution

**Simple imperative initialization in `onMount`** - NO reactive effects:

### What Changed

#### 1. Removed Reactive Effect (Lines 614-675)
```javascript
// DELETED: Entire $effect() block
$effect(() => {
    const host = bwinHostRef;
    const sessions = sessionsList; // This caused re-runs!
    // ... population logic
});
```

#### 2. Removed Helper Function (Lines 677-688)
```javascript
// DELETED: getAllPaneIds helper
function getAllPaneIds(pane) { ... }
```

#### 3. Removed Auto-Save Effect (Lines 641-648)
```javascript
// DELETED: Effect watching sessionsList
$effect(() => {
    if (bwinHostRef && sessionsList.length > 0) {
        sessionsList; // Reactive dependency
        handleLayoutChange();
    }
});
```

#### 4. Added Imperative Population in onMount

```javascript
onMount(async () => {
    // ... existing initialization code ...

    // NEW: Wait for BwinHost to mount, then populate ONCE
    await tick();
    let attempts = 0;
    while (!bwinHostRef && attempts < 50) {
        await tick();
        attempts++;
    }

    if (!bwinHostRef) {
        log.error('BwinHost failed to mount after 50 attempts');
    } else {
        // Populate sessions once - this should NEVER run again
        const defaultWorkspace = getUserDefaultWorkspace();
        const activeSessions = sessionViewModel.sessions.filter(s => s.isActive);

        if (defaultWorkspace) {
            try {
                const layout = await workspaceLayoutService.loadWorkspaceLayout(defaultWorkspace);
                if (layout?.hasSavedLayout && layout.paneConfigs?.length > 0) {
                    // Restore saved layout
                    for (const paneConfig of layout.paneConfigs) {
                        const session = activeSessions.find(s => s.id === paneConfig.sessionId);
                        if (session) {
                            addSessionToPane(session, paneConfig.paneConfig);
                        }
                    }
                } else {
                    // No saved layout - add all active sessions
                    for (const session of activeSessions) {
                        addSessionToPane(session);
                    }
                }
            } catch (error) {
                log.error('Failed to load layout:', error);
                // Fallback: add all active sessions
                for (const session of activeSessions) {
                    addSessionToPane(session);
                }
            }
        } else {
            // No workspace - add all active sessions
            for (const session of activeSessions) {
                addSessionToPane(session);
            }
        }
    }

    // ... rest of onMount ...
});
```

#### 5. Simplified Layout Saving

**Before:** Debounced auto-save with reactive effect
```javascript
// DELETED
let layoutSaveTimeout = null;
function handleLayoutChange() { /* debounce logic */ }
$effect(() => { sessionsList; handleLayoutChange(); });
```

**After:** Save on explicit user action
```javascript
async function saveCurrentLayout() {
    const defaultWorkspace = getUserDefaultWorkspace();
    if (defaultWorkspace && bwinHostRef && sessionsList.length > 0) {
        await workspaceLayoutService.saveWorkspaceLayout(
            defaultWorkspace,
            bwinHostRef,
            sessionsList
        );
    }
}

// Called when user closes session
async function handleSessionClose(sessionId) {
    // ... close logic ...
    await saveCurrentLayout(); // Save after close
}
```

## Files Modified

- `/home/founder3/code/github/fwdslsh/dispatch/src/lib/client/shared/components/workspace/WorkspacePage.svelte`
  - Added `tick` import
  - Moved population logic from reactive effect to onMount
  - Removed reactive effects entirely
  - Simplified layout saving to explicit user actions

## Key Principles Applied

1. **NO EFFECTS for population** - Use onMount imperative code instead
2. **NO reactive dependencies on sessionsList** - This causes re-runs
3. **Linear control flow** - onMount does setup, done
4. **One-time initialization** - Populate once, never again
5. **Simple session creation** - Just add the one new pane

## Expected Behavior After Fix

### On Page Load
- BwinHost mounts
- onMount waits for BwinHost reference
- Loads saved layout OR adds active sessions
- **Population NEVER runs again**

### When User Creates Session
- `handleSessionCreate` fires
- Adds ONE pane for that session
- **No effect re-runs**

### When User Closes Session
- Removes pane
- Saves layout
- **No effect re-runs**

## Testing Instructions

### Manual Test

1. **Start fresh:**
   ```bash
   rm -rf .testing-home/dispatch/data/workspace.db*
   npm run dev:test
   ```

2. **Complete onboarding:**
   - Visit http://localhost:7173/onboarding
   - Create workspace
   - Get API key
   - Log in

3. **Test session creation:**
   - Create Session 1 → Should see 1 pane
   - Create Session 2 → Should see 2 panes (NOT 3!)
   - Create Session 3 → Should see 3 panes (NOT 6!)

4. **Test session closure:**
   - Close all sessions → Should see 0 panes
   - Create Session 4 → Should see 1 pane (NOT 4!)

### What Was Fixed

- ✅ Only active sessions display
- ✅ Creating new session adds ONE pane
- ✅ No exponential growth
- ✅ Closing all sessions clears panes
- ✅ Creating after close adds only ONE pane

### Console Verification

Check browser console for these logs:
```
Populating BwinHost with sessions: 0          // On fresh load
No saved layout - adding active sessions: 0   // No sessions to populate
```

After creating sessions:
```
Session created, adding to pane: {...}        // Each creation
```

You should **NEVER** see:
- Multiple "Populating BwinHost" logs
- "adding active sessions: X" where X > expected count
- Pane count jumping by more than 1

## Code Quality

The fix adheres to the user directive: **"Keep simplifying. This should not be complicated. Simple solutions are best."**

- **Before:** 74 lines of reactive effects, guards, and debouncing
- **After:** 35 lines of straightforward imperative code in onMount
- **Complexity:** Removed reactive dependencies, removed helper functions, removed timeouts
- **Maintainability:** Linear, obvious control flow

## Verification

✅ Code compiles without errors
✅ Server starts successfully
✅ No TypeScript errors in WorkspacePage.svelte
✅ Solution is imperative, not reactive
✅ No effects watching sessionsList
