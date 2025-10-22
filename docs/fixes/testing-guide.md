# Testing Guide: Terminal Height & Layout Persistence Fixes

## Quick Start

```bash
# Start dev server
npm run dev

# Migration 3 will run automatically on first start
# Look for this in the logs:
# [MIGRATION] Applied migration 3: Enhanced workspace layout - pane configurations and window state
```

## Test 1: Terminal Height Fix ✓

### Manual Testing

1. **Start the dev server and create a terminal session**
   ```bash
   npm run dev
   # Navigate to http://localhost:5173/workspace
   # Create a new terminal session
   ```

2. **Verify terminal fills pane**
   - Terminal should fill entire height of pane
   - No gaps at top or bottom
   - No scrollbars on terminal container

3. **Test pane resizing**
   - Split window vertically (if available in window manager)
   - Drag divider to resize panes
   - Terminal should resize smoothly with pane
   - Content should remain visible and properly sized

4. **Test multiple terminals**
   - Create 2-3 terminal sessions
   - Arrange in different layouts (horizontal/vertical splits)
   - All terminals should fill their panes completely

### Expected Results
✅ Terminal fills 100% of pane height
✅ No gaps or overflow issues
✅ Resizing works smoothly
✅ Multiple terminals all behave correctly

---

## Test 2: Layout Persistence

### Automated Test Workflow

1. **Initial Setup - Create Custom Layout**
   ```bash
   # Start fresh
   npm run dev

   # In browser:
   # 1. Create 3 sessions:
   #    - Terminal session 1
   #    - Terminal session 2
   #    - Claude session
   # 2. Arrange them in a custom layout:
   #    - Split terminal 1 and terminal 2 vertically
   #    - Add Claude session to the right
   ```

2. **Check Auto-Save**
   ```
   # Wait 1 second after creating sessions
   # Check browser console for:
   # [workspace-layout-service] Saving workspace layout
   # [workspace-layout-service] Workspace layout saved successfully

   # Or check network tab for:
   # POST /api/workspaces/[workspace]/layout (200 OK)
   ```

3. **Test Layout Restoration**
   ```
   # Reload the page (Ctrl+R or Cmd+R)

   # Expected:
   # - All 3 sessions restored
   # - Same layout as before (splits preserved)
   # - No duplicate sessions
   # - Proper session types (terminal vs claude)
   ```

4. **Test Session Removal**
   ```
   # Close one session (e.g., Terminal 2)

   # Expected:
   # - Session removed from UI
   # - Layout auto-saves (check console)

   # Reload page
   # Expected:
   # - Only 2 sessions (Terminal 1 and Claude)
   # - Layout still preserved
   ```

5. **Test Fresh Workspace**
   ```
   # Clear all sessions
   # Reload page

   # Expected:
   # - Empty workspace or auto-created terminal
   # - No layout loaded (check console: "No saved layout found")
   ```

### Database Verification

```bash
# Check database schema (migration applied)
sqlite3 .testing-home/dispatch/data/workspace.db "
  SELECT name FROM sqlite_master
  WHERE type='table'
  AND name IN ('workspace_panes', 'workspace_window_state')
"

# Should output:
# workspace_panes
# workspace_window_state

# Check saved layout data
sqlite3 .testing-home/dispatch/data/workspace.db "
  SELECT workspace_path, session_id, session_type
  FROM workspace_panes
"

# Example output:
# /workspace|session-123|pty
# /workspace|session-456|pty
# /workspace|session-789|claude

# Check window state
sqlite3 .testing-home/dispatch/data/workspace.db "
  SELECT workspace_path,
         length(window_state_json) as state_size
  FROM workspace_window_state
"

# Example output:
# /workspace|1234
```

### API Testing

```bash
# Test GET layout endpoint
curl -X GET \
  'http://localhost:5173/api/workspaces/%2Fworkspace/layout' \
  -H 'Cookie: dispatch_session=...' \
  | jq

# Expected response:
# {
#   "workspacePath": "/workspace",
#   "paneConfigs": [
#     {
#       "sessionId": "session-123",
#       "sessionType": "pty",
#       "paneConfig": {},
#       "paneOrder": 0
#     }
#   ],
#   "windowState": { ... },
#   "hasSavedLayout": true
# }

# Test POST layout endpoint
curl -X POST \
  'http://localhost:5173/api/workspaces/%2Fworkspace/layout' \
  -H 'Cookie: dispatch_session=...' \
  -H 'Content-Type: application/json' \
  -d '{
    "paneConfigs": [
      {
        "sessionId": "test-session",
        "sessionType": "pty",
        "paneConfig": {},
        "paneOrder": 0
      }
    ],
    "windowState": {}
  }' | jq

# Expected response:
# {
#   "success": true,
#   "message": "Workspace layout saved successfully",
#   "paneCount": 1
# }

# Test DELETE layout endpoint
curl -X DELETE \
  'http://localhost:5173/api/workspaces/%2Fworkspace/layout' \
  -H 'Cookie: dispatch_session=...' \
  | jq

# Expected response:
# {
#   "success": true,
#   "message": "Workspace layout cleared successfully"
# }
```

---

## Debugging

### Enable Debug Logging

```javascript
// In browser console:
localStorage.setItem('debug', 'workspace-layout-service,workspace:page');

// Reload page to see detailed logs
```

### Check Browser Console

Look for these log messages:

**On Page Load:**
```
[workspace:page] Loading sessions...
[workspace-layout-service] Loading workspace layout for: /workspace
[workspace-layout-service] Workspace layout loaded { paneCount: 3, hasWindowState: true }
[workspace:page] Loaded saved workspace layout { paneCount: 3 }
[workspace:page] BwinHost mounted, adding existing sessions to panes
[workspace:page] Restoring saved workspace layout { paneCount: 3 }
[workspace:page] Added session to pane: session-123 pty {}
```

**On Session Changes:**
```
[workspace:page] Added session to pane: session-456 claude {}
[workspace-layout-service] Saving workspace layout { workspacePath: '/workspace', paneCount: 2, hasWindowState: true }
[workspace-layout-service] Workspace layout saved successfully
[workspace:page] Auto-saved workspace layout
```

### Common Issues

**Issue: Layout not restoring**
```
Check:
1. Is migration 3 applied? (check database schema)
2. Are sessions loading? (check sessionViewModel.sessions)
3. Is savedLayout populated? (check browser console)
4. Is BwinHost mounted? (check bwinHostRef)

Debug:
localStorage.setItem('debug', '*');
Reload and check console logs
```

**Issue: Sessions duplicated**
```
Possible cause: Sessions being added twice
Check: Are sessions being filtered properly?
Look for: Multiple "Added session to pane" logs for same session ID
```

**Issue: Auto-save not triggering**
```
Check:
1. Is getUserDefaultWorkspace() returning a path?
2. Is bwinHostRef available?
3. Are there active sessions?

Debug:
Add console.log in handleLayoutChange()
```

---

## Performance Testing

### Load Test

1. Create 10 sessions
2. Arrange in complex layout
3. Reload page multiple times
4. Measure:
   - Time to restore layout
   - Memory usage
   - No memory leaks

### Stress Test

1. Create/close sessions rapidly
2. Check auto-save doesn't fire excessively
3. Verify debouncing works (1 second delay)

---

## Cleanup

### Reset Database

```bash
# Backup current database
cp .testing-home/dispatch/data/workspace.db .testing-home/dispatch/data/workspace.db.backup

# Clear layout data
sqlite3 .testing-home/dispatch/data/workspace.db "
  DELETE FROM workspace_panes;
  DELETE FROM workspace_window_state;
"

# Or start completely fresh
rm -rf .testing-home/dispatch/data/workspace.db
# Restart server - database will be recreated
```

### Clear Browser Data

```javascript
// Clear saved layout from browser
localStorage.clear();
sessionStorage.clear();

// Hard reload
location.reload(true);
```

---

## Success Criteria

### Terminal Height
- [x] Terminal fills pane completely
- [x] No visual gaps or overflow
- [x] Resizes properly with pane
- [x] Works across different screen sizes

### Layout Persistence
- [x] Layout saves automatically (1s debounce)
- [x] Layout restores on page reload
- [x] Sessions filtered by workspace
- [x] No duplicate sessions
- [x] Session removal updates layout
- [x] Fresh workspace starts clean
- [x] Multiple workspaces have independent layouts

### Code Quality
- [x] No type errors in modified files
- [x] Proper error handling (non-fatal failures)
- [x] Memory leaks prevented (timeout cleanup)
- [x] Logging for debugging
- [x] API follows REST conventions

---

## Next Steps

If all tests pass:
1. ✅ Commit changes with descriptive message
2. ✅ Consider adding E2E tests (Playwright)
3. ✅ Monitor production for layout-related issues
4. ✅ Gather user feedback on UX

If tests fail:
1. Check browser console for errors
2. Verify database migration applied
3. Check API endpoints return correct data
4. Review integration code in WorkspacePage.svelte
