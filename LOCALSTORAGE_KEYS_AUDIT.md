# localStorage Keys Audit

This document catalogs all localStorage keys used throughout the Dispatch application, their purposes, and their current usage patterns. This audit is critical for the workspace refactoring to ensure proper migration and consolidation.

## Centralized Keys (from STORAGE_CONFIG)

### Authentication & Security
- `dispatch-auth-key` - Stores the authentication token for API access
  - **Usage**: Primary authentication mechanism across the app
  - **Files**: Multiple components reference this for API calls
  - **Security Note**: Contains sensitive authentication data

### Application Settings
- `dispatch-settings` - General application settings object
  - **Usage**: Global app configuration and user preferences
  - **Files**: Settings components, workspace components
  - **Format**: JSON object containing various setting properties

- `dispatch-theme` - Theme preference storage
  - **Usage**: Stores user's theme selection (light/dark/auto)
  - **Files**: Theme management components
  - **Format**: String value

### Session Management
- `dispatch-session-id` - Current session identifier
  - **Usage**: Session state persistence
  - **Files**: Session management components
  - **Format**: String session ID

### Temporary Data
- `dispatch-temp` - Temporary session storage data
  - **Usage**: Short-term data storage that doesn't persist across sessions
  - **Files**: Various components for temporary state
  - **Format**: Variable (JSON objects, strings)

- `dispatch-nav` - Navigation state storage
  - **Usage**: Preserves navigation state across page reloads
  - **Files**: Navigation components
  - **Format**: JSON object

## Dynamic/Prefixed Keys

### Session History (Prefix: `dispatch-session-history-`)
- Pattern: `dispatch-session-history-{sessionId}`
- **Usage**: Stores command/interaction history per session
- **Files**: Session management components
- **Format**: Array of history items
- **Cleanup**: Should be cleaned up when sessions end

### Terminal State (Prefix: `dispatch-terminal-`)
- Pattern: `dispatch-terminal-{terminalId}`
- **Usage**: Preserves terminal-specific state and configuration
- **Files**: Terminal components
- **Format**: JSON object with terminal state

### Claude Commands Cache (Prefix: `claude-commands-`)
- Pattern: `claude-commands-{workspacePath}`
- **Usage**: Caches available Claude commands per workspace for performance
- **Files**: `src/lib/client/claude/ClaudeCommands.svelte`
- **Format**: JSON object with commands and metadata
- **TTL**: Has expiration logic to prevent stale data

### Command Cache (Prefix: `command-cache-`)
- Pattern: `command-cache-{sessionId}`
- **Usage**: Caches command results for performance
- **Files**: `src/lib/client/shared/components/CommandService.js`
- **Format**: JSON object with cached command data
- **TTL**: Includes timestamp for cache invalidation

## Legacy/Inconsistent Keys

### Workspace Layout (Non-centralized)
- `dispatch-projects-layout` - Layout preference for workspace/projects view
  - **Location**: `src/routes/workspace/+page.svelte` (local STORAGE constant)
  - **Usage**: Stores layout preset (2up, 4up, etc.)
  - **Issue**: Should be moved to centralized STORAGE_CONFIG

- `dispatch-projects-current-mobile` - Mobile session index tracking
  - **Location**: `src/routes/workspace/+page.svelte` (local STORAGE constant)
  - **Usage**: Tracks which session is currently displayed on mobile
  - **Issue**: Should be moved to centralized STORAGE_CONFIG

### Sidebar State (Testing page)
- `dispatch-sidebar-collapsed` - Sidebar collapse state (testing interface)
  - **Location**: `src/routes/_testing/+page.svelte`
  - **Usage**: Preserves sidebar state in testing interface
  - **Issue**: Should use centralized pattern

### Workspace History
- `dispatch-workspace-history` - Workspace access history
  - **Location**: `src/lib/client/shared/components/Settings/WorkspaceSettings.svelte`
  - **Usage**: Tracks recently accessed workspaces
  - **Format**: JSON array of workspace objects

### PWA State
- `pwa-ios-prompt-shown` - PWA install prompt state for iOS
  - **Location**: `src/lib/client/shared/components/PWAInstallPrompt.svelte`
  - **Usage**: Prevents repeated PWA install prompts
  - **Format**: String 'true' when shown

## Test-Specific Keys

### Development/Testing
- `dispatch-auth-token` - Alternative auth key used in tests
  - **Usage**: E2E tests and some development scenarios
  - **Issue**: Inconsistent with main `dispatch-auth-key`

- `terminalKey` - Legacy auth key pattern
  - **Usage**: Some older test files
  - **Issue**: Should be standardized

## Storage Patterns Analysis

### Inconsistencies Identified

1. **Mixed Key Formats**:
   - Some keys use `dispatch-auth-key` pattern
   - Others use `dispatch-auth-token`
   - Inconsistent hyphen vs underscore usage

2. **Decentralized Constants**:
   - Local STORAGE objects in individual components
   - Should all reference centralized STORAGE_CONFIG

3. **No Unified Cleanup Strategy**:
   - Some prefixed keys accumulate without cleanup
   - No systematic approach to removing stale data

4. **Security Concerns**:
   - Authentication tokens stored in localStorage (XSS vulnerable)
   - No encryption for sensitive data

### Recommendations for Refactoring

#### 1. Consolidate All Keys in STORAGE_CONFIG
Move all localStorage keys to the centralized constants file:

```javascript
export const STORAGE_CONFIG = {
  // Authentication
  AUTH_TOKEN_KEY: 'dispatch-auth-key',

  // Application State
  SETTINGS_KEY: 'dispatch-settings',
  THEME_KEY: 'dispatch-theme',

  // Workspace/Layout
  LAYOUT_KEY: 'dispatch-layout',
  MOBILE_INDEX_KEY: 'dispatch-mobile-index',
  WORKSPACE_HISTORY_KEY: 'dispatch-workspace-history',

  // UI State
  SIDEBAR_STATE_KEY: 'dispatch-sidebar-state',

  // PWA
  PWA_PROMPT_SHOWN_KEY: 'dispatch-pwa-prompt-shown',

  // Prefixes for dynamic keys
  SESSION_HISTORY_PREFIX: 'dispatch-session-history-',
  TERMINAL_STATE_PREFIX: 'dispatch-terminal-',
  CLAUDE_COMMANDS_PREFIX: 'dispatch-claude-commands-',
  COMMAND_CACHE_PREFIX: 'dispatch-command-cache-'
};
```

#### 2. Implement PersistenceService
Create a unified service for localStorage operations:
- Standardized get/set operations
- Automatic JSON serialization/deserialization
- Error handling and fallbacks
- Cleanup utilities for prefixed keys
- Storage quota monitoring

#### 3. Migration Strategy
- Map old keys to new standardized keys
- Implement migration logic in PersistenceService
- Graceful fallback for missing data
- Clear old keys after successful migration

#### 4. Security Improvements
- Consider sessionStorage for sensitive data
- Implement token encryption/obfuscation
- Add CSRF protection measures
- Regular cleanup of sensitive data

## Migration Checklist

### Phase 1: Service Implementation
- [ ] Create PersistenceService with standardized interface
- [ ] Update STORAGE_CONFIG with all keys
- [ ] Implement key migration logic

### Phase 2: Component Updates
- [ ] Update workspace page to use centralized keys
- [ ] Update testing page to use centralized keys
- [ ] Update all components to use PersistenceService
- [ ] Remove local STORAGE constants

### Phase 3: Cleanup & Security
- [ ] Implement automatic cleanup for prefixed keys
- [ ] Add storage quota monitoring
- [ ] Implement security improvements
- [ ] Add comprehensive tests for persistence layer

## Current Storage Usage Summary

**Total Unique Key Patterns**: ~15+ different localStorage keys
**Components Using localStorage**: 15+ files across the codebase
**Security Risk Level**: Medium (auth tokens in localStorage)
**Consolidation Priority**: High (critical for MVVM refactor)

The refactoring will standardize all localStorage usage through the PersistenceService, providing a clean, secure, and maintainable storage layer for the new MVVM architecture.