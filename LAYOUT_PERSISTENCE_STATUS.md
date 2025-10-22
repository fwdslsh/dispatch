# Layout Persistence Implementation Status

**Date:** 2025-10-22
**Goal:** Enable workspace layout persistence across page refreshes

---

## ✅ What's Working

### 1. LayoutViewModel Created
- **File:** `src/lib/client/shared/state/LayoutViewModel.svelte.js`
- Simple localStorage-based persistence
- Methods: `saveLayout()`, `loadLayout()`, `clearLayout()`, `extractSessionIds()`
- Svelte 5 runes with `$state` for reactivity

### 2. WorkspacePage Integration
- **File:** `src/lib/client/shared/components/workspace/WorkspacePage.svelte`
- LayoutViewModel initialized in `onMount`
- Layout saves on:
  - Session creation (`handleSessionCreate`)
  - Session close (`handleSessionClose`)
  - Window beforeunload (backup)
- Layout loads on page mount

### 3. Layout Saves to localStorage
- ✅ Confirmed via browser DevTools
- Key: `dispatch-workspace-layout`
- Contains BwinHost tree structure with pane positions and sizes

---

## ❌ What's Broken

### Critical Issue: Session IDs Not Stored in Layout

**Problem:** BwinHost's `getInfo()` returns internal pane structure but **does not include which session is in which pane**.

**Evidence:**
```javascript
// What we get from bwinHostRef.getInfo():
{
  "id": "NY-840",  // BwinHost's internal pane ID
  "position": "root",
  "children": [
    {
      "id": "HL-097",  // Another internal ID
      "position": "left",
      "children": [],
      // ❌ NO content field
      // ❌ NO session ID
    },
    {
      "id": "YR-199",
      "position": "right",
      "children": []
    }
  ]
}
```

**What we need:**
```javascript
{
  "position": "root",
  "children": [
    {
      "position": "left",
      "content": "pty-1761109631782-pfhkmmejc"  // ✅ Session ID here
    },
    {
      "position": "right",
      "content": "pty-1761109632123-xyzabc"  // ✅ Session ID here
    }
  ]
}
```

### Root Cause Analysis

1. **BwinHost API Mismatch:**
   - We call `bwinHostRef.addPane(sessionId, paneConfig, component, props)`
   - We expect sessionId to become the pane ID
   - BwinHost generates its own internal IDs instead ("HL-097", "YR-199")
   - The `getInfo()` method returns these internal IDs, not our session IDs

2. **No Content Mapping:**
   - BwinHost's `getInfo()` returns pane structure (positions, sizes)
   - But it doesn't return what **content** is in each pane
   - The `content` field in the returned config is always missing

3. **Session Restoration Fails:**
   - On page load, `extractSessionIds(layoutConfig)` returns empty array
   - No sessions are restored because there are no session IDs in the layout
   - User sees empty workspace after refresh

---

## 🔧 Solutions to Explore

### Option 1: Maintain Separate Session-to-Pane Mapping
**Approach:** Track which session is in which pane ourselves

```javascript
// In WorkspacePage.svelte
let sessionToPaneMap = $state(new Map()); // sessionId -> paneId

function addSessionToPane(session, paneConfig = {}) {
    const paneId = generatePaneId(); // Or use BwinHost's ID
    bwinHostRef.addPane(paneId, paneConfig, component, props);
    sessionToPaneMap.set(session.id, paneId);
}

function saveLayout() {
    const bwinConfig = bwinHostRef.getInfo();
    const layoutWithSessions = {
        ...bwinConfig,
        sessionMap: Object.fromEntries(sessionToPaneMap)
    };
    layoutViewModel.saveLayout(layoutWithSessions);
}
```

### Option 2: Use BwinHost's Store Feature
Looking at the layout, each pane has a `store: {}` field. Investigate if we can use this to store session IDs:

```javascript
bwinHostRef.addPane(
    session.id,
    {
        ...paneConfig,
        store: { sessionId: session.id }  // ✅ Store session ID in pane
    },
    component,
    props
);
```

### Option 3: Check BwinHost Documentation
- Review sv-window-manager documentation for proper content association
- Check if there's a method to get pane-to-content mapping
- Verify if `addPane()` signature supports session ID preservation

### Option 4: Custom Layout Format
**Simplest approach:** Don't use BwinHost's `getInfo()` directly. Build our own layout format:

```javascript
function saveLayout() {
    const customLayout = {
        splits: [], // Save split positions and orientations
        sessions: Array.from(openPaneIds), // Session IDs in order
        panePositions: {} // Map session ID to position in grid
    };
    layoutViewModel.saveLayout(customLayout);
}

function restoreLayout(layout) {
    // Recreate splits
    // Add sessions to panes in saved order
}
```

---

## 📋 Next Steps

1. **Investigate BwinHost `store` property** - Can we use it to persist session IDs?
2. **Test pane ID preservation** - Does BwinHost use the ID we provide in `addPane()`?
3. **Implement Session-to-Pane mapping** - Track association separately
4. **Update save/restore logic** - Include session mapping in saved layout
5. **Test end-to-end** - Verify sessions restore to correct positions after refresh

---

## 🧪 Test Results

### Test 1: Create Two Sessions
- ✅ Two terminal sessions created
- ✅ Split horizontally (left/right)
- ✅ Layout saved to localStorage
- ✅ Console shows: "Layout saved to localStorage"

### Test 2: Refresh Page
- ❌ Sessions not restored
- ❌ Empty workspace displayed
- ❌ Layout structure not applied (no splits visible)
- ❌ `extractSessionIds()` returns empty array

**Conclusion:** Layout persistence is **NOT working**. Session IDs are not being stored or retrieved.

---

## 📊 Impact Assessment

**Current User Experience:**
- Sessions lost on page refresh ❌
- Manual recreation required ❌
- No layout persistence ❌

**Expected User Experience:**
- Sessions persist across refreshes ✅
- Layout (splits, positions) restored ✅
- Seamless workspace continuity ✅

**Gap:** Complete feature failure - layout persistence does not work at all.

---

## 🎯 Recommended Fix

**Quick Win:** Implement Option 1 (Session-to-Pane Mapping)

1. Add `sessionToPaneMap` state to WorkspacePage
2. Update `addSessionToPane()` to record mapping
3. Update `saveLayout()` to include session mapping
4. Update `restoreLayout()` to recreate sessions in panes
5. Test and verify

**Estimated Effort:** 1-2 hours
**Risk:** Low - isolated change, doesn't modify BwinHost

---

