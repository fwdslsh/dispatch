# Agent: WorkspacePage Refactor

## Your Mission

Refactor `WorkspacePage.svelte` to use LayoutViewModel and make layout persistence **actually work**.

## The Problem

Current code has broken layout persistence:

```javascript
// Line 542-554 - This DOES NOT WORK
$effect(() => {
    const paneCount = openPaneIds.size;  // ← This only tracks pane count changes!
    // Doesn't detect BwinHost internal layout changes (splits, resizes, positions)

    if (!bwinHostRef || paneCount === 0) return;

    const layoutConfig = bwinHostRef.getInfo?.();
    if (!layoutConfig) return;

    saveLayout(layoutConfig);  // Never called when layout actually changes!
});
```

**Why it's broken:**
- `openPaneIds.size` only changes when panes are added/removed
- Does NOT track when user splits, resizes, or repositions panes
- BwinHost internal state changes don't trigger this effect

## The Solution

### 1. Add LayoutViewModel

```javascript
import { LayoutViewModel } from '$lib/client/shared/state/LayoutViewModel.svelte.js';

let layoutViewModel = $state(null);

onMount(() => {
    layoutViewModel = new LayoutViewModel();
    // ... rest of init
});
```

### 2. Fix Layout Save - Save on User Actions

BwinHost doesn't emit layout change events, so we need to save on explicit user actions:

**Save on session close:**
```javascript
async function handleSessionClose(sessionId) {
    const currentIndex = allSessions.findIndex((session) => session.id === sessionId);
    const fallbackSession = allSessions[currentIndex + 1] ?? allSessions[currentIndex - 1] ?? null;

    removeSessionPane(sessionId);
    await sessionViewModel.closeSession(sessionId);

    // Save layout after closing session
    if (bwinHostRef) {
        const config = bwinHostRef.getInfo();
        layoutViewModel.saveLayout(config);
    }

    if (sessionId === activeSessionId) {
        updateActiveSession(fallbackSession?.id ?? null);
    }
}
```

**Save on session create:**
```javascript
function handleSessionCreate(detail) {
    const { id, type, workspacePath } = detail;
    if (!id || !type || !workspacePath) return;

    const session = sessionViewModel.getSession(id);
    if (!session) return;

    addSessionToPane(session);
    updateActiveSession(id);

    // Save layout after adding session
    if (bwinHostRef) {
        const config = bwinHostRef.getInfo();
        layoutViewModel.saveLayout(config);
    }

    if (activeModal?.type === 'createSession') {
        activeModal = null;
    }
}
```

**Save on window unload (backup):**
```javascript
onMount(() => {
    // ... existing init code ...

    // Save layout before page unload
    const handleBeforeUnload = () => {
        if (bwinHostRef) {
            const config = bwinHostRef.getInfo();
            layoutViewModel.saveLayout(config);
        }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
});
```

### 3. Fix Layout Load

```javascript
onMount(async () => {
    // ... existing init code ...

    layoutViewModel = new LayoutViewModel();

    // Load saved layout
    const savedConfig = layoutViewModel.loadLayout();
    if (savedConfig) {
        savedLayoutConfig = savedConfig;
        log.info('Loaded saved layout');
    }

    // ... rest of init
});
```

### 4. Fix Layout Restore

The existing restore logic (lines 501-519) is actually OK, but uses `savedLayoutConfig`:

```javascript
$effect(() => {
    if (!bwinHostRef || !savedLayoutConfig || !sessionViewModel) return;

    const sessionIds = layoutViewModel.extractSessionIds(savedLayoutConfig);

    sessionIds.forEach(sessionId => {
        const session = sessionViewModel.getSession(sessionId);
        if (session && !openPaneIds.has(sessionId)) {
            addSessionToPane(session);
        }
    });

    savedLayoutConfig = null;
});
```

### 5. Remove Old Code

Delete these broken functions:
- `loadLayout()` (lines 56-64) - replaced by LayoutViewModel
- `saveLayout()` (lines 66-72) - replaced by LayoutViewModel
- The broken $effect (lines 542-554)
- `extractSessionIdsFromConfig()` (lines 522-539) - moved to LayoutViewModel

## Files to Modify

`/home/founder3/code/github/fwdslsh/dispatch/src/lib/client/shared/components/workspace/WorkspacePage.svelte`

## Key Changes

1. **Import LayoutViewModel** at top
2. **Initialize in onMount**
3. **Remove broken localStorage functions**
4. **Fix save trigger** - find BwinHost events or use explicit triggers
5. **Use LayoutViewModel methods** instead of local functions

## Testing Requirements

After changes, you MUST test:

1. Start dev server: `npm run dev:test`
2. Create 2 sessions
3. Split them horizontally
4. Check console - should see "Saved layout" or similar
5. **Refresh page**
6. **VERIFY** sessions are in same positions (split horizontally)
7. If NOT working, **debug and fix before saying you're done**

## DO NOT

- ❌ Just say "it should work" without testing
- ❌ Leave broken code
- ❌ Add complex workspace logic
- ❌ Use database APIs (localStorage only)

## Success Criteria

- ✅ Layout saves when it changes (not just when panes added/removed)
- ✅ Layout loads on page refresh
- ✅ Sessions restore to same positions
- ✅ **ACTUALLY TESTED and verified working**
- ✅ Old broken code removed
- ✅ Clean, simple implementation

**Make it work. Test it. Don't just assume.**
