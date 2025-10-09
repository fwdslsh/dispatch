# Dispatch Application - Comprehensive Test Plan

## Executive Summary

**Dispatch** is a containerized web application providing interactive terminal sessions via browser. Built with SvelteKit, Socket.IO, and node-pty, it enables Claude Code sessions, terminal access, and file editing in isolated environments.

### Application Architecture

- **Frontend**: SvelteKit 2.x + Svelte 5 (runes-based MVVM architecture)
- **Real-time**: Socket.IO 4.8.x for WebSocket communication
- **Backend**: Node.js 22+, SQLite database
- **Session Types**: PTY (terminal), Claude Code, File Editor
- **Key Features**: Workspace management, event sourcing, multi-client sync, theme management

### Test Server Configuration

- **Start**: `TERMINAL_KEY='test-automation-key-12345' HOME=\"$(mktemp -d /tmp/dispatch-test-home.XXXXXX)\" WORKSPACES_ROOT=\"$(mktemp -d /tmp/dispatch-test-workspaces.XXXXXX)\" SSL_ENABLED=false vite dev --host --port 7173`
- **Base URL**: `http://localhost:7173`
- **Authentication Key**: `test-automation-key-12345`
- **No SSL**: Optimized for automated testing
- **Fresh State**: Uses temporary directories in `/tmp`
- **Auto Onboard**: Send the following API request to complete initial setup of the application
  ```
  POST /api/settings/onboard
  {
    terminalKey: 'test-automation-key-12345'
  }
  ```

### Authentication Setup

Tests must inject authentication into localStorage before navigation to bypass login screen:

```javascript
await page.evaluate(() => {
  localStorage.setItem('dispatch-auth-token', 'test-automation-key-12345');
  localStorage.setItem('authSessionId', 'test-session-' + Date.now());
  localStorage.setItem('authExpiresAt', new Date(Date.now() + 30*24*60*60*1000).toISOString());
});
```

---

## Test Organization

### Priority Levels

- **P0 (Critical)**: Core functionality required for application to work
- **P1 (High)**: Major features used frequently
- **P2 (Medium)**: Important features with workarounds available
- **P3 (Low)**: Nice-to-have features, edge cases

### Test Categories

1. Authentication & Authorization
2. Session Management (PTY, Claude, File Editor)
3. Workspace Management
4. Real-time Communication (Socket.IO)
5. File Operations
6. Git Operations
7. Settings Management
8. Theme Management
9. UI/UX & Navigation
10. Error Handling & Edge Cases
11. Performance & Scalability
12. Cross-browser Compatibility

---

## 1. Authentication & Authorization

### 1.1 Login Flow - Terminal Key Authentication (P0)

**Seed:** `e2e/seed.spec.ts`

**Prerequisites:**
- Server running on `http://localhost:7173`
- Onboarding has been completed
- No authentication in localStorage

#### 1.1.1 Successful Login with Valid Key

**Steps:**
1. Navigate to `http://localhost:7173`
2. Wait for login form to load
3. Enter terminal key: `test-automation-key-12345` in password field
4. Click "connect" button
5. Wait for redirect

**Expected Results:**
- Login form accepts input
- Button text changes to "connecting..." during auth
- Redirect to `/workspace` occurs
- Authentication token stored in localStorage
- Session ID generated and stored

#### 1.1.2 Failed Login with Invalid Key

**Steps:**
1. Navigate to `http://localhost:7173`
2. Enter invalid key: `invalid-key-123`
3. Click "connect" button
4. Wait for error message

**Expected Results:**
- Error message displayed: "Invalid key" or similar
- User remains on login page
- No token stored in localStorage
- Form remains interactive (not disabled)

#### 1.1.3 Login with Empty Key

**Steps:**
1. Navigate to `http://localhost:7173`
2. Leave terminal key field empty
3. Attempt to submit form

**Expected Results:**
- HTML5 validation prevents submission
- Required field error shown
- No API call made

### 1.2 OAuth Authentication (P1)

**Prerequisites:**
- OAuth provider configured on server
- GitHub OAuth app configured

#### 1.2.1 OAuth Login Flow

**Steps:**
1. Navigate to login page
2. Verify "Sign in with GitHub" button visible
3. Click OAuth button
4. Observe redirect behavior

**Expected Results:**
- GitHub OAuth button visible and enabled
- Clicking initiates OAuth flow
- Proper redirect to GitHub authorization page
- (Note: Full OAuth testing requires mock provider)

### 1.3 Session Persistence (P0)

#### 1.3.1 Session Survives Page Reload

**Steps:**
1. Login successfully
2. Navigate to `/workspace`
3. Reload page (F5)
4. Observe authentication state

**Expected Results:**
- User remains authenticated
- No redirect to login page
- Workspace loads normally
- localStorage maintains auth token

#### 1.3.2 Session Expiration Handling

**Steps:**
1. Login successfully
2. Manually set `authExpiresAt` to past date in localStorage
3. Reload page

**Expected Results:**
- User redirected to login page
- Auth token cleared from localStorage
- Appropriate expiration message shown

### 1.4 Pre-authenticated Access (P0)

#### 1.4.1 Direct Navigation with Auth Token

**Steps:**
1. Inject valid auth token into localStorage
2. Navigate directly to `http://localhost:7173`
3. Observe redirect behavior

**Expected Results:**
- User redirected to `/workspace`
- No login form shown
- Authentication validated server-side

---

## 2. Session Management

### 2.1 PTY (Terminal) Sessions (P0)

**Seed:** `e2e/seed.spec.ts`

#### 2.1.1 Create New Terminal Session

**Steps:**
1. Login and navigate to `/workspace`
2. Click "New Session" or equivalent action
3. Select "Terminal" session type
4. Wait for session creation

**Expected Results:**
- Session creation modal/interface appears
- Session type selector shows "pty"/"terminal" option
- POST request to `/api/sessions` with `{ kind: 'pty' }`
- Response includes `runId` (e.g., `pty_abc123`)
- Terminal pane appears in workspace
- Socket.IO connection established for session
- `run:attach` event sent with `runId`

#### 2.1.2 Terminal Input/Output

**Steps:**
1. Create terminal session (from 2.1.1)
2. Click into terminal pane
3. Type command: `echo "Hello World"`
4. Press Enter
5. Observe output

**Expected Results:**
- Terminal accepts keyboard input
- `run:input` event sent via Socket.IO
- Server processes command
- `run:event` with channel `pty:stdout` received
- Output "Hello World" appears in terminal
- Cursor visible and blinking

#### 2.1.3 Terminal Resize

**Steps:**
1. Create terminal session
2. Resize terminal pane/window
3. Observe terminal dimensions update

**Expected Results:**
- Terminal dimensions calculated from pane size
- `run:resize` event sent with `{ cols, rows }`
- Terminal reflows content to new dimensions
- No output corruption

#### 2.1.4 Close Terminal Session

**Steps:**
1. Create terminal session
2. Click close/exit button on session pane
3. Confirm closure if prompted
4. Verify session removed

**Expected Results:**
- Confirmation modal may appear
- `run:close` event sent
- DELETE request to `/api/sessions?runId=...`
- Session removed from UI
- Socket.IO room left
- Database session marked as stopped

#### 2.1.5 Multiple Terminal Sessions

**Steps:**
1. Create 3 terminal sessions
2. Interact with each independently
3. Verify isolation

**Expected Results:**
- All 3 sessions appear in UI
- Each has unique `runId`
- Commands in one terminal don't affect others
- Each maintains independent state
- All sessions listed in GET `/api/sessions`

### 2.2 Claude Code Sessions (P0)

#### 2.2.1 Create Claude Session

**Steps:**
1. Navigate to workspace
2. Create new Claude Code session
3. Select workspace path
4. Wait for session initialization

**Expected Results:**
- Session creation UI shows Claude option
- Workspace path selector appears
- POST to `/api/sessions` with `{ kind: 'claude', cwd: '/path' }`
- Claude session pane appears
- Welcome message or prompt shown

#### 2.2.2 Send Message to Claude

**Steps:**
1. Create Claude session
2. Type message: "Hello, Claude"
3. Submit message
4. Wait for response

**Expected Results:**
- Input field accepts text
- Submit button enabled when text entered
- `run:input` event sent with message
- `run:event` with channel `claude:message` received
- Claude response streams in real-time
- Events include `startTurn`, `text`, `endTurn`

#### 2.2.3 Claude Tool Use

**Steps:**
1. Create Claude session in a git repository
2. Ask Claude: "What files are in this directory?"
3. Observe tool execution

**Expected Results:**
- Claude requests tool permission (if permissionMode requires)
- Tool execution events received
- File listing appears in Claude's response
- Tool results integrated into conversation

#### 2.2.4 Close Claude Session

**Steps:**
1. Create Claude session
2. Close session
3. Verify cleanup

**Expected Results:**
- Session closes gracefully
- WebSocket connection terminated
- Session removed from UI and database

### 2.3 File Editor Sessions (P1)

#### 2.3.1 Open File in Editor

**Steps:**
1. Navigate to workspace
2. Browse to a file
3. Open in file editor
4. Verify content loads

**Expected Results:**
- File browser shows files
- Double-click or "Open" action available
- Editor pane appears with file content
- Syntax highlighting applied (if supported)

#### 2.3.2 Edit and Save File

**Steps:**
1. Open file in editor
2. Make changes to content
3. Save file (Ctrl+S or Save button)
4. Verify save confirmation

**Expected Results:**
- Content editable in editor
- Save action triggers
- PUT request to `/api/files?path=...`
- Save confirmation message
- Modified timestamp updated

#### 2.3.3 Unsaved Changes Warning

**Steps:**
1. Open file, make changes
2. Attempt to close without saving
3. Observe warning

**Expected Results:**
- Warning modal appears
- Options: Save, Discard, Cancel
- Changes preserved if Save chosen
- Changes discarded if Discard chosen

### 2.4 Session Persistence & Resume (P0)

#### 2.4.1 Session Survives Page Reload

**Steps:**
1. Create terminal session
2. Run command: `echo "test"`
3. Reload page
4. Verify session state

**Expected Results:**
- Session reappears in workspace
- Previous output visible (replayed from events)
- Session continues to function
- `run:attach` with `seq > 0` retrieves history

#### 2.4.2 Resume Stopped Session

**Steps:**
1. Create session
2. Manually stop session
3. Attempt to resume via API

**Expected Results:**
- POST to `/api/sessions` with `{ resume: true, sessionId: '...' }`
- Session restarts with same ID
- Response includes `{ resumed: true, reason: '...' }`

### 2.5 Session Layout Management (P1)

#### 2.5.1 Add Session to Layout

**Steps:**
1. Create session
2. Drag/place into workspace tile
3. Verify layout persisted

**Expected Results:**
- Session assigned to `tileId`
- PUT to `/api/sessions` with `{ action: 'setLayout', tileId: '...' }`
- Layout stored per `clientId`
- Session marked as `inLayout: true`

#### 2.5.2 Remove Session from Layout

**Steps:**
1. Add session to layout
2. Remove from tile
3. Verify layout update

**Expected Results:**
- PUT to `/api/sessions` with `{ action: 'removeLayout' }`
- Session removed from tile
- Session still exists but not in layout

#### 2.5.3 Layout Persistence Across Clients

**Steps:**
1. Login on Browser A
2. Create layout with sessions
3. Login on Browser B with same auth
4. Compare layouts

**Expected Results:**
- Layouts are client-specific (different `clientId`)
- Each client maintains independent layout
- Sessions shared, but layout not synchronized

---

## 3. Workspace Management

### 3.1 Workspace CRUD Operations (P0)

**Seed:** `e2e/seed.spec.ts`

#### 3.1.1 List Workspaces

**Steps:**
1. Login to application
2. Navigate to workspace view
3. Observe workspace list

**Expected Results:**
- GET to `/api/workspaces?authKey=...`
- Response includes array of workspaces
- Default workspace(s) visible
- Each workspace shows name, path, status

#### 3.1.2 Create New Workspace

**Steps:**
1. Click "New Workspace" button
2. Enter workspace name: "Test Project"
3. Optionally set path
4. Submit form

**Expected Results:**
- Workspace creation modal appears
- POST to `/api/workspaces` with `{ name: 'Test Project', path: '...' }`
- New workspace appears in list
- Workspace created on filesystem
- Status set to `new`

#### 3.1.3 View Workspace Details

**Steps:**
1. Select workspace from list
2. View details panel
3. Observe metadata

**Expected Results:**
- GET to `/api/workspaces/[workspaceId]`
- Workspace metadata displayed: name, path, created date
- Associated sessions listed
- Git status shown (if git repo)

#### 3.1.4 Update Workspace Metadata

**Steps:**
1. Open workspace details
2. Edit name: "Updated Project Name"
3. Save changes

**Expected Results:**
- PUT to `/api/workspaces/[workspaceId]` with updates
- Workspace name updated in UI
- Database record updated
- Success confirmation shown

#### 3.1.5 Delete Workspace

**Steps:**
1. Select workspace
2. Click delete action
3. Confirm deletion

**Expected Results:**
- Confirmation modal appears
- DELETE to `/api/workspaces/[workspaceId]`
- Workspace removed from list
- Associated sessions closed
- Filesystem cleanup (optional, configurable)

### 3.2 Workspace Switching (P0)

#### 3.2.1 Switch Active Workspace

**Steps:**
1. Have multiple workspaces
2. Click on different workspace
3. Observe context switch

**Expected Results:**
- Active workspace highlighted
- Sessions filtered to current workspace
- File browser shows current workspace path
- URL updates with workspace context

### 3.3 Workspace Environment Variables (P1)

#### 3.3.1 Set Environment Variables

**Steps:**
1. Open workspace settings
2. Navigate to environment variables section
3. Add variable: `NODE_ENV=production`
4. Save

**Expected Results:**
- PUT to `/api/settings/workspace` with `{ envVariables: {...} }`
- Variable saved to database
- New sessions in workspace inherit variables

#### 3.3.2 Verify Variables in Session

**Steps:**
1. Set workspace env var `TEST_VAR=hello`
2. Create terminal session in workspace
3. Run: `echo $TEST_VAR`
4. Verify output

**Expected Results:**
- Terminal outputs "hello"
- Environment variables passed to session

---

## 4. Real-time Communication (Socket.IO)

### 4.1 Connection & Authentication (P0)

**Seed:** `e2e/seed.spec.ts`

#### 4.1.1 Socket.IO Connection Established

**Steps:**
1. Login to application
2. Navigate to workspace
3. Monitor network connections

**Expected Results:**
- WebSocket connection to `ws://localhost:7173`
- Socket.IO handshake completes
- `client:hello` event sent with `{ clientId, terminalKey }`
- Server responds with `{ success: true }`

#### 4.1.2 Failed Socket Authentication

**Steps:**
1. Modify localStorage to have invalid auth token
2. Attempt socket connection
3. Observe behavior

**Expected Results:**
- `client:hello` sent with invalid key
- Server responds with `{ success: false, error: '...' }`
- Connection may be terminated

### 4.2 Event Streaming (P0)

#### 4.2.1 Receive Real-time Events

**Steps:**
1. Create terminal session
2. Monitor Socket.IO events
3. Run command in terminal

**Expected Results:**
- `run:event` events stream to client
- Events have structure: `{ runId, seq, channel, type, payload, ts }`
- Sequence numbers increment monotonically
- Events arrive in order

#### 4.2.2 Event Replay from Sequence

**Steps:**
1. Create session, run commands
2. Note last sequence number
3. Disconnect and reconnect
4. Attach with `seq` parameter

**Expected Results:**
- `run:attach` with `{ runId, seq: lastSeq }`
- Only events after `lastSeq` returned
- Session state reconstructed from events

### 4.3 Multi-client Synchronization (P1)

#### 4.3.1 Same Session in Multiple Tabs

**Steps:**
1. Login in Tab A
2. Create terminal session
3. Login in Tab B with same auth
4. Attach to same session in Tab B
5. Run command in Tab A
6. Observe Tab B

**Expected Results:**
- Both tabs attached to same `runId`
- Both join Socket.IO room `run:{runId}`
- Output appears in both tabs simultaneously
- Event sequences synchronized

### 4.4 Connection Resilience (P0)

#### 4.4.1 Reconnection After Disconnect

**Steps:**
1. Create active session
2. Simulate network disconnection (DevTools offline mode)
3. Wait for disconnect
4. Restore connection
5. Observe reconnection

**Expected Results:**
- Socket.IO emits `disconnect` event
- Client attempts reconnection (exponential backoff)
- `connect` event fires on success
- Client re-attaches to active sessions
- Missed events replayed via sequence numbers

#### 4.4.2 Session State Recovery

**Steps:**
1. Create session, generate output
2. Force disconnect (close socket)
3. Reconnect
4. Verify session state

**Expected Results:**
- Session history replayed from database
- Last known sequence tracked
- No data loss
- Session continues functioning

---

## 5. File Operations

### 5.1 File Reading (P0)

**Seed:** `e2e/seed.spec.ts`

#### 5.1.1 Read Existing File

**Steps:**
1. Navigate to workspace
2. Browse to known file
3. Request file content

**Expected Results:**
- GET to `/api/files?path=/workspace/file.txt`
- Response includes `{ path, content, size, modified, readonly }`
- Content displayed correctly
- Metadata accurate

#### 5.1.2 Read Non-existent File

**Steps:**
1. Request file at invalid path
2. Observe error handling

**Expected Results:**
- GET to `/api/files?path=/invalid/path`
- 404 response
- Error message: "File not found"
- UI shows appropriate error state

#### 5.1.3 Read Directory (Error Case)

**Steps:**
1. Request file endpoint with directory path
2. Observe error

**Expected Results:**
- 400 response
- Error: "Path is not a file" or similar
- No content returned

#### 5.1.4 Read Large File

**Steps:**
1. Create/select file > 10MB
2. Attempt to read

**Expected Results:**
- 413 response: "File too large"
- Max size limit enforced (10MB)
- Appropriate error message shown

### 5.2 File Writing (P0)

#### 5.2.1 Write New File

**Steps:**
1. Use file creation interface
2. Enter path: `/workspace/test/newfile.txt`
3. Enter content: "Hello World"
4. Save

**Expected Results:**
- PUT to `/api/files?path=...` with `{ content: '...' }`
- File created on filesystem
- Response includes `{ success: true, path, size, modified }`
- File appears in directory browser

#### 5.2.2 Update Existing File

**Steps:**
1. Open existing file
2. Modify content
3. Save changes

**Expected Results:**
- PUT to `/api/files?path=...`
- File content updated
- Modified timestamp changed
- No data corruption

#### 5.2.3 Write to Read-only File

**Steps:**
1. Create read-only file (permissions)
2. Attempt to write

**Expected Results:**
- 403 response: "Permission denied"
- File not modified
- Error shown to user

#### 5.2.4 Write to Invalid Directory

**Steps:**
1. Attempt to write to non-existent directory
2. Observe error

**Expected Results:**
- 400 response: "Directory doesn't exist"
- File not created
- Error message displayed

### 5.3 File Upload (P1)

#### 5.3.1 Upload Single File

**Steps:**
1. Click upload button
2. Select file from filesystem
3. Choose destination path
4. Upload

**Expected Results:**
- POST to `/api/files/upload` with multipart form data
- File transferred to server
- Response: `{ success: true, path, size }`
- File appears in workspace

#### 5.3.2 Upload Large File

**Steps:**
1. Select file > 100MB
2. Attempt upload

**Expected Results:**
- Upload progresses or fails with size limit error
- Progress indicator shown
- Proper timeout handling

---

## 6. Git Operations

### 6.1 Repository Status (P0)

**Seed:** `e2e/seed.spec.ts`

#### 6.1.1 Get Git Status

**Steps:**
1. Navigate to git repository workspace
2. Request git status
3. Observe results

**Expected Results:**
- GET to `/api/git/status?path=/workspace/repo`
- Response includes `{ branch, modified, staged, untracked, ahead, behind }`
- UI displays current branch
- File changes listed

#### 6.1.2 Status in Non-Git Directory

**Steps:**
1. Navigate to non-git workspace
2. Request git status

**Expected Results:**
- Error response or empty status
- UI indicates "Not a git repository"

### 6.2 Branch Operations (P1)

#### 6.2.1 List Branches

**Steps:**
1. In git repository
2. Request branch list

**Expected Results:**
- GET to `/api/git/branches?path=...`
- Response: `{ current: 'main', branches: [...] }`
- All branches listed
- Current branch highlighted

#### 6.2.2 Create New Branch

**Steps:**
1. Click "New Branch"
2. Enter name: `feature/test-branch`
3. Create

**Expected Results:**
- POST to `/api/git/branch` with `{ path, name }`
- Branch created
- Branch appears in list

#### 6.2.3 Checkout Branch

**Steps:**
1. Select different branch
2. Checkout

**Expected Results:**
- POST to `/api/git/checkout` with `{ path, branch }`
- Working directory switches to branch
- Current branch updates in UI

### 6.3 Commit Operations (P0)

#### 6.3.1 Stage Files

**Steps:**
1. Modify files in repository
2. Select files to stage
3. Stage them

**Expected Results:**
- POST to `/api/git/stage` with `{ path, files: [...] }`
- Files move to staged area
- Git status updated

#### 6.3.2 Commit Changes

**Steps:**
1. Stage files
2. Enter commit message: "feat: Add feature"
3. Commit

**Expected Results:**
- POST to `/api/git/commit` with `{ path, message }`
- Commit created
- Working directory clean
- Commit appears in log

#### 6.3.3 Commit with Empty Message

**Steps:**
1. Stage files
2. Leave message empty
3. Attempt commit

**Expected Results:**
- Validation error
- Commit prevented
- Error message shown

### 6.4 Remote Operations (P1)

#### 6.4.1 Push Commits

**Steps:**
1. Make commits locally
2. Push to remote

**Expected Results:**
- POST to `/api/git/push` with `{ path, remote, branch }`
- Commits pushed to remote
- Success message shown
- Branch status updated (ahead count = 0)

#### 6.4.2 Pull Changes

**Steps:**
1. Remote has new commits
2. Pull changes

**Expected Results:**
- POST to `/api/git/pull` with `{ path }`
- Changes fetched and merged
- Working directory updated
- Conflict resolution if needed

### 6.5 Git Log & Diff (P1)

#### 6.5.1 View Commit Log

**Steps:**
1. Navigate to repository
2. Open commit log
3. View history

**Expected Results:**
- GET to `/api/git/log?path=...&limit=50`
- Response: `{ commits: [{ hash, message, author, date }] }`
- Commits displayed in chronological order
- Pagination works

#### 6.5.2 View Diff

**Steps:**
1. Modify files
2. Request diff

**Expected Results:**
- GET to `/api/git/diff?path=...&staged=false`
- Unified diff format returned
- Changes highlighted in UI

### 6.6 Git Worktrees (P2)

#### 6.6.1 List Worktrees

**Steps:**
1. In repository with worktrees
2. Request worktree list

**Expected Results:**
- GET to `/api/git/worktree/list?path=...`
- All worktrees listed
- Main worktree marked

#### 6.6.2 Create Worktree

**Steps:**
1. Create new worktree
2. Specify branch and path

**Expected Results:**
- POST to `/api/git/worktree/add`
- Worktree created on filesystem
- Branch checked out in worktree

#### 6.6.3 Remove Worktree

**Steps:**
1. Select worktree to remove
2. Remove it

**Expected Results:**
- POST to `/api/git/worktree/remove`
- Worktree deleted
- Branch remains in repository

---

## 7. Settings Management

### 7.1 Global Settings (P1)

**Seed:** `e2e/seed.spec.ts`

#### 7.1.1 View Global Settings

**Steps:**
1. Navigate to Settings page
2. Select Global category
3. Observe settings

**Expected Results:**
- GET to `/api/settings?category=global`
- Settings displayed: theme, defaultWorkspaceDirectory
- Current values shown
- Edit controls available

#### 7.1.2 Update Global Settings

**Steps:**
1. Change setting (e.g., theme to "dracula")
2. Save

**Expected Results:**
- PUT to `/api/settings/global` with new values
- Settings persisted to database
- UI reflects changes immediately
- Success notification shown

### 7.2 Claude Settings (P1)

#### 7.2.1 Configure Claude Model

**Steps:**
1. Navigate to Settings > Claude
2. Select model: "claude-3-5-sonnet-20241022"
3. Save

**Expected Results:**
- Model dropdown shows available models
- PUT to `/api/settings/claude`
- New Claude sessions use selected model

#### 7.2.2 Set Permission Mode

**Steps:**
1. In Claude settings
2. Change permissionMode: "auto", "default", "manual"
3. Save

**Expected Results:**
- Permission mode options explained
- Setting saved
- Future sessions respect permission mode

#### 7.2.3 Set Max Turns Limit

**Steps:**
1. Set maxTurns: 10
2. Save
3. Verify in new session

**Expected Results:**
- Number input validated
- Claude sessions limited to 10 turns
- Session stops after limit

### 7.3 Workspace Settings (P1)

#### 7.3.1 Manage Environment Variables

**Steps:**
1. Navigate to Settings > Workspace
2. Add env variable: `API_KEY=secret123`
3. Save

**Expected Results:**
- GET to `/api/settings/workspace`
- Variables displayed in key-value pairs
- PUT with updated variables
- New sessions inherit variables

### 7.4 Terminal Settings (P2)

#### 7.4.1 Configure Terminal Defaults

**Steps:**
1. Navigate to terminal settings
2. Set default shell, font size, etc.
3. Save

**Expected Results:**
- Terminal configuration persisted
- New terminal sessions use defaults

### 7.5 Onboarding Settings (P2)

#### 7.5.1 Complete Onboarding

**Steps:**
1. First-time user flow
2. Complete onboarding steps
3. Mark as completed

**Expected Results:**
- GET to `/api/settings/onboarding` returns `{ completed: false }`
- POST to mark completed
- Onboarding not shown on future visits

---

## 8. Theme Management

### 8.1 Theme Selection (P1)

**Seed:** `e2e/seed.spec.ts`

#### 8.1.1 List Available Themes

**Steps:**
1. Navigate to theme settings
2. View theme list

**Expected Results:**
- GET to `/api/themes`
- Response: `{ themes: [{ id, name, description }] }`
- Themes displayed with previews
- Current theme highlighted

#### 8.1.2 Switch Theme

**Steps:**
1. Select theme: "dracula"
2. Apply

**Expected Results:**
- PUT to `/api/themes/active` with `{ themeId: 'dracula' }`
- UI updates with new theme colors
- Theme persisted to database
- CSS variables updated

#### 8.1.3 Preview Theme

**Steps:**
1. Hover/click theme preview
2. Observe temporary theme application

**Expected Results:**
- Theme applied temporarily
- No API call until confirmed
- Can revert without saving

### 8.2 Custom Themes (P2)

#### 8.2.1 View Theme Details

**Steps:**
1. Select theme
2. View detailed settings

**Expected Results:**
- GET to `/api/themes/[themeId]`
- Color palette displayed
- CSS variables shown

#### 8.2.2 Delete Custom Theme

**Steps:**
1. Create/select custom theme
2. Delete it

**Expected Results:**
- GET to `/api/themes/[themeId]/can-delete` first
- If allowed, DELETE to `/api/themes/[themeId]`
- Theme removed from list
- Active theme switches if was active

#### 8.2.3 Prevent Deletion of Active Theme

**Steps:**
1. Set theme as active
2. Attempt to delete

**Expected Results:**
- Deletion prevented
- Error: "Theme is currently active"
- User must switch theme first

---

## 9. UI/UX & Navigation

### 9.1 Page Navigation (P0)

**Seed:** `e2e/seed.spec.ts`

#### 9.1.1 Navigate to Workspace

**Steps:**
1. Login
2. Click workspace link/button
3. Observe navigation

**Expected Results:**
- URL changes to `/workspace`
- Workspace view loads
- Sessions and workspaces visible
- Navigation persists on reload

#### 9.1.2 Navigate to Settings

**Steps:**
1. From workspace
2. Click Settings
3. Navigate to settings page

**Expected Results:**
- URL changes to `/settings`
- Settings categories visible
- Navigation breadcrumb updates

#### 9.1.3 Navigate to Admin Console

**Steps:**
1. Navigate to `/console`
2. Verify access (if authenticated)

**Expected Results:**
- Console loads
- Real-time socket monitoring visible
- Event log streams
- Admin tools accessible

### 9.2 Modal Interactions (P1)

#### 9.2.1 Open Create Session Modal

**Steps:**
1. Click "New Session"
2. Modal appears

**Expected Results:**
- Modal overlays workspace
- Session type options visible
- Focus on modal content
- Escape key closes modal

#### 9.2.2 Close Modal Without Action

**Steps:**
1. Open modal
2. Click outside or press Escape
3. Observe behavior

**Expected Results:**
- Modal closes
- No API calls made
- Workspace state unchanged

### 9.3 Workspace Layout (P1)

#### 9.3.1 Tile-based Layout

**Steps:**
1. Create multiple sessions
2. Arrange in tiles
3. Resize tiles

**Expected Results:**
- Sessions placed in grid layout
- Tiles resizable via drag handles
- Layout persists per client
- Responsive to window resize

#### 9.3.2 Drag and Drop Sessions

**Steps:**
1. Create session
2. Drag to different tile
3. Observe movement

**Expected Results:**
- Session moves to new tile
- Layout API called
- Visual feedback during drag
- Drop zones highlighted

### 9.4 Responsive Design (P1)

#### 9.4.1 Mobile View

**Steps:**
1. Resize browser to mobile width (< 768px)
2. Observe layout changes

**Expected Results:**
- Hamburger menu appears
- Sidebar collapses
- Sessions stack vertically
- Touch-friendly controls

#### 9.4.2 Tablet View

**Steps:**
1. Resize to tablet width (768px - 1024px)
2. Observe layout

**Expected Results:**
- Layout adapts to medium screen
- Sidebar may remain visible
- Sessions in smaller grid

### 9.5 Accessibility (P2)

#### 9.5.1 Keyboard Navigation

**Steps:**
1. Navigate entire app using only keyboard
2. Tab through controls
3. Activate with Enter/Space

**Expected Results:**
- Focus indicators visible
- All interactive elements reachable
- Logical tab order
- Keyboard shortcuts documented

#### 9.5.2 Screen Reader Support

**Steps:**
1. Enable screen reader
2. Navigate application
3. Verify announcements

**Expected Results:**
- ARIA labels present
- Role attributes correct
- State changes announced
- Forms properly labeled

---

## 10. Error Handling & Edge Cases

### 10.1 Network Errors (P0)

**Seed:** `e2e/seed.spec.ts`

#### 10.1.1 API Request Failure

**Steps:**
1. Simulate server down
2. Attempt to create session
3. Observe error handling

**Expected Results:**
- Error message displayed
- User notified of issue
- Retry mechanism available
- UI remains functional

#### 10.1.2 Socket Disconnection

**Steps:**
1. Active session running
2. Disconnect socket
3. Observe reconnection

**Expected Results:**
- "Disconnected" indicator shown
- Automatic reconnection attempts
- Session resumes on reconnect
- Events replayed from last sequence

### 10.2 Invalid Input Validation (P0)

#### 10.2.1 Invalid File Path

**Steps:**
1. Enter invalid path: `../../../etc/passwd`
2. Attempt to access

**Expected Results:**
- Path traversal prevented
- 403 or 400 error
- Security error logged
- User sees sanitized error

#### 10.2.2 Invalid Session ID

**Steps:**
1. Request session with malformed ID
2. Observe response

**Expected Results:**
- 400 or 404 error
- Error: "Invalid runId"
- No server crash

#### 10.2.3 Oversized Input

**Steps:**
1. Send very large message (> 1MB)
2. Observe handling

**Expected Results:**
- Request rejected or truncated
- Error: "Input too large"
- No memory issues

### 10.3 Concurrency Issues (P1)

#### 10.3.1 Simultaneous Session Creation

**Steps:**
1. Create 10 sessions rapidly
2. Verify all created correctly

**Expected Results:**
- All sessions created
- Unique IDs assigned
- No race conditions
- Database integrity maintained

#### 10.3.2 Concurrent File Writes

**Steps:**
1. Write to same file from 2 sessions
2. Observe conflict handling

**Expected Results:**
- Last write wins or conflict detected
- No data corruption
- Error message if conflicts

### 10.4 Edge Cases (P2)

#### 10.4.1 Empty Workspace

**Steps:**
1. Create workspace with no files
2. Attempt operations

**Expected Results:**
- Empty state displayed
- No errors
- Helpful prompts shown

#### 10.4.2 Very Long Session Duration

**Steps:**
1. Keep session open for hours
2. Verify stability

**Expected Results:**
- Session remains responsive
- No memory leaks
- Event log manageable

#### 10.4.3 Special Characters in Names

**Steps:**
1. Create workspace: `Test & Project <>"'`
2. Verify handling

**Expected Results:**
- Special characters escaped/encoded
- No XSS vulnerabilities
- Display correct in UI

---

## 11. Performance & Scalability

### 11.1 Session Performance (P1)

**Seed:** `e2e/seed.spec.ts`

#### 11.1.1 High-frequency Terminal Output

**Steps:**
1. Create terminal session
2. Run: `cat large-file.txt` (100MB)
3. Observe rendering

**Expected Results:**
- Terminal handles output smoothly
- No UI freezing
- Buffering/throttling in place
- Output eventually completes

#### 11.1.2 Many Active Sessions

**Steps:**
1. Create 20 active terminal sessions
2. Interact with each
3. Monitor performance

**Expected Results:**
- All sessions responsive
- CPU/memory usage acceptable
- Socket.IO handles load
- Database queries efficient

### 11.2 Event Replay Performance (P1)

#### 11.2.1 Replay Large Event History

**Steps:**
1. Session with 10,000+ events
2. Disconnect and reconnect
3. Measure replay time

**Expected Results:**
- Replay completes in reasonable time (< 5s)
- Pagination/chunking used
- UI progressive rendering
- No timeout errors

### 11.3 Database Performance (P2)

#### 11.3.1 Session Event Growth

**Steps:**
1. Long-running session with many events
2. Query session history
3. Measure query time

**Expected Results:**
- Queries remain fast (< 100ms)
- Indexes utilized
- Old events archived if needed

---

## 12. Cross-browser Compatibility

### 12.1 Browser Support (P1)

**Seed:** `e2e/seed.spec.ts`

#### 12.1.1 Chrome/Chromium

**Steps:**
1. Test all core flows in Chrome
2. Verify functionality

**Expected Results:**
- All features work
- WebSocket stable
- Rendering correct

#### 12.1.2 Firefox

**Steps:**
1. Test all core flows in Firefox
2. Verify functionality

**Expected Results:**
- Feature parity with Chrome
- CSS consistent
- No Firefox-specific bugs

#### 12.1.3 Safari/WebKit

**Steps:**
1. Test all core flows in Safari
2. Verify functionality

**Expected Results:**
- Core features functional
- WebKit-specific issues handled
- Fallbacks for unsupported features

#### 12.1.4 Mobile Browsers

**Steps:**
1. Test on Mobile Chrome (Android)
2. Test on Mobile Safari (iOS)
3. Verify touch interactions

**Expected Results:**
- Mobile-optimized layout
- Touch gestures work
- Virtual keyboard handling

---

## 13. Directory Browsing

### 13.1 Browse Workspace (P0)

**Seed:** `e2e/seed.spec.ts`

#### 13.1.1 List Directory Contents

**Steps:**
1. Navigate to directory browser
2. Browse workspace root
3. View files and folders

**Expected Results:**
- GET to `/api/browse?path=/workspace`
- Response includes `{ path, entries: [...], parent }`
- Folders and files listed
- Icons differentiate types

#### 13.1.2 Navigate Subdirectories

**Steps:**
1. Click on folder
2. Navigate into it
3. Observe path update

**Expected Results:**
- Path updates to subfolder
- Breadcrumb navigation shown
- Back button returns to parent

#### 13.1.3 Create New Directory

**Steps:**
1. In directory browser
2. Click "New Folder"
3. Enter name: "test-dir"
4. Create

**Expected Results:**
- POST to `/api/browse/create` with `{ path, type: 'directory' }`
- Folder created
- Appears in listing

#### 13.1.4 Clone Git Repository

**Steps:**
1. In directory browser
2. Click "Clone Repository"
3. Enter URL: `https://github.com/user/repo.git`
4. Select destination
5. Clone

**Expected Results:**
- POST to `/api/browse/clone` with `{ url, destination }`
- Repository cloned
- Progress indicator shown
- New folder appears with repo contents

---

## 14. Onboarding Flow

### 14.1 First-time User Experience (P1)

**Seed:** `e2e/seed.spec.ts`

#### 14.1.1 Onboarding Wizard

**Steps:**
1. Login as new user
2. Observe onboarding
3. Complete steps

**Expected Results:**
- Onboarding flow starts automatically
- Multi-step wizard guides user
- Key features introduced
- Skippable with option

#### 14.1.2 Theme Selection in Onboarding

**Steps:**
1. During onboarding
2. Reach theme selection step
3. Choose theme

**Expected Results:**
- Theme previews shown
- Selection applied immediately
- Persisted to settings

#### 14.1.3 Skip Onboarding

**Steps:**
1. Start onboarding
2. Click "Skip"
3. Verify bypass

**Expected Results:**
- Onboarding dismissed
- User taken to workspace
- Can access onboarding later

#### 14.1.4 Complete Onboarding

**Steps:**
1. Complete all onboarding steps
2. Finish

**Expected Results:**
- POST to `/api/settings/onboarding` with `{ completed: true }`
- Onboarding not shown again
- Welcome message or tour available

---

## Test Data Requirements

### Workspace Fixtures

- **Empty Workspace**: No files, clean slate
- **Sample Project**: Basic project with files and folders
- **Git Repository**: Initialized git repo with commits
- **Large Repository**: Repo with 1000+ files for performance testing

### Session Fixtures

- **Terminal Sessions**: Pre-created with command history
- **Claude Sessions**: With conversation history
- **File Editor Sessions**: Open files with content

### User Fixtures

- **New User**: No onboarding completed
- **Returning User**: Onboarding completed, has workspaces
- **Power User**: Multiple workspaces, sessions, custom themes

---

## Test Environment Setup

### Prerequisites

1. **Server Running**: `npm run dev:test` on port 7173
2. **Database**: Fresh SQLite database in `/tmp`
3. **Authentication**: Known key `test-automation-key-12345`
4. **Workspaces**: Test workspace directories created

### Helper Functions

```javascript
// Authentication helper
async function authenticateUser(page) {
  await page.evaluate(() => {
    localStorage.setItem('dispatch-auth-token', 'test-automation-key-12345');
    localStorage.setItem('authSessionId', 'test-session-' + Date.now());
    localStorage.setItem('authExpiresAt', new Date(Date.now() + 30*24*60*60*1000).toISOString());
  });
}

// Session creation helper
async function createSession(page, type = 'pty') {
  // Implementation based on UI flow
}

// Wait for socket connection
async function waitForSocketConnection(page) {
  await page.waitForFunction(() => {
    return window.__socketConnected === true;
  });
}
```

### Cleanup

- Clear localStorage between tests
- Close all sessions
- Reset database (or use transactions)
- Clear workspace files

---

## Test Execution Strategy

### Test Phases

1. **Smoke Tests** (P0 only): 15 minutes
2. **Core Functionality** (P0 + P1): 1 hour
3. **Full Regression** (All priorities): 2-3 hours
4. **Cross-browser** (All browsers): 4-6 hours

### Parallel Execution

- Tests should be independent
- Use unique workspace paths per test
- Avoid shared state
- Parallel workers: 4-8 depending on resources

### Test Reporting

- HTML report with screenshots
- JSON results for CI integration
- Video recordings on failure
- Performance metrics tracked

---

## Known Issues & Limitations

### Browser Limitations

- WebSocket support required (IE not supported)
- Service workers may interfere (disabled in tests)
- IndexedDB for offline support (optional)

### Performance Constraints

- Event replay limited to 10,000 events
- File operations limited to 10MB
- Socket.IO max message size: 1MB

### Security Considerations

- CORS configured for all origins in dev (tighten for prod)
- No rate limiting in dev (add for prod)
- Terminal key authentication simple (consider OAuth for prod)

---

## Future Test Coverage

### Not Currently Covered

1. **PWA Features**: Offline mode, service workers
2. **Internationalization**: Multiple languages
3. **Advanced Git**: Merge conflicts, rebasing, stashing
4. **Collaboration**: Multiple users on same workspace
5. **Plugin System**: If extensibility added
6. **Export/Import**: Workspace backups
7. **Notifications**: Browser notifications for events
8. **Search**: Full-text search across files

### Integration Tests Needed

1. **Docker Container**: Test full containerized deployment
2. **CLI Tool**: Test CLI commands
3. **LocalTunnel**: Test public URL generation
4. **VS Code Tunnel**: Test remote development setup

---

## Appendix: API Reference Quick Guide

### Session Endpoints

- `POST /api/sessions` - Create session
- `GET /api/sessions` - List sessions
- `DELETE /api/sessions?runId=...` - Close session
- `PUT /api/sessions` - Update layout
- `GET /api/sessions/[id]/history` - Get event history

### Workspace Endpoints

- `GET /api/workspaces` - List workspaces
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces/[id]` - Get details
- `PUT /api/workspaces/[id]` - Update workspace
- `DELETE /api/workspaces/[id]` - Delete workspace

### Settings Endpoints

- `GET /api/settings` - Get all settings
- `GET /api/settings/[category]` - Get category settings
- `PUT /api/settings/[category]` - Update settings

### File Endpoints

- `GET /api/files?path=...` - Read file
- `PUT /api/files?path=...` - Write file
- `POST /api/files/upload` - Upload file

### Git Endpoints

- `GET /api/git/status?path=...` - Git status
- `POST /api/git/commit` - Commit changes
- `POST /api/git/push` - Push to remote
- `POST /api/git/pull` - Pull from remote

### Socket.IO Events

- `client:hello` - Authenticate
- `run:attach` - Attach to session
- `run:input` - Send input
- `run:event` - Receive events
- `run:close` - Close session

---

## Document Version

- **Version**: 1.0
- **Created**: 2025-10-08
- **Author**: Claude Code Test Planner
- **Last Updated**: 2025-10-08
- **Status**: Initial Release

This test plan provides comprehensive coverage for automated testing of the Dispatch application. Each scenario includes detailed steps, expected results, and priority levels to guide test implementation.
