# Settings Registry Refactor

**Status:** Pending
**Created:** 2025-10-11
**Category:** Architecture Improvement

## Overview

Refactor the settings system to support plugin-based registration, allowing session type adapters to automatically contribute settings sections without manual hardcoding.

## Current State Analysis

### Architecture

```
src/lib/client/settings/
├── pageState.js               # Hardcoded SETTINGS_SECTIONS array
├── SettingsViewModel.svelte.js # Category-based settings management
├── sections/                   # Individual setting sections
│   ├── Claude.svelte          # Claude auth + defaults (complex)
│   ├── Tunnels.svelte         # LocalTunnel + VS Code tunnels
│   ├── WorkspaceEnvSettings.svelte
│   ├── HomeDirectoryManager.svelte
│   ├── DataManagement.svelte
│   ├── KeysSettings.svelte
│   └── OAuthSettings.svelte
└── [component files]
```

### Key Issues

1. **Hardcoded Registration** - Settings sections manually added to `pageState.js:SETTINGS_SECTIONS` array (lines 21-74)
   - New session adapters cannot self-register settings
   - Requires modifying core settings code for each new adapter

2. **No Plugin Architecture** - Unlike session modules which use `registerClientSessionModules()`, settings have no registration mechanism
   - Compare with `src/lib/client/shared/session-modules/index.js` which has clean registration

3. **Existing Components Work Well** - Current sections are appropriately scoped
   - `Claude.svelte` contains both authentication and session defaults, which is reasonable as they're both Claude-specific settings
   - `Tunnels.svelte` manages both LocalTunnel and VS Code Remote Tunnel, which is acceptable as they're both connectivity features

4. **Unused Module Integration** - Session modules define `settingsComponent` property that's never used
   - See `src/lib/client/claude/claude.js:13` - `settingsComponent: ClaudeSettings`
   - No connection between session modules and settings page

5. **Legacy Components** - Potential duplication in authentication UI
   - `AuthenticationSettingsSection.svelte`
   - `OAuthSettings.svelte`
   - `ApiKeyManager.svelte`

### Current Section Order (from pageState.js)

```javascript
const SETTINGS_SECTIONS = [
  { id: 'themes', ... },              // line 23
  { id: 'home', ... },                // line 31
  { id: 'workspace-env', ... },       // line 38
  KEYS_SECTION,                       // line 45 (imported from keysSection.js)
  { id: 'authentication', ... },      // line 46 (OAuth)
  { id: 'tunnels', ... },             // line 54 (Connectivity)
  { id: 'data-management', ... },     // line 61
  { id: 'claude', ... }               // line 68
];
```

## Problems

### 1. Tight Coupling
Adding a new session adapter requires:
- Creating settings component
- Manually editing `pageState.js` to add section
- Importing component and icon
- Choosing insertion point in hardcoded array

### 2. Poor Scalability
As more session types are added (WebContainers, Jupyter, etc.), `pageState.js` becomes a bottleneck with increasing imports and array management.

### 3. Inconsistent Architecture
- Session adapters use plugin pattern: `registerClientSessionModules()`
- Settings use hardcoded array: `SETTINGS_SECTIONS`
- No architectural consistency

### 4. Component Scope
Current component organization is reasonable:
- Claude.svelte combines related Claude-specific features (auth + session defaults)
- Tunnels.svelte combines related connectivity features (LocalTunnel + VS Code)
- Components are appropriately sized and focused on their domain

## Proposed Solution

### Phase 1: Settings Registry System

Create a plugin-based registration system mirroring the session modules pattern.

**New file:** `src/lib/client/settings/registry/settings-registry.js`

```javascript
/**
 * Settings Registry - Plugin-based settings section registration
 */

const settingsSections = new Map();
const settingsCategories = new Map();

/**
 * Register a settings section
 * @param {Object} section - Section definition
 * @param {string} section.id - Unique section identifier
 * @param {string} section.label - Display label for navigation
 * @param {string} section.category - Category for grouping ('core', 'auth', 'connectivity', 'sessions')
 * @param {Component} section.icon - Svelte icon component
 * @param {Component} section.component - Svelte settings component
 * @param {string} section.navAriaLabel - Accessibility label
 * @param {number} [section.order=100] - Display order (lower = earlier)
 */
export function registerSettingsSection(section) {
  if (!section?.id || !section?.component) {
    console.warn('[Settings Registry] Invalid section:', section);
    return;
  }

  settingsSections.set(section.id, {
    order: 100,
    category: 'core',
    ...section
  });

  // Group by category
  const category = section.category || 'core';
  if (!settingsCategories.has(category)) {
    settingsCategories.set(category, []);
  }
  settingsCategories.get(category).push(section);
}

/**
 * Get all registered settings sections, sorted by order
 */
export function getSettingsSections() {
  return Array.from(settingsSections.values())
    .sort((a, b) => (a.order || 100) - (b.order || 100));
}

/**
 * Get settings sections by category
 */
export function getSettingsByCategory(category) {
  return (settingsCategories.get(category) || [])
    .sort((a, b) => (a.order || 100) - (b.order || 100));
}

/**
 * Get all categories
 */
export function getCategories() {
  return Array.from(settingsCategories.keys());
}

/**
 * Unregister a section (useful for testing)
 */
export function unregisterSettingsSection(id) {
  const section = settingsSections.get(id);
  if (section) {
    settingsSections.delete(id);
    // Remove from category
    const categoryList = settingsCategories.get(section.category);
    if (categoryList) {
      const index = categoryList.findIndex(s => s.id === id);
      if (index !== -1) categoryList.splice(index, 1);
    }
  }
}

/**
 * Clear all registrations (useful for testing)
 */
export function clearSettingsRegistry() {
  settingsSections.clear();
  settingsCategories.clear();
}
```

### Phase 2: Core Settings Registration

**New file:** `src/lib/client/settings/registry/core-sections.js`

```javascript
/**
 * Core Settings Sections
 * Non-session-specific settings that are part of the core application
 */

import { registerSettingsSection } from './settings-registry.js';
import ThemeSettings from '../sections/core/Themes.svelte';
import HomeDirectoryManager from '../sections/core/HomeDirectoryManager.svelte';
import WorkspaceEnvSettings from '../sections/core/WorkspaceEnv.svelte';
import DataManagement from '../sections/core/DataManagement.svelte';
import OAuthSettings from '../sections/auth/OAuth.svelte';
import ApiKeysSettings from '../sections/auth/ApiKeys.svelte';
import TunnelsSettings from '../sections/connectivity/Tunnels.svelte';

import IconFolder from '$lib/client/shared/components/Icons/IconFolder.svelte';
import IconUser from '$lib/client/shared/components/Icons/IconUser.svelte';
import IconCloud from '$lib/client/shared/components/Icons/IconCloud.svelte';
import IconArchive from '$lib/client/shared/components/Icons/IconArchive.svelte';
import IconKey from '$lib/client/shared/components/Icons/IconKey.svelte';
import IconAdjustmentsAlt from '$lib/client/shared/components/Icons/IconAdjustmentsAlt.svelte';
import IconSettings from '$lib/client/shared/components/Icons/IconSettings.svelte';

/**
 * Register all core settings sections
 * Called during app initialization
 */
export function registerCoreSettings() {
  // Appearance (order 10)
  registerSettingsSection({
    id: 'themes',
    label: 'Theme',
    category: 'core',
    navAriaLabel: 'Color themes and appearance settings',
    icon: IconAdjustmentsAlt,
    component: ThemeSettings,
    order: 10
  });

  // Workspace (order 20-30)
  registerSettingsSection({
    id: 'home',
    label: 'Home Directory',
    category: 'core',
    navAriaLabel: 'File browser and home directory manager',
    icon: IconFolder,
    component: HomeDirectoryManager,
    order: 20
  });

  registerSettingsSection({
    id: 'workspace-env',
    label: 'Environment',
    category: 'core',
    navAriaLabel: 'Environment settings for your workspace',
    icon: IconSettings,
    component: WorkspaceEnvSettings,
    order: 30
  });

  // Authentication (order 40-50)
  registerSettingsSection({
    id: 'keys',
    label: 'Keys',
    category: 'auth',
    navAriaLabel: 'API key management',
    icon: IconKey,
    component: ApiKeysSettings,
    order: 40
  });

  registerSettingsSection({
    id: 'oauth',
    label: 'OAuth',
    category: 'auth',
    navAriaLabel: 'OAuth provider configuration',
    icon: IconUser,
    component: OAuthSettings,
    order: 50
  });

  // Connectivity (order 60)
  registerSettingsSection({
    id: 'tunnels',
    label: 'Connectivity',
    category: 'connectivity',
    navAriaLabel: 'Remote tunnel settings for external access',
    icon: IconCloud,
    component: TunnelsSettings,
    order: 60
  });

  // Session Settings (order 70)
  registerSettingsSection({
    id: 'claude',
    label: 'Claude',
    category: 'sessions',
    navAriaLabel: 'Claude authentication and session settings',
    icon: ClaudeIcon,
    component: ClaudeSettings,
    order: 70
  });

  // Data Management (order 90)
  registerSettingsSection({
    id: 'data-management',
    label: 'Data & Storage',
    category: 'core',
    navAriaLabel: 'Data retention and storage management',
    icon: IconArchive,
    component: DataManagement,
    order: 90
  });
}
```

### Phase 3: Session Module Integration (Optional Future Enhancement)

**Note:** Session modules can optionally register settings sections for future session types. This is not required for Claude since it's already registered in core-sections.js.

**Example for future session types:**

```javascript
// In new-session-type/new-session-type.js
import { registerSettingsSection } from '../../settings/registry/settings-registry.js';

export const newSessionModule = {
  type: 'new-session-type',
  component: NewPane,
  header: NewHeader,

  // Optional: Auto-register settings section
  settingsSection: {
    id: 'new-session-settings',
    label: 'New Session',
    category: 'sessions',
    component: NewSessionSettings,
    icon: NewIcon,
    order: 80
  }
};
```

The session module registration system can be enhanced to automatically register settings sections, but this is not required for the initial implementation.

### Phase 4: Update Settings Page

**Update:** `src/lib/client/settings/pageState.js`

```javascript
import { getSettingsSections } from './registry/settings-registry.js';
import { registerCoreSettings } from './registry/core-sections.js';

// Initialize core settings on module load
registerCoreSettings();

// Section label lookup for error messages
const SECTION_LABEL_LOOKUP = new Map();

export function getSettingsSections() {
  const sections = getSettingsSections();

  // Update lookup map
  SECTION_LABEL_LOOKUP.clear();
  sections.forEach(section => {
    SECTION_LABEL_LOOKUP.set(section.id, section.label);
  });

  return sections;
}

export function createSettingsPageState(options = {}) {
  const sections = getSettingsSections();
  const defaultSectionId = sections[0]?.id ?? null;
  const initialSectionId = sections.some((section) => section.id === options.initialSection)
    ? options.initialSection
    : defaultSectionId;

  return {
    sections,
    activeSection: initialSectionId,
    savedMessage: null,
    error: null
  };
}

// ... rest of the file remains the same
```

### Phase 5: Directory Reorganization

**New structure:**

```
src/lib/client/settings/
├── registry/
│   ├── settings-registry.js    # Registration mechanism
│   └── core-sections.js        # Core settings registration
├── sections/
│   ├── core/                   # Application-wide settings
│   │   ├── Themes.svelte
│   │   ├── HomeDirectoryManager.svelte
│   │   ├── WorkspaceEnv.svelte
│   │   └── DataManagement.svelte
│   ├── auth/                   # Authentication settings
│   │   ├── ApiKeys.svelte      # Renamed from KeysSettings.svelte
│   │   └── OAuth.svelte        # From OAuthSettings.svelte
│   ├── connectivity/           # Network and tunnel settings
│   │   └── Tunnels.svelte      # Moved from sections/Tunnels.svelte
│   └── sessions/               # Session-type specific settings
│       ├── Claude.svelte       # Moved from sections/Claude.svelte
│       ├── TerminalDefaults.svelte # (future)
│       └── FileEditorDefaults.svelte # (future)
├── pageState.js                # Updated to use registry
├── SettingsViewModel.svelte.js # Unchanged
└── settings.css                # Unchanged
```

**Files to remove:**
- `src/lib/client/settings/keysSection.js` (integrated into core-sections.js)
- `src/lib/client/settings/AuthenticationSettingsSection.svelte` (if duplicate)
- `src/lib/client/settings/OAuthSettings.svelte` (move to sections/auth/OAuth.svelte)

**Files to move:**
- `src/lib/client/settings/sections/Tunnels.svelte` → `src/lib/client/settings/sections/connectivity/Tunnels.svelte`
- `src/lib/client/settings/sections/Claude.svelte` → `src/lib/client/settings/sections/sessions/Claude.svelte`

## Implementation Plan

### Stage 1: Foundation (Non-Breaking)
- [ ] Create `src/lib/client/settings/registry/settings-registry.js`
- [ ] Create `src/lib/client/settings/registry/core-sections.js` with all current sections
- [ ] Add registry initialization to settings page
- [ ] Test that settings page still works with registry

### Stage 2: Reorganize Directory Structure
- [ ] Create subdirectories: `sections/core/`, `sections/auth/`, `sections/connectivity/`, `sections/sessions/`
- [ ] Move existing sections to appropriate subdirectories:
  - ThemeSettings → `sections/core/Themes.svelte`
  - HomeDirectoryManager → `sections/core/HomeDirectoryManager.svelte`
  - WorkspaceEnvSettings → `sections/core/WorkspaceEnv.svelte`
  - DataManagement → `sections/core/DataManagement.svelte`
  - KeysSettings → `sections/auth/ApiKeys.svelte`
  - OAuthSettings → `sections/auth/OAuth.svelte`
  - Tunnels → `sections/connectivity/Tunnels.svelte`
  - Claude → `sections/sessions/Claude.svelte`
- [ ] Update imports in `core-sections.js` to reflect new paths
- [ ] Update imports throughout codebase
- [ ] Remove legacy files (keysSection.js, etc.)

### Stage 3: Remove Hardcoded Array
- [ ] Update `pageState.js` to use `getSettingsSections()` from registry
- [ ] Remove `SETTINGS_SECTIONS` constant
- [ ] Remove manual imports of section components/icons from pageState.js
- [ ] Verify all settings sections still appear

### Stage 4: Testing & Documentation
- [ ] Write unit tests for settings registry
- [ ] Update settings architecture documentation
- [ ] Update adapter guide with settings section registration
- [ ] Test that new session adapters can register settings sections
- [ ] E2E test: Navigate through all settings sections

## Benefits

### 1. Self-Registering Adapters
New session adapters automatically contribute settings without modifying core files:

```javascript
// In new-adapter/new-adapter.js
export const newAdapterModule = {
  type: 'new-type',
  component: NewPane,
  settingsSection: {
    id: 'new-adapter-settings',
    label: 'New Adapter',
    component: NewAdapterSettings,
    icon: NewIcon
  }
};
```

### 2. Clear Organization
Settings grouped by logical categories instead of flat list:
- **Core:** Themes, home directory, workspace, data
- **Auth:** API keys, OAuth
- **Connectivity:** Tunnels (LocalTunnel + VS Code tunnel combined)
- **Sessions:** Claude settings (auth + defaults combined)

### 3. Better Directory Structure
Settings organized by category in subdirectories:
- Easier to locate related settings
- Clear separation of concerns by category
- Scalable structure for future settings

### 4. Architectural Consistency
Settings follow same plugin pattern as session modules:
- Both use registration functions
- Both support dynamic discovery
- Both are extensible

### 5. Zero Core Changes for New Adapters
Adding a new session type with settings:
- **Before:** Edit `pageState.js`, add imports, insert into array
- **After:** Add `settingsSection` to module definition (1 property)

## Migration Strategy

### Backward Compatibility
All changes maintain backward compatibility until Stage 6:
1. Registry works alongside hardcoded array
2. Existing components continue working
3. No breaking changes to settings API
4. Gradual migration component-by-component

### Rollback Plan
Each stage is independently testable and reversible:
- Stage 1: Can be disabled by not initializing registry
- Stage 2: Directory moves are reversible via git
- Stage 3: Keep hardcoded array in git history for emergency rollback
- Stage 4: Documentation changes are non-breaking

### Testing Approach
- Unit test registry functions (register, unregister, getAll)
- Integration test: Add mock section, verify it appears
- E2E test: Navigate to each settings section
- Visual regression: Compare settings page before/after

## Success Criteria

1. ✅ All existing settings sections appear and function identically
2. ✅ Settings registry is fully functional and tested
3. ✅ Session modules can optionally register settings sections
4. ✅ Settings directory reorganized by category (core, auth, connectivity, sessions)
5. ✅ `pageState.js` uses registry instead of hardcoded array
6. ✅ Documentation updated with new architecture
7. ✅ Zero regressions in settings functionality
8. ✅ New adapter can add settings in < 5 lines of code

## Future Enhancements

### Category-Based Navigation
Once categorized, could add category grouping in UI:
```
Core
  ├─ Themes
  ├─ Home Directory
  └─ Environment

Authentication
  ├─ API Keys
  └─ OAuth

Connectivity
  └─ Tunnels

Sessions
  ├─ Claude
  ├─ Terminal (future)
  └─ File Editor (future)
```

### Dynamic Section Loading
Lazy-load setting components to reduce bundle size:
```javascript
settingsSection: {
  id: 'claude-defaults',
  component: () => import('./ClaudeDefaults.svelte')
}
```

### Settings Search
With registry, can implement settings search across all sections:
```javascript
searchSettings(query) {
  return getSettingsSections().filter(section =>
    section.label.toLowerCase().includes(query) ||
    section.navAriaLabel.toLowerCase().includes(query)
  );
}
```

## References

- **Session Module Pattern:** `src/lib/client/shared/session-modules/index.js`
- **Current Settings:** `src/lib/client/settings/pageState.js` (lines 21-74)
- **Adapter Guide:** `docs/architecture/adapter-guide.md`
- **MVVM Patterns:** `src/docs/architecture/mvvm-patterns.md`

## Related Issues

- Simplifies adding new session types (per adapter-guide.md)
- Aligns with MVVM architecture patterns
- Reduces tight coupling in settings system
- Improves testability and maintainability

---

**Next Steps:** Review and approve spec, then proceed with Stage 1 implementation.
