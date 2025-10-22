# Agent: Layout ViewModel Designer

## Your Mission

Create a **LayoutViewModel** that manages BwinHost layout persistence using localStorage.

## Requirements

### 1. Simple State Management

```javascript
export class LayoutViewModel {
    constructor() {
        this.layoutConfig = $state(null);
        this.isRestoring = $state(false);
    }
}
```

### 2. Core Methods

**saveLayout(layoutConfig)**
- Takes BwinHost config object from `bwinHost.getInfo()`
- Saves to localStorage key: `dispatch-workspace-layout`
- Handles errors gracefully

**loadLayout()**
- Reads from localStorage key: `dispatch-workspace-layout`
- Returns parsed config or null
- Handles corrupt JSON gracefully

**clearLayout()**
- Removes localStorage key
- Clears internal state

### 3. BwinHost Config Format

The layout config from `bwinHostRef.getInfo()` looks like:

```json
{
  "position": "left",
  "size": 200,
  "children": [
    {
      "position": "top",
      "size": 0.4,
      "content": "session-abc-123"
    },
    {
      "position": "bottom",
      "size": "60%",
      "content": "session-def-456"
    }
  ]
}
```

**Session IDs are in the `content` field** - you need to extract these to know which sessions to restore.

### 4. Helper Method

**extractSessionIds(layoutConfig)**
- Recursively walks the tree
- Collects all `content` values (these are session IDs)
- Returns array of session IDs

## File to Create

`/home/founder3/code/github/fwdslsh/dispatch/src/lib/client/shared/state/LayoutViewModel.svelte.js`

## Key Principles

- **Keep it simple** - Just save/load JSON from localStorage
- **No complex dependencies** - This is a pure state manager
- **Graceful error handling** - Never crash on corrupt data
- **Svelte 5 runes** - Use $state for reactivity

## Example Usage

```javascript
// In WorkspacePage.svelte
const layoutViewModel = new LayoutViewModel();

// Save when layout changes
function handleLayoutChange() {
    const config = bwinHostRef.getInfo();
    layoutViewModel.saveLayout(config);
}

// Load on mount
onMount(() => {
    const config = layoutViewModel.loadLayout();
    if (config) {
        // Restore layout
    }
});
```

## Success Criteria

- ✅ Saves layout config to localStorage
- ✅ Loads layout config from localStorage
- ✅ Extracts session IDs from config tree
- ✅ Handles errors without crashing
- ✅ Uses Svelte 5 $state runes
- ✅ No external dependencies (pure state management)

## DO NOT

- ❌ Add database calls (use localStorage only)
- ❌ Add workspace filtering
- ❌ Add complex validation
- ❌ Add API clients
- ❌ Make it complicated

**Keep it simple. This is just localStorage + JSON.**
