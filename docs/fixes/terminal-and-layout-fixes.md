# Terminal Height and Workspace Layout Fixes

## Overview

This document describes two critical fixes implemented for the Dispatch application:

1. **Terminal height not filling pane** - CSS flexbox issue preventing terminal from expanding
2. **Workspace layout persistence not working** - Missing infrastructure to save/restore window manager state

## Fix 1: Terminal Height Issue

### Problem
The terminal component was not expanding to fill the full height of its container pane in the binary window manager.

### Root Cause
The `.terminal-container` and `.xterm-container` CSS classes were missing explicit layout properties:
- No `display: flex` on `.terminal-container`
- Missing `height: 100%` on both containers
- Incorrect `overflow` setting preventing proper flex behavior

### Solution
Updated `/src/lib/client/terminal/TerminalPane.svelte` (lines 221-238):

```css
.terminal-container {
    display: flex;           /* Added */
    flex-direction: column;  /* Added */
    flex: 1;
    width: 100%;
    height: 100%;           /* Added */
    min-height: 0;
    overflow: hidden;       /* Changed from auto */
    position: relative;
}

.xterm-container {
    display: flex;          /* Added */
    flex: 1;
    width: 100%;
    height: 100%;          /* Added */
    min-height: 0;
}
```

### Testing
Test the fix by:
1. Creating a terminal session
2. Resizing the pane (drag dividers)
3. Verify terminal fills the entire pane height
4. Check multiple terminal panes in different layouts

## Fix 2: Workspace Layout Persistence

### Problem
When loading a workspace, the application:
- Loaded multiple sessions that shouldn't be included
- Lost window manager pane configurations
- Couldn't restore layout properly

### Root Cause
The `workspace_layout` table only stored `tile_id`, not full pane configurations. The system had no way to:
- Track which sessions belong to which workspace
- Store pane configurations (position, size, etc.)
- Export/restore BwinHost window manager state

### Solution Architecture

#### 1. Database Schema (Migration 3)
Created two new tables in `/src/lib/server/shared/db/migrate.js`:

**workspace_panes** - Stores individual pane configurations:
```sql
CREATE TABLE workspace_panes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_path TEXT NOT NULL,
    session_id TEXT NOT NULL,
    session_type TEXT NOT NULL,
    pane_config_json TEXT,
    pane_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_path) REFERENCES workspaces(path) ON DELETE CASCADE,
    UNIQUE(workspace_path, session_id)
)
```

**workspace_window_state** - Stores complete BwinHost state:
```sql
CREATE TABLE workspace_window_state (
    workspace_path TEXT PRIMARY KEY,
    window_state_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (workspace_path) REFERENCES workspaces(path) ON DELETE CASCADE
)
```

#### 2. Repository Methods
Added to `/src/lib/server/database/WorkspaceRepository.js`:

- `savePaneConfig(workspacePath, sessionId, sessionType, paneConfig, paneOrder)`
- `getPaneConfigs(workspacePath)` - Returns array of pane configs
- `removePaneConfig(workspacePath, sessionId)`
- `clearPaneConfigs(workspacePath)`
- `saveWindowState(workspacePath, windowState)`
- `getWindowState(workspacePath)` - Returns BwinHost state
- `clearWindowState(workspacePath)`

#### 3. API Endpoints
Created `/src/routes/api/workspaces/[workspaceId]/layout/+server.js`:

**GET /api/workspaces/:workspaceId/layout**
- Returns saved pane configurations and window state
- Response: `{ workspacePath, paneConfigs: [...], windowState: {...}, hasSavedLayout: boolean }`

**POST /api/workspaces/:workspaceId/layout**
- Saves workspace layout
- Body: `{ paneConfigs: [...], windowState: {...} }`
- Clears existing configs before saving

**DELETE /api/workspaces/:workspaceId/layout**
- Clears all layout data for workspace

### Integration Steps

To complete the fix, integrate into `WorkspacePage.svelte`:

#### Step 1: Add Layout Service Methods

Create client-side service in `WorkspaceState.svelte.js` or a new `WorkspaceLayoutService.js`:

```javascript
// Save current layout
async function saveWorkspaceLayout(workspacePath, bwinHostRef, sessionsList) {
    if (!bwinHostRef || !workspacePath) return;

    // Get BwinHost state
    const windowState = bwinHostRef.getInfo();

    // Build pane configs from current sessions
    const paneConfigs = sessionsList
        .filter(s => s.isActive)
        .map((session, index) => ({
            sessionId: session.id,
            sessionType: session.type,
            paneConfig: {}, // Could extract from windowState if needed
            paneOrder: index
        }));

    // Save via API
    const response = await fetch(`/api/workspaces/${encodeURIComponent(workspacePath)}/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paneConfigs, windowState })
    });

    if (!response.ok) {
        throw new Error('Failed to save workspace layout');
    }

    return await response.json();
}

// Load saved layout
async function loadWorkspaceLayout(workspacePath) {
    const response = await fetch(`/api/workspaces/${encodeURIComponent(workspacePath)}/layout`, {
        credentials: 'include'
    });

    if (!response.ok) {
        if (response.status === 404) return null; // No saved layout
        throw new Error('Failed to load workspace layout');
    }

    return await response.json();
}
```

#### Step 2: Modify WorkspacePage.svelte

Update the component to save/restore layouts:

```javascript
// In onMount, after sessionViewModel loads
onMount(async () => {
    // ... existing code ...

    // Load sessions
    await sessionViewModel.loadSessions();

    // Load saved layout for default workspace
    const defaultWorkspace = getUserDefaultWorkspace();
    if (defaultWorkspace) {
        try {
            const savedLayout = await loadWorkspaceLayout(defaultWorkspace);
            if (savedLayout?.hasSavedLayout) {
                // Store for restoration after BwinHost mounts
                workspaceState.savedLayout = savedLayout;
            }
        } catch (error) {
            log.error('Failed to load saved workspace layout:', error);
        }
    }
});

// Update the BwinHost mount effect
$effect(() => {
    if (!bwinHostRef) return;

    // Check if we have a saved layout to restore
    const savedLayout = workspaceState.savedLayout;

    if (savedLayout?.paneConfigs?.length > 0) {
        log.info('Restoring saved workspace layout');

        // Restore panes in saved order
        for (const paneConfig of savedLayout.paneConfigs) {
            const session = sessionsList.find(s => s.id === paneConfig.sessionId);
            if (session && session.isActive) {
                addSessionToPane(session, paneConfig.paneConfig);
            }
        }

        // Clear saved layout
        workspaceState.savedLayout = null;
    } else {
        // No saved layout - add sessions as before
        for (const session of sessionsList) {
            if (session && session.isActive) {
                addSessionToPane(session);
            }
        }
    }
});

// Update addSessionToPane to accept paneConfig parameter
function addSessionToPane(session, paneConfig = {}) {
    if (!bwinHostRef || !session?.id || !session?.sessionType) return;

    const component = getComponentForSessionType(session.sessionType);
    if (!component) {
        log.error('No component found for session type:', session.sessionType);
        return;
    }

    const module = getClientSessionModule(session.type);
    const props = module?.prepareProps ? module.prepareProps(session) : { sessionId: session.id };

    try {
        bwinHostRef.addPane(
            session.id,
            paneConfig, // Use saved config instead of {}
            component,
            props
        );
        log.info('Added session to pane:', session.id, session.type, paneConfig);
    } catch (error) {
        log.error('Failed to add pane for session:', session.id, error);
    }
}

// Add auto-save on layout changes
function handleLayoutChange() {
    // Debounce to avoid excessive saves
    clearTimeout(layoutSaveTimeout);
    layoutSaveTimeout = setTimeout(async () => {
        const defaultWorkspace = getUserDefaultWorkspace();
        if (defaultWorkspace && bwinHostRef) {
            try {
                await saveWorkspaceLayout(defaultWorkspace, bwinHostRef, sessionsList);
                log.info('Auto-saved workspace layout');
            } catch (error) {
                log.error('Failed to auto-save layout:', error);
            }
        }
    }, 1000); // Save 1 second after last change
}

// Add effect to watch for layout changes
$effect(() => {
    // Trigger save when sessions change
    sessionsList; // Reactive dependency
    handleLayoutChange();
});
```

#### Step 3: Handle Session Filtering

Update `sessionViewModel.loadSessions()` to filter by workspace:

```javascript
// In SessionViewModel or WorkspaceState
async loadSessions(workspacePath = null) {
    const response = await fetch('/api/sessions');
    const data = await response.json();

    let sessions = data.sessions || [];

    // Filter by workspace if specified
    if (workspacePath) {
        sessions = sessions.filter(s => s.workspacePath === workspacePath);
    }

    this.sessions = sessions;
}
```

### Migration Path

1. **Run database migration** - Migration 3 will be applied automatically on next server start
2. **Update WorkspacePage** - Integrate layout save/restore as described above
3. **Test thoroughly**:
   - Create multiple sessions in different pane configurations
   - Reload the page - verify layout is restored
   - Switch workspaces - verify each has independent layout
   - Delete sessions - verify layout is updated

### Benefits

- ✅ Workspace layouts persist across page reloads
- ✅ Each workspace has independent pane configuration
- ✅ Window manager state is fully preserved
- ✅ Sessions are properly filtered by workspace
- ✅ Clean separation of concerns (database, API, UI)

### Testing Checklist

**Terminal Height:**
- [ ] Single terminal fills pane completely
- [ ] Multiple terminals in split panes all fill properly
- [ ] Terminal resizes correctly when pane is resized
- [ ] Works on different screen sizes/resolutions

**Layout Persistence:**
- [ ] Create 3 sessions (2 terminals, 1 claude)
- [ ] Arrange in custom layout (split horizontally/vertically)
- [ ] Reload page - verify same layout is restored
- [ ] Close a session - verify layout updates
- [ ] Create new workspace - verify clean slate
- [ ] Return to first workspace - verify layout still persisted

### Future Enhancements

1. **Per-workspace session management** - Associate sessions directly with workspaces in database
2. **Layout templates** - Save/load named layout configurations
3. **Import/export** - Share workspace layouts between users
4. **Migration tool** - Bulk migrate old workspace_layout records to new schema

## Files Modified

### Terminal Fix
- `/src/lib/client/terminal/TerminalPane.svelte` - CSS updates

### Layout Persistence
- `/src/lib/server/shared/db/migrate.js` - Migration 3
- `/src/lib/server/database/WorkspaceRepository.js` - Repository methods
- `/src/routes/api/workspaces/[workspaceId]/layout/+server.js` - API endpoints (new file)

### Integration Required
- `/src/lib/client/shared/components/workspace/WorkspacePage.svelte` - Layout save/restore
- `/src/lib/client/shared/state/WorkspaceState.svelte.js` - State management (optional)

## References

- [BwinJS Documentation](https://bhjsdev.github.io/bwin-docs/)
- [sv-window-manager README](node_modules/sv-window-manager/README.md)
- [Database Schema Reference](docs/reference/database-schema.md)
- [API Routes Reference](docs/reference/api-routes.md)
