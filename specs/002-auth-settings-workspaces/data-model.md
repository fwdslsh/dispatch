# Data Model: UI Components for Authentication, Workspace Management, and Maintenance

## Core Entities

### OnboardingState

Tracks user progress through initial setup and onboarding workflow.

**Fields**:

- `userId` (string): User identifier (derived from terminal key)
- `currentStep` (string): Current onboarding step ('auth', 'workspace', 'settings', 'complete')
- `completedSteps` (array): List of completed onboarding steps
- `isComplete` (boolean): Whether onboarding has been finished
- `firstWorkspaceId` (string, optional): ID of first workspace created during onboarding
- `createdAt` (timestamp): When onboarding started
- `completedAt` (timestamp, optional): When onboarding was completed

**Validation Rules**:

- `currentStep` must be one of: 'auth', 'workspace', 'settings', 'complete'
- `completedSteps` can only contain valid step names
- `isComplete` is true only when `currentStep` is 'complete'
- `completedAt` is required when `isComplete` is true

**State Transitions**:

- auth → workspace → settings → complete
- Users can skip 'settings' step (progressive onboarding)
- Once complete, onboarding cannot be reset without manual intervention

### WorkspaceNavigationState

Manages active workspace selection, workspace list, and navigation history.

**Fields**:

- `activeWorkspaceId` (string): Currently selected workspace ID
- `workspaceList` (array): List of available workspaces with metadata
- `navigationHistory` (array): Recent workspace switches for quick access
- `lastSwitchTime` (timestamp): When last workspace switch occurred
- `preferences` (object): User preferences for workspace display and ordering

**Validation Rules**:

- `activeWorkspaceId` must reference existing workspace
- `workspaceList` entries must have required workspace fields
- `navigationHistory` limited to last 10 workspaces
- `preferences` follows schema for display options

**Relationships**:

- References `workspaces` table entries
- Linked to `sessions` table for workspace-session associations

### RetentionPolicy

Defines data retention rules with configurable time periods and affected data types.

**Fields**:

- `id` (string): Unique policy identifier
- `userId` (string): User who owns this policy
- `sessionRetentionDays` (number): Days to retain session data (default: 30)
- `logRetentionDays` (number): Days to retain log data (default: 7)
- `autoCleanupEnabled` (boolean): Whether automatic cleanup is active
- `lastCleanupRun` (timestamp, optional): When cleanup was last executed
- `previewSummary` (string, optional): Cached summary of what cleanup would affect

**Validation Rules**:

- Retention days must be positive integers
- `sessionRetentionDays` minimum: 1 day, maximum: 365 days
- `logRetentionDays` minimum: 1 day, maximum: 90 days
- `previewSummary` updated when policy changes

**Business Logic**:

- Default policy created during onboarding if user chooses settings step
- Policy changes trigger preview calculation before applying
- Cleanup execution logged to audit trail

### UserPreferences

Stores user-specific settings including onboarding completion status and UI preferences.

**Fields**:

- `userId` (string): User identifier
- `onboardingCompleted` (boolean): Whether user has finished onboarding
- `themePreference` (string): UI theme choice ('auto', 'light', 'dark')
- `workspaceDisplayMode` (string): How workspaces are shown ('list', 'grid', 'compact')
- `showAdvancedFeatures` (boolean): Whether to show advanced UI options
- `sessionAutoConnect` (boolean): Auto-connect to last session on workspace switch
- `updatedAt` (timestamp): When preferences were last modified

**Validation Rules**:

- `themePreference` must be 'auto', 'light', or 'dark'
- `workspaceDisplayMode` must be 'list', 'grid', or 'compact'
- All boolean fields default to reasonable values

**Persistence**:

- Stored in SQLite database for consistency
- Cached in browser storage for immediate UI responsiveness
- Synchronized on login/session start

## Database Schema Extensions

### New Tables

```sql
-- Onboarding state tracking
CREATE TABLE onboarding_state (
    user_id TEXT PRIMARY KEY,
    current_step TEXT NOT NULL DEFAULT 'auth',
    completed_steps TEXT NOT NULL DEFAULT '[]', -- JSON array
    is_complete BOOLEAN NOT NULL DEFAULT FALSE,
    first_workspace_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (first_workspace_id) REFERENCES workspaces(id)
);

-- Retention policies
CREATE TABLE retention_policies (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_retention_days INTEGER NOT NULL DEFAULT 30,
    log_retention_days INTEGER NOT NULL DEFAULT 7,
    auto_cleanup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_cleanup_run TEXT,
    preview_summary TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User preferences
CREATE TABLE user_preferences (
    user_id TEXT PRIMARY KEY,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    theme_preference TEXT NOT NULL DEFAULT 'auto',
    workspace_display_mode TEXT NOT NULL DEFAULT 'list',
    show_advanced_features BOOLEAN NOT NULL DEFAULT FALSE,
    session_auto_connect BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Enhanced Existing Tables

```sql
-- Add onboarding context to sessions
ALTER TABLE sessions ADD COLUMN is_onboarding_session BOOLEAN DEFAULT FALSE;

-- Add workspace navigation context to workspace_layout
ALTER TABLE workspace_layout ADD COLUMN navigation_history TEXT DEFAULT '[]';
```

## Frontend State Models

### OnboardingViewModel

```javascript
class OnboardingViewModel {
	currentStep = $state('auth');
	isComplete = $state(false);
	completedSteps = $state([]);

	// Derived state
	canProceed = $derived.by(() => this.validateCurrentStep());
	progressPercentage = $derived.by(() => (this.completedSteps.length / 4) * 100);
}
```

### WorkspaceNavigationViewModel

```javascript
class WorkspaceNavigationViewModel {
	activeWorkspace = $state(null);
	workspaces = $state([]);
	isLoading = $state(false);

	// Derived state
	recentWorkspaces = $derived.by(() => this.workspaces.filter((w) => w.lastActive).slice(0, 5));
}
```

### RetentionPolicyViewModel

```javascript
class RetentionPolicyViewModel {
	sessionDays = $state(30);
	logDays = $state(7);
	autoCleanup = $state(true);
	previewSummary = $state('');

	// Derived state
	hasChanges = $derived.by(() => this.detectChanges());
	isValid = $derived.by(() => this.validatePolicy());
}
```
