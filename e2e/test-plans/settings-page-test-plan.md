# Dispatch Settings Page - Comprehensive Test Plan

## Application Overview

The Dispatch Settings page (`/settings`) provides a centralized configuration interface for managing all aspects of the Dispatch terminal application. The page features a tabbed interface with seven distinct configuration categories, each managing specific aspects of the application.

## Settings Categories

1. **Theme** - Visual appearance and color schemes
2. **Home Directory** - File management and directory browsing
3. **Environment** - Workspace environment variables
4. **Authentication** - Terminal key and OAuth configuration
5. **Connectivity** - LocalTunnel and VS Code Remote Tunnels
6. **Data & Storage** - Browser storage and data retention policies
7. **Claude** - Claude AI authentication and session defaults

## Test Scenarios

### 1. Settings Page Navigation and Access

**Seed:** `e2e/seed.spec.ts`

#### 1.1 Access Settings Page with Valid Authentication

**Steps:**
1. Complete onboarding process to obtain API key
2. Navigate to settings page via footer button or direct URL `/settings`
3. Verify page loads successfully

**Expected Results:**
- Settings page displays with tabbed interface
- Theme tab is selected by default
- All seven tabs are visible and labeled correctly
- Header shows "Dispatch v0.2.1" branding
- Footer displays version number

#### 1.2 Access Settings Page Without Authentication

**Steps:**
1. Clear all browser storage (localStorage, sessionStorage, cookies)
2. Navigate directly to `/settings` URL

**Expected Results:**
- User is redirected to `/login` page
- Redirect parameter includes `redirect=/settings`
- After successful login, user returns to settings page

#### 1.3 Navigate Between Settings Tabs

**Steps:**
1. From Theme tab, click on each tab in sequence
2. Verify each tab content loads correctly
3. Return to Theme tab

**Expected Results:**
- Each tab becomes active when clicked
- Tab content changes to show corresponding settings
- Active tab has visual indicator (highlighted)
- Tab transitions are smooth
- Previous tab state is preserved when navigating back

---

### 2. Theme Settings

**Seed:** `e2e/seed.spec.ts`

#### 2.1 View Preset Themes

**Steps:**
1. Navigate to Settings > Theme tab
2. Observe the three preset theme cards

**Expected Results:**
- Three theme cards displayed: Dark, Light, Phosphor Green
- Each card shows:
  - Theme name
  - Terminal preview with ANSI colors
  - Color palette visualization (16 colors)
  - Description text
  - Activate button
- Default theme (Phosphor Green) shows "Active" status

#### 2.2 Activate Different Theme

**Steps:**
1. Navigate to Settings > Theme tab
2. Click "Activate" button on Dark theme card
3. Wait for theme to apply

**Expected Results:**
- Theme changes immediately across the application
- Dark theme card now shows "Active" status
- Phosphor Green card shows "Activate" button again
- UI colors update to match Dark theme palette
- No page refresh required

#### 2.3 Upload Custom Theme File

**Steps:**
1. Navigate to Settings > Theme > Custom Themes section
2. Click or drag a valid JSON theme file to upload area
3. Wait for upload to complete

**Expected Results:**
- File upload dialog appears (or drag-and-drop is accepted)
- Valid JSON theme file is accepted (max 5MB)
- Custom theme appears in available themes list
- Can activate custom theme like preset themes
- Invalid file formats show error message

#### 2.4 Theme Upload Validation - Invalid File

**Steps:**
1. Navigate to Custom Themes section
2. Attempt to upload:
   - Non-JSON file (e.g., .txt, .png)
   - JSON file exceeding 5MB
   - JSON file with invalid theme structure

**Expected Results:**
- Error message displays for each invalid case
- Specific error indicates the problem:
  - "Invalid file format. JSON required"
  - "File exceeds 5MB limit"
  - "Invalid theme structure"
- No theme is added to the list
- Upload area returns to ready state

---

### 3. Home Directory Management

**Seed:** `e2e/seed.spec.ts`

#### 3.1 Browse Home Directory

**Steps:**
1. Navigate to Settings > Home Directory tab
2. View the directory browser
3. Observe the `.dispatch` directory listing

**Expected Results:**
- Directory browser displays current home directory path
- Shows `/tmp/dispatch-test-home` in test environment
- `.dispatch` directory is visible
- Directory entry shows folder icon and "directory" label
- Search/filter textbox is available

#### 3.2 Create New Directory

**Steps:**
1. Navigate to Home Directory tab
2. Click "Create new directory" button
3. Enter directory name (e.g., "test-folder")
4. Confirm creation

**Expected Results:**
- Modal or inline form appears for directory name
- Directory is created in home directory
- New directory appears in file list
- Success message confirms creation
- Directory is immediately browsable

#### 3.3 Upload Files to Home Directory

**Steps:**
1. Navigate to Home Directory tab
2. Click "Upload files" button
3. Select one or more files from system
4. Confirm upload

**Expected Results:**
- File picker dialog opens
- Multiple files can be selected
- Upload progress indicator shows (if large files)
- Files appear in directory listing after upload
- File size and type are displayed

#### 3.4 Toggle Hidden Files Visibility

**Steps:**
1. Navigate to Home Directory tab
2. Note current hidden files visibility state
3. Click "Hide hidden files" / "Show hidden files" toggle button
4. Observe file list changes

**Expected Results:**
- Button label toggles between "Hide" and "Show"
- Files/folders starting with `.` appear/disappear accordingly
- `.dispatch` directory visibility toggles
- Setting persists when navigating away and back

#### 3.5 Clone Directory (Git Clone)

**Steps:**
1. Navigate to Home Directory tab
2. Click "Clone current directory" button
3. Enter a valid Git repository URL
4. Confirm clone operation

**Expected Results:**
- Modal appears requesting repository URL
- Valid Git URLs are accepted (https://, git://, ssh://)
- Clone progress is shown
- Cloned repository appears as new directory
- Error message for invalid URLs or failed clones

---

### 4. Environment Variables

**Seed:** `e2e/seed.spec.ts`

#### 4.1 Add New Environment Variable

**Steps:**
1. Navigate to Settings > Environment tab
2. Click "+ Add Variable" button
3. Enter variable name: `NODE_ENV`
4. Enter value: `development`
5. Click "Save Changes"

**Expected Results:**
- New row added with name and value inputs
- Variable name accepts alphanumeric and underscores
- Value field accepts any text
- Save button becomes enabled
- Success message confirms save
- Variable persists after page reload

#### 4.2 Add Multiple Environment Variables

**Steps:**
1. Navigate to Environment tab
2. Click "+ Add Variable" three times
3. Enter:
   - `NODE_ENV` = `development`
   - `API_KEY` = `test-key-12345`
   - `DEBUG` = `app:*`
4. Click "Save Changes"

**Expected Results:**
- Three variable rows are added
- Each row has independent name/value inputs
- Remove button (✕) appears for each row
- All variables saved together
- Variable order is preserved

#### 4.3 Remove Environment Variable

**Steps:**
1. Navigate to Environment tab with existing variables
2. Click remove button (✕) on a specific variable
3. Click "Save Changes"

**Expected Results:**
- Variable row is removed immediately from UI
- Save button becomes enabled (showing changes pending)
- After save, variable is permanently removed
- Other variables remain unchanged

#### 4.4 Reset Environment Variables

**Steps:**
1. Navigate to Environment tab with modified variables
2. Click "Reset" button
3. Observe changes

**Expected Results:**
- All unsaved changes are discarded
- Variables revert to last saved state
- Save button becomes disabled
- Confirmation dialog may appear for major changes

#### 4.5 Validate Environment Variable Names

**Steps:**
1. Navigate to Environment tab
2. Add new variable with invalid name:
   - `MY-VAR` (contains hyphen)
   - `123VAR` (starts with number)
   - `MY VAR` (contains space)
3. Attempt to save

**Expected Results:**
- Validation error appears for invalid names
- Save button remains disabled
- Error message explains naming rules
- Valid format: alphanumeric and underscores, cannot start with number

---

### 5. Authentication Settings

**Seed:** `e2e/seed.spec.ts`

#### 5.1 View Authentication Status

**Steps:**
1. Navigate to Settings > Authentication tab
2. Observe the authentication status display

**Expected Results:**
- Shows "No active authentication provider detected" if OAuth not configured
- Displays Terminal Key configuration section
- Displays OAuth Configuration section
- Current authentication method is clearly indicated

#### 5.2 Generate Secure Terminal Key

**Steps:**
1. Navigate to Authentication > Terminal Key section
2. Click "Generate Secure Key" button
3. Observe generated key

**Expected Results:**
- Secure random key is generated (minimum 8 characters)
- Key appears in Terminal Key input field
- Key uses secure random generation
- Key is masked by default (password field)
- Save button becomes enabled

#### 5.3 Show/Hide Terminal Key

**Steps:**
1. Navigate to Authentication > Terminal Key section
2. Enter or generate a terminal key
3. Click "Show terminal key" button
4. Click again to hide

**Expected Results:**
- Button toggles between show/hide icons
- Terminal key text visibility toggles
- Masked: shows bullets/asterisks
- Visible: shows plaintext key
- Toggle state doesn't persist (resets to hidden on reload)

#### 5.4 Save Terminal Key

**Steps:**
1. Navigate to Authentication > Terminal Key section
2. Enter or generate a new terminal key
3. Click "Save Authentication Settings"
4. Observe security warning

**Expected Results:**
- Security warning appears about session invalidation
- Save confirmation dialog may appear
- After save, success message displays
- Warning: "Changing authentication settings will invalidate all active sessions"
- User must re-authenticate after key change

#### 5.5 Configure OAuth Provider - Google

**Steps:**
1. Navigate to Authentication > OAuth Configuration
2. Select "Google" from OAuth Provider dropdown
3. Observe pre-configured fields

**Expected Results:**
- Provider dropdown shows Google selected
- Helpful guidance for Google OAuth appears
- Default scopes may be suggested
- Redirect URI example updates for Google
- Client ID and Secret fields remain for manual entry

#### 5.6 Configure OAuth Provider - GitHub

**Steps:**
1. Navigate to Authentication > OAuth Configuration
2. Select "GitHub" from OAuth Provider dropdown
3. Observe pre-configured fields

**Expected Results:**
- Provider dropdown shows GitHub selected
- GitHub-specific guidance appears
- Recommended scopes for GitHub shown
- Redirect URI example updates
- Links to GitHub OAuth documentation may appear

#### 5.7 Configure OAuth Provider - Custom

**Steps:**
1. Navigate to Authentication > OAuth Configuration
2. Select "Custom Provider" from dropdown
3. Enter client ID: `custom-client-123`
4. Enter client secret: `custom-secret-456`
5. Enter redirect URI: `https://example.com/callback`
6. Enter scope: `read write`
7. Click "Save Authentication Settings"

**Expected Results:**
- All fields are editable
- Generic scope suggestions appear (read, write, admin, OpenID Connect)
- Quick-set buttons for common scopes
- Redirect URI validation (must be valid URL)
- Save button enabled when all required fields filled

#### 5.8 Use Default Redirect URI

**Steps:**
1. Navigate to Authentication > OAuth Configuration
2. Leave Redirect URI empty or clear it
3. Click "Use Default" button

**Expected Results:**
- Redirect URI auto-fills with default value
- Format: `http://localhost:7173/api/auth/callback` (in test env)
- Example shown matches current domain
- Button becomes disabled after use (field already filled)

#### 5.9 OAuth Scope Quick-Set Buttons

**Steps:**
1. Navigate to Authentication > OAuth Configuration
2. Click "Read access" quick-set button
3. Observe OAuth Scope field

**Expected Results:**
- Scope field updates to `read`
- Clicking another button replaces the scope
- Multiple selections may append scopes (space-separated)
- Manual edits to scope field remain possible

---

### 6. Connectivity Settings

**Seed:** `e2e/seed.spec.ts`

#### 6.1 View LocalTunnel Status

**Steps:**
1. Navigate to Settings > Connectivity tab
2. Observe LocalTunnel section

**Expected Results:**
- Status shows "Disabled" by default
- Port displays current server port (7173 in test)
- Subdomain field is empty (optional)
- "Enable Tunnel" button is available

#### 6.2 Enable LocalTunnel with Random Subdomain

**Steps:**
1. Navigate to Connectivity > LocalTunnel
2. Leave subdomain field empty
3. Click "Enable Tunnel" button
4. Wait for tunnel to establish

**Expected Results:**
- Tunnel starts initializing
- Status changes to "Connecting..." then "Active"
- Random subdomain is assigned
- Public URL is displayed (e.g., `https://random-xyz.loca.lt`)
- Port remains unchanged (7173)
- Button changes to "Disable Tunnel"

#### 6.3 Enable LocalTunnel with Custom Subdomain

**Steps:**
1. Navigate to Connectivity > LocalTunnel
2. Enter custom subdomain: `my-dispatch-app`
3. Click "Update" button
4. Click "Enable Tunnel" button

**Expected Results:**
- Subdomain is validated (alphanumeric and hyphens)
- If available, tunnel uses custom subdomain
- Public URL: `https://my-dispatch-app.loca.lt`
- If subdomain taken, error message appears
- Fallback to random subdomain option

#### 6.4 Disable Active LocalTunnel

**Steps:**
1. Navigate to Connectivity with active tunnel
2. Click "Disable Tunnel" button
3. Observe status change

**Expected Results:**
- Tunnel shuts down gracefully
- Status changes to "Disabled"
- Public URL is removed
- Button text changes back to "Enable Tunnel"
- Subdomain field remains (for next use)

#### 6.5 View VS Code Tunnel Status

**Steps:**
1. Navigate to Connectivity > VS Code Remote Tunnel
2. Observe initial status

**Expected Results:**
- Status shows "Stopped" by default
- Tunnel Name field is empty (optional)
- Default tunnel name info displayed
- First-time setup instructions shown
- "Start Tunnel" button is available

#### 6.6 Start VS Code Tunnel with Default Name

**Steps:**
1. Navigate to Connectivity > VS Code Remote Tunnel
2. Leave Tunnel Name field empty
3. Click "Start Tunnel" button
4. Observe authentication flow

**Expected Results:**
- Tunnel initialization begins
- Device login URL appears (for Microsoft/GitHub auth)
- User must complete authentication in browser
- Default name format: `dispatch-[hostname]`
- Status updates to "Running" after auth
- Connection instructions appear

#### 6.7 Start VS Code Tunnel with Custom Name

**Steps:**
1. Navigate to Connectivity > VS Code Remote Tunnel
2. Enter custom tunnel name: `my-vscode-tunnel`
3. Click "Start Tunnel"
4. Complete authentication if needed

**Expected Results:**
- Custom tunnel name is used
- Tunnel appears in VS Code with custom name
- Validation: name must be unique
- Name cannot contain spaces or special characters
- Error message if name already in use

#### 6.8 Stop Active VS Code Tunnel

**Steps:**
1. Navigate to Connectivity with running VS Code tunnel
2. Click "Stop Tunnel" button
3. Observe shutdown

**Expected Results:**
- Tunnel stops gracefully
- Status changes to "Stopped"
- Connection instructions disappear
- Tunnel name field is preserved
- Button text changes to "Start Tunnel"

---

### 7. Data & Storage Settings

**Seed:** `e2e/seed.spec.ts`

#### 7.1 View Browser Storage Usage

**Steps:**
1. Navigate to Settings > Data & Storage tab
2. Observe Browser Storage section

**Expected Results:**
- Current usage displays in bytes/KB/MB
- Percentage of quota used is shown
- Number of items stored is displayed
- "Refresh" button is available
- Initial values may be minimal in fresh test environment

#### 7.2 Refresh Browser Storage Stats

**Steps:**
1. Navigate to Data & Storage > Browser Storage
2. Note current usage stats
3. Click "Refresh" button
4. Observe updated stats

**Expected Results:**
- Loading indicator appears briefly
- Stats update to current values
- Refresh button temporarily disabled during refresh
- Real-time usage is displayed accurately

#### 7.3 Export Browser Data

**Steps:**
1. Navigate to Data & Storage > Backup & Restore
2. Click "Export Data" button
3. Observe download

**Expected Results:**
- JSON file download initiates
- Filename includes timestamp (e.g., `dispatch-backup-2025-10-10.json`)
- File contains all browser storage data
- Settings, session history, and cached data included
- File is valid JSON and can be re-imported

#### 7.4 Import Browser Data

**Steps:**
1. Navigate to Data & Storage > Backup & Restore
2. Click "Import Data" button
3. Select previously exported JSON file
4. Confirm import

**Expected Results:**
- File picker dialog opens
- Only JSON files are accepted
- Confirmation dialog warns about overwriting current data
- Import merges or replaces data based on settings
- Success message confirms import
- Page may reload to apply imported settings

#### 7.5 Clear All Browser Data

**Steps:**
1. Navigate to Data & Storage > Clear Browser Data
2. Click "Clear All" button
3. Confirm action in dialog

**Expected Results:**
- Confirmation dialog appears with warning
- Dialog explains all data will be removed
- After confirmation, all localStorage cleared
- Browser storage stats drop to 0
- User may be logged out and redirected to login
- Application returns to fresh state

#### 7.6 Clear Specific Data Categories

**Steps:**
1. Navigate to Data & Storage > Clear Browser Data
2. Click "Clear" button under Sessions category
3. Confirm action

**Expected Results:**
- Confirmation specific to category appears
- Only session data is removed
- Settings and cache remain intact
- Success message confirms partial clear
- Storage usage decreases accordingly

**Repeat for other categories:**
- Settings: Resets application settings to defaults
- Cache: Clears cached workspace and terminal data

#### 7.7 Configure Server Data Retention Policy

**Steps:**
1. Navigate to Data & Storage > Server Data Retention
2. Change Session Data Retention from 30 to 60 days
3. Change Log Retention from 7 to 14 days
4. Click "Save Policy" button

**Expected Results:**
- Spinbutton controls allow numeric input
- Values can be increased/decreased with arrows
- Minimum values enforced (e.g., 1 day)
- Save button enables when changes made
- Success message confirms policy update
- Settings persist after page reload

#### 7.8 Preview Retention Policy Changes

**Steps:**
1. Navigate to Data & Storage > Server Data Retention
2. Modify retention values
3. Click "Preview Changes" button
4. Review preview data

**Expected Results:**
- Preview modal/panel appears
- Shows which data will be affected
- Displays approximate data sizes to be removed
- No data is actually deleted yet
- "Apply" and "Cancel" options available
- Clear understanding of impact before committing

#### 7.9 Toggle Automatic Cleanup

**Steps:**
1. Navigate to Data & Storage > Server Data Retention
2. Observe "Enable automatic cleanup" checkbox state
3. Toggle checkbox on/off
4. Click "Save Policy"

**Expected Results:**
- Checkbox state toggles immediately
- When enabled: automatic cleanup runs based on schedule
- When disabled: data is never automatically deleted
- Manual cleanup remains available regardless
- Warning appears if disabling (data accumulation risk)

#### 7.10 Reset Retention Policy to Defaults

**Steps:**
1. Navigate to Data & Storage > Server Data Retention
2. Modify retention values
3. Click "Reset to Defaults" button
4. Observe changes

**Expected Results:**
- Confirmation dialog appears
- After confirmation, values reset:
  - Session Data: 30 days
  - Log Retention: 7 days
  - Automatic cleanup: Enabled
- Save button becomes disabled (no changes)
- Success message confirms reset

---

### 8. Claude Settings

**Seed:** `e2e/seed.spec.ts`

#### 8.1 View Claude Authentication Status

**Steps:**
1. Navigate to Settings > Claude tab
2. Observe authentication section

**Expected Results:**
- Shows "Claude Not Connected" if not authenticated
- Displays "Claude credentials file not found" message
- Two authentication options presented:
  1. OAuth Authentication (Recommended)
  2. Manual API Key
- Clear visual distinction between options

#### 8.2 Authenticate with Claude OAuth

**Steps:**
1. Navigate to Claude > Authentication
2. Click "Login with Claude" button
3. Follow OAuth flow (external)
4. Return to Dispatch after authorization

**Expected Results:**
- Button click redirects to Anthropic OAuth page
- User grants permissions on Anthropic site
- Redirect back to Dispatch settings
- Status updates to "Connected"
- User email/account info may display
- Session defaults become editable

#### 8.3 Authenticate with Claude API Key

**Steps:**
1. Navigate to Claude > Authentication
2. Click "Use API Key" button
3. Enter API key: `sk-ant-test-key-12345`
4. Click "Save" or "Verify"

**Expected Results:**
- Modal or expanded form appears
- API key input field (password type)
- Key validation occurs on save
- Valid key: Status changes to "Connected"
- Invalid key: Error message displays
- Key is stored securely (not in plaintext)

#### 8.4 Configure Default Claude Model

**Steps:**
1. Navigate to Claude > Session Defaults
2. Open "Default Model" dropdown
3. Select "Claude 3.5 Sonnet (Latest)"
4. Click "Save Settings"

**Expected Results:**
- Dropdown shows all available models:
  - Let Claude SDK choose
  - Claude 3.5 Sonnet (Latest)
  - Claude 3.5 Haiku
  - Claude 3 Opus
  - Claude 3 Sonnet
  - Claude 3 Haiku
- Selected model is highlighted
- Save button enables
- Setting applies to new Claude sessions
- Existing sessions unaffected

#### 8.5 Configure Fallback Model

**Steps:**
1. Navigate to Claude > Session Defaults
2. Open "Fallback Model (Optional)" dropdown
3. Select "Claude 3.5 Haiku"
4. Click "Save Settings"

**Expected Results:**
- Fallback model used if primary model unavailable
- "Use default fallback" option available
- Same model list as primary model
- Cannot select same model as both primary and fallback
- Validation error if conflict detected

#### 8.6 Set Custom System Prompt

**Steps:**
1. Navigate to Claude > Session Defaults
2. Enter in "Custom System Prompt" field:
   ```
   You are a senior software engineer specializing in JavaScript and TypeScript.
   Provide detailed explanations and best practices.
   ```
3. Click "Save Settings"

**Expected Results:**
- Multiline text input accepts custom prompt
- Replaces entire default system prompt
- Character count or limit may be shown
- Preview option may be available
- Applies to new Claude Code sessions
- Can be cleared to revert to default

#### 8.7 Append to System Prompt

**Steps:**
1. Navigate to Claude > Session Defaults
2. Clear "Custom System Prompt" (use default)
3. Enter in "Append System Prompt" field:
   ```
   Always use TypeScript strict mode.
   Prefer functional programming patterns.
   ```
4. Click "Save Settings"

**Expected Results:**
- Appends text to default system prompt
- Does not replace default prompt entirely
- Can be used alongside custom prompt
- Clear distinction in UI between custom and append
- Both fields can be used together

#### 8.8 Enable Continue Most Recent Conversation

**Steps:**
1. Navigate to Claude > Session Defaults
2. Check "Continue most recent conversation" checkbox
3. Click "Save Settings"

**Expected Results:**
- Checkbox toggles immediately
- When enabled, new Claude sessions resume last conversation
- Conversation history is maintained
- Can be disabled for fresh starts
- Setting persists across sessions

#### 8.9 Set Max Turns Limit

**Steps:**
1. Navigate to Claude > Session Defaults
2. Enter value in "Max Turns (Optional)": `50`
3. Click "Save Settings"

**Expected Results:**
- Numeric input accepts positive integers
- Spinbutton controls for increment/decrement
- Limits conversation turns to prevent runaway costs
- Empty/0 means unlimited
- Validation: minimum 1 if set

#### 8.10 Set Max Thinking Tokens

**Steps:**
1. Navigate to Claude > Session Defaults
2. Enter value in "Max Thinking Tokens (Optional)": `5000`
3. Click "Save Settings"

**Expected Results:**
- Numeric input for token limit
- Controls extended thinking for complex tasks
- Higher values allow deeper reasoning
- Lower values faster but less thorough
- Validation: must be positive integer
- Info tooltip explains thinking tokens

#### 8.11 Configure Advanced Settings - Permissions

**Steps:**
1. Navigate to Claude > Session Defaults > Advanced Settings
2. Expand advanced section (if collapsed)
3. Select permissions mode:
   - Default
   - Ask for permissions
   - Allow all
4. Click "Save Settings"

**Expected Results:**
- Permission modes clearly explained
- "Default": Follows Claude SDK defaults
- "Ask for permissions": Prompts user for each action
- "Allow all": Auto-approves all operations
- Security warning for "Allow all" mode
- Setting applies immediately to new sessions

#### 8.12 Configure Advanced Settings - Runtime

**Steps:**
1. Navigate to Claude > Advanced Settings
2. Select runtime:
   - Auto-detect
   - Node.js
   - Bun
   - Deno
3. Click "Save Settings"

**Expected Results:**
- Runtime selection dropdown available
- Auto-detect: Automatically determines runtime
- Manual selection overrides auto-detection
- Each runtime may have specific configuration
- Current runtime displayed if detected
- Validation ensures selected runtime is available

#### 8.13 Reset Claude Settings to Defaults

**Steps:**
1. Navigate to Claude > Session Defaults
2. Modify several settings (model, prompts, limits)
3. Click "Reset Defaults" button
4. Confirm reset

**Expected Results:**
- Confirmation dialog appears
- After confirmation, all settings reset:
  - Model: Claude 3.5 Sonnet (Latest)
  - Fallback: Use default fallback
  - Prompts: Cleared
  - Max turns: Unlimited
  - Max thinking tokens: Default
  - Continue conversation: Disabled
  - Permissions: Default
  - Runtime: Auto-detect
- Success message confirms reset
- Save button becomes disabled

---

### 9. Settings Persistence and State Management

**Seed:** `e2e/seed.spec.ts`

#### 9.1 Settings Persist After Page Reload

**Steps:**
1. Navigate to any settings tab
2. Modify multiple settings across different categories
3. Save changes
4. Reload the page
5. Verify settings are preserved

**Expected Results:**
- All saved settings remain after reload
- Unsaved changes are lost (expected behavior)
- Active tab may reset to default (Theme)
- Each category loads with previously saved values
- No data loss occurs

#### 9.2 Unsaved Changes Warning

**Steps:**
1. Navigate to any settings tab
2. Modify a setting
3. Do not save
4. Navigate to different settings tab
5. Observe warning (if implemented)

**Expected Results:**
- Warning dialog appears about unsaved changes
- Options: "Save Changes", "Discard Changes", "Cancel"
- Save: Applies changes and switches tabs
- Discard: Reverts changes and switches tabs
- Cancel: Remains on current tab
- No warning if no changes made

#### 9.3 Multiple Changes Across Tabs

**Steps:**
1. Make changes in Theme tab (activate different theme)
2. Navigate to Environment tab
3. Add environment variable
4. Navigate to Authentication tab
5. Generate new terminal key
6. Save each category independently

**Expected Results:**
- Each category maintains its own state
- Unsaved changes in one tab don't affect others
- Save buttons are per-category (not global)
- All changes can be saved together or separately
- Clear indication of which categories have unsaved changes

---

### 10. Error Handling and Validation

**Seed:** `e2e/seed.spec.ts`

#### 10.1 Network Error During Save

**Steps:**
1. Navigate to any settings tab
2. Make changes
3. Disconnect network or simulate network error
4. Click "Save" button
5. Observe error handling

**Expected Results:**
- Error message displays clearly
- Message indicates network problem
- Changes remain in UI (not lost)
- User can retry save
- Helpful guidance provided (e.g., "Check connection and retry")

#### 10.2 Invalid Input Validation

**Steps:**
1. Navigate to Environment Variables
2. Enter invalid variable name: `MY-INVALID-VAR`
3. Attempt to save
4. Observe validation error

**Expected Results:**
- Inline validation error appears
- Error message specific to problem
- Invalid field is highlighted
- Save button remains disabled
- Error clears when input corrected

#### 10.3 Server-Side Validation Errors

**Steps:**
1. Navigate to Authentication > OAuth
2. Enter OAuth credentials with invalid format
3. Save settings
4. Observe server validation response

**Expected Results:**
- Server validation runs after client validation
- Specific error messages returned
- Errors displayed near relevant fields
- Changes not saved if validation fails
- Clear explanation of required format

#### 10.4 Concurrent Modification Conflict

**Steps:**
1. Open settings in two browser tabs
2. In Tab 1: Modify theme setting
3. In Tab 2: Modify same theme setting differently
4. Save in Tab 1
5. Save in Tab 2
6. Observe conflict handling

**Expected Results:**
- Conflict detection occurs
- Warning about concurrent modification
- Options to:
  - Overwrite with current changes
  - Reload and see other tab's changes
  - Merge changes (if applicable)
- No silent data loss

---

### 11. Accessibility and Usability

**Seed:** `e2e/seed.spec.ts`

#### 11.1 Keyboard Navigation

**Steps:**
1. Navigate to settings page
2. Use Tab key to navigate between elements
3. Use arrow keys in dropdowns
4. Use Enter to activate buttons
5. Navigate through all tabs using keyboard only

**Expected Results:**
- Tab order is logical (top to bottom, left to right)
- Focus indicators are clearly visible
- All interactive elements are keyboard accessible
- Tab key cycles through tabs
- Arrow keys navigate within components
- Enter/Space activate buttons
- Escape closes modals

#### 11.2 Screen Reader Compatibility

**Steps:**
1. Enable screen reader (e.g., NVDA, JAWS, VoiceOver)
2. Navigate settings page
3. Verify all elements are announced correctly

**Expected Results:**
- Page title announced on load
- Tab labels read correctly
- Form labels associated with inputs
- Button purposes clear
- Error messages announced
- Status changes announced
- ARIA labels used appropriately

#### 11.3 Responsive Design - Mobile View

**Steps:**
1. Resize browser to mobile width (320px - 480px)
2. Navigate through all settings tabs
3. Interact with various controls

**Expected Results:**
- Settings interface adapts to narrow width
- Tabs may stack vertically or become dropdown
- Tables may scroll horizontally
- Modals fit within viewport
- Touch targets are adequate size (min 44x44px)
- Text remains readable
- No horizontal scrolling on main page

#### 11.4 Responsive Design - Tablet View

**Steps:**
1. Resize browser to tablet width (768px - 1024px)
2. Navigate settings page in both portrait and landscape

**Expected Results:**
- Layout optimized for medium screens
- Tabs displayed horizontally
- Two-column layouts where appropriate
- Content comfortably readable
- No wasted space

---

### 12. Integration with Other Features

**Seed:** `e2e/seed.spec.ts`

#### 12.1 Theme Change Applies to Active Sessions

**Steps:**
1. Create a terminal session
2. Navigate to Settings > Theme
3. Activate different theme
4. Return to terminal session

**Expected Results:**
- Terminal session immediately updates to new theme
- Colors match selected theme palette
- No session restart required
- All active sessions update simultaneously

#### 12.2 Environment Variables Apply to New Sessions

**Steps:**
1. Navigate to Settings > Environment
2. Add variable: `TEST_VAR=hello`
3. Save changes
4. Create new terminal session
5. Run: `echo $TEST_VAR`

**Expected Results:**
- New environment variable is available
- Terminal displays "hello"
- Variable applies to all new sessions
- Existing sessions do not receive new variable (expected)

#### 12.3 Authentication Key Change Invalidates Sessions

**Steps:**
1. Create active terminal session
2. Navigate to Settings > Authentication
3. Generate new terminal key
4. Save changes
5. Observe session behavior

**Expected Results:**
- Warning dialog about session invalidation
- After save, active sessions are terminated
- User is logged out
- Must authenticate with new key
- Clear messaging about what happened

---

## Edge Cases and Boundary Conditions

### 13. Edge Case Scenarios

**Seed:** `e2e/seed.spec.ts`

#### 13.1 Extremely Long Environment Variable Value

**Steps:**
1. Navigate to Environment tab
2. Add variable with very long value (10,000+ characters)
3. Attempt to save

**Expected Results:**
- Validation limit enforced (if any)
- Error message if too long
- Or: System accepts and handles appropriately
- No UI breaking or performance issues

#### 13.2 Special Characters in Configuration

**Steps:**
1. Test special characters in various fields:
   - Environment variable values: `\n`, `\t`, quotes
   - OAuth redirect URI: international characters
   - Custom prompts: emojis, unicode
2. Save and verify handling

**Expected Results:**
- Special characters properly escaped
- Unicode support works correctly
- No SQL injection or XSS vulnerabilities
- Proper encoding/decoding

#### 13.3 Maximum Number of Environment Variables

**Steps:**
1. Navigate to Environment tab
2. Add 100+ environment variables
3. Save changes
4. Observe performance and UI behavior

**Expected Results:**
- System handles large number gracefully
- Scrolling remains smooth
- Save operation completes
- Or: Reasonable limit enforced with clear message

#### 13.4 Session Timeout During Settings Edit

**Steps:**
1. Begin editing settings
2. Leave page idle for extended period (30+ minutes)
3. Attempt to save changes

**Expected Results:**
- Session expiration detected
- User notified of timeout
- Changes preserved in browser (if possible)
- Redirect to login with return path
- After re-auth, can complete save

---

## Performance and Load Testing

### 14. Performance Scenarios

**Seed:** `e2e/seed.spec.ts`

#### 14.1 Settings Page Load Time

**Steps:**
1. Clear browser cache
2. Navigate to `/settings`
3. Measure time to interactive

**Expected Results:**
- Page loads in <2 seconds on normal connection
- Progressive rendering (content appears quickly)
- No layout shifts during load
- All tabs accessible within 3 seconds

#### 14.2 Large File Upload Performance

**Steps:**
1. Navigate to Home Directory tab
2. Upload file approaching 5MB limit (for themes)
3. Monitor upload progress

**Expected Results:**
- Progress indicator shows upload status
- No UI freezing during upload
- Upload completes successfully
- Error handling for files exceeding limit

---

## Security Testing

### 15. Security Scenarios

**Seed:** `e2e/seed.spec.ts`

#### 15.1 XSS Protection in Input Fields

**Steps:**
1. Navigate to Environment Variables
2. Attempt to inject script in value: `<script>alert('xss')</script>`
3. Save and verify rendering

**Expected Results:**
- Script is escaped/sanitized
- No script execution occurs
- Value stored safely
- When displayed, shows as text not HTML

#### 15.2 SQL Injection Prevention

**Steps:**
1. Navigate to various input fields
2. Enter SQL injection patterns:
   - `'; DROP TABLE sessions; --`
   - `1' OR '1'='1`
3. Save settings

**Expected Results:**
- Inputs properly parameterized
- No database errors
- No unauthorized data access
- Values treated as data, not commands

#### 15.3 OAuth Redirect URI Validation

**Steps:**
1. Navigate to Authentication > OAuth
2. Enter malicious redirect URI:
   - `javascript:alert('xss')`
   - `data:text/html,<script>alert(1)</script>`
3. Attempt to save

**Expected Results:**
- Validation rejects non-HTTP(S) URIs
- Error message explains required format
- Save blocked for invalid URIs
- Only valid https:// or http:// (localhost) accepted

---

## Recommended Test Helpers and Utilities

Based on this comprehensive test plan, the following test helpers would be valuable:

### Settings Helpers (`e2e/helpers/settings-helpers.js`)

```javascript
// Navigation helpers
async function navigateToSettings(page)
async function navigateToSettingsTab(page, tabName)

// Theme helpers
async function activateTheme(page, themeName)
async function uploadCustomTheme(page, themeFilePath)

// Environment variable helpers
async function addEnvironmentVariable(page, name, value)
async function removeEnvironmentVariable(page, name)
async function getAllEnvironmentVariables(page)

// Authentication helpers
async function generateTerminalKey(page)
async function setOAuthProvider(page, provider, config)

// Connectivity helpers
async function enableLocalTunnel(page, subdomain)
async function startVSCodeTunnel(page, tunnelName)

// Storage helpers
async function exportBrowserData(page)
async function importBrowserData(page, dataFilePath)
async function clearBrowserData(page, category)
async function setRetentionPolicy(page, policy)

// Claude helpers
async function authenticateClaudeOAuth(page)
async function setClaudeDefaults(page, config)

// Validation helpers
async function waitForSaveSuccess(page)
async function getValidationErrors(page)
async function verifySettingsPersisted(page, expectedSettings)
```

### Test Data Generators

```javascript
// Generate test environment variables
function generateEnvVars(count)

// Generate test theme JSON
function generateCustomTheme(name, colors)

// Generate OAuth configuration
function generateOAuthConfig(provider)
```

---

## Test File Organization

### Recommended Test File Structure

```
e2e/
├── settings/
│   ├── settings-navigation.spec.ts        # Scenarios 1.x
│   ├── settings-theme.spec.ts             # Scenarios 2.x
│   ├── settings-home-directory.spec.ts    # Scenarios 3.x
│   ├── settings-environment.spec.ts       # Scenarios 4.x
│   ├── settings-authentication.spec.ts    # Scenarios 5.x
│   ├── settings-connectivity.spec.ts      # Scenarios 6.x
│   ├── settings-storage.spec.ts           # Scenarios 7.x
│   ├── settings-claude.spec.ts            # Scenarios 8.x
│   ├── settings-persistence.spec.ts       # Scenarios 9.x
│   ├── settings-validation.spec.ts        # Scenarios 10.x
│   ├── settings-accessibility.spec.ts     # Scenarios 11.x
│   ├── settings-integration.spec.ts       # Scenarios 12.x
│   ├── settings-edge-cases.spec.ts        # Scenarios 13.x
│   ├── settings-performance.spec.ts       # Scenarios 14.x
│   └── settings-security.spec.ts          # Scenarios 15.x
└── helpers/
    └── settings-helpers.js
```

---

## Summary

This test plan covers **84 distinct test scenarios** across 15 major categories:

1. **Navigation & Access** (3 scenarios)
2. **Theme Settings** (4 scenarios)
3. **Home Directory** (5 scenarios)
4. **Environment Variables** (5 scenarios)
5. **Authentication** (9 scenarios)
6. **Connectivity** (8 scenarios)
7. **Data & Storage** (10 scenarios)
8. **Claude Settings** (13 scenarios)
9. **Persistence** (3 scenarios)
10. **Error Handling** (4 scenarios)
11. **Accessibility** (4 scenarios)
12. **Integration** (3 scenarios)
13. **Edge Cases** (4 scenarios)
14. **Performance** (2 scenarios)
15. **Security** (3 scenarios)

Each scenario includes:
- Clear step-by-step instructions
- Expected results for verification
- Edge cases and error conditions
- Integration points with other features

This comprehensive test plan ensures thorough coverage of the Dispatch settings interface, from basic functionality to advanced configuration, accessibility, security, and performance considerations.
