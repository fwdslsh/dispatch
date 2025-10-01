# Unified Theming System - Implementation Summary

**Document:** [unified-theming-system.md](./unified-theming-system.md)
**Version:** 1.2
**Status:** Ready for Implementation

---

## Key Changes from v1.1

### ✅ v1.2 Updates

1. **Global Default + Per-Workspace Override** - Set a system-wide default theme, override per workspace
2. **User Directory Storage** - Themes stored in `~/.dispatch/themes/` (not database)
3. **Onboarding Theme Installation** - Presets installed during onboarding (one-time, not on startup)
4. **Filename-Based IDs** - Theme IDs are filenames (e.g., `dracula.json`)
5. **Client-Side Primary** - Theme loading via client, SSR optional for FOUC prevention
6. **User Intent Respected** - Deleted themes stay deleted (no auto-restore)

---

## Architecture Overview

### Theme Storage Model

```
~/.dispatch/themes/               # User data directory
├── phosphor-green.json           # Auto-installed from static/
├── github-dark.json              # Auto-installed from static/
├── github-light.json             # Auto-installed from static/
├── one-dark-pro.json             # Auto-installed from static/
├── dracula.json                  # Auto-installed from static/
├── winter-is-coming.json         # Auto-installed from static/
└── my-custom-theme.json          # User uploaded

static/themes/                    # Bundled presets (read-only)
├── phosphor-green.json           # Source for auto-install
├── github-dark.json
├── github-light.json
├── one-dark-pro.json
├── dracula.json
└── winter-is-coming.json
```

### Database Schema

```sql
-- Global default theme (user_preferences)
{
  "category": "themes",
  "preferences": {
    "defaultThemeId": "phosphor-green.json"
  }
}

-- Per-workspace overrides (workspaces table)
ALTER TABLE workspaces ADD COLUMN themeId TEXT DEFAULT NULL;
-- NULL = use global default, otherwise override
```

### Theme Loading Hierarchy

1. **Check workspace override**: `workspace.themeId`
2. **Fall back to global default**: `user_preferences.defaultThemeId`
3. **Fall back to system default**: `phosphor-green.json`

**Resolution happens server-side**, sent to client via API.

---

## Onboarding Theme Selection

### One-Time Preset Installation

```javascript
// Called from OnboardingViewModel during setup
async function installPresetsForOnboarding() {
  const themesDir = '~/.dispatch/themes/';
  const staticDir = 'static/themes/';

  // Create directory
  await fs.mkdir(themesDir, { recursive: true });

  // Copy ALL presets (no existence check - this is first-time setup)
  for (const preset of PRESET_THEMES) {
    const userPath = `${themesDir}${preset.id}`;
    const staticPath = `${staticDir}${preset.id}`;

    await fs.copyFile(staticPath, userPath);
    console.log(`Installed: ${preset.name}`);
  }
}

// Check if themes installed (onboarding complete indicator)
async function areThemesInstalled() {
  const themesDir = '~/.dispatch/themes/';
  const files = await fs.readdir(themesDir);
  return files.length > 0;
}
```

**Onboarding Flow:**
1. User completes authentication step
2. OnboardingThemeStep presents preset theme cards with previews
3. User selects preferred default theme (pre-select Phosphor Green)
4. `installPresetsForOnboarding()` copies all presets from `static/themes/`
5. Selected theme saved as `defaultThemeId` in user preferences
6. Onboarding complete

**Benefits:**
- Presets available immediately after setup
- User choice respected (deleted themes stay deleted)
- No auto-restore on app restart (one-time operation)
- Clear separation: setup vs runtime

---

## Client-Side Theme Loading

### Primary Strategy (No SSR Dependency)

```javascript
// Client-side theme loader (always runs)
import { onMount } from 'svelte';

onMount(async () => {
  const workspaceId = getCurrentWorkspaceId();

  // Fetch resolved theme via API
  const res = await fetch(`/api/themes/resolve?workspaceId=${workspaceId}`);
  const { theme } = await res.json();

  // Apply CSS variables
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.tokensJson)) {
    root.style.setProperty(key, value);
  }
});
```

### Optional SSR Optimization (FOUC Prevention)

```svelte
<!-- +layout.svelte -->
<svelte:head>
  {#if data.themeTokens}
    <style id="theme-vars-ssr">
      :root {
        {#each Object.entries(data.themeTokens) as [key, value]}
          {key}: {value};
        {/each}
      }
    </style>
  {/if}
</svelte:head>

<script>
  // Client-side still runs, overwrites if different
  onMount(async () => {
    await loadThemeForWorkspace(workspaceId);
  });
</script>
```

**Result:** Theme loads client-side by default, SSR is optional performance enhancement.

---

## API Endpoints Summary

### Theme Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/themes` | GET | List all themes from `~/.dispatch/themes/` |
| `/api/themes/upload` | POST | Upload theme, save to `~/.dispatch/themes/` |
| `/api/themes/:id` | DELETE | Delete custom theme from directory |

### Global Default

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/themes/default` | POST | Set global default theme |

### Workspace Overrides

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/workspaces/:id/theme` | POST | Set workspace-specific theme |
| `/api/workspaces/:id/theme` | DELETE | Clear override, use default |

### Theme Resolution

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/themes/resolve` | GET | Resolve theme for workspace (hierarchy) |

---

## User Workflows

### Set Global Default Theme

1. User opens Theme Manager
2. Clicks "Set as Default" on a theme
3. API: `POST /api/themes/default` with `themeId`
4. All workspaces without overrides now use this theme
5. Page refreshes automatically

### Override Theme for Workspace

1. User opens workspace settings
2. Selects different theme for this workspace
3. API: `POST /api/workspaces/{id}/theme` with `themeId`
4. Workspace now uses override instead of global default
5. Visual indicator: different colors for this workspace

### Upload Custom Theme

1. User drags VS Code theme JSON into upload zone
2. Theme parsed and saved to `~/.dispatch/themes/my-theme.json`
3. Theme ID is filename: `my-theme.json`
4. Available immediately in theme selector
5. Can be set as default or per-workspace override

### Delete Custom Theme

1. User clicks delete on custom theme
2. API checks if theme is in use
3. If used by workspaces, shows error with workspace list
4. If not in use, deletes file from `~/.dispatch/themes/`
5. Theme removed from UI

---

## Theme JSON Format

### Theme ID = Filename

```javascript
// Database stores filename
workspace.themeId = "dracula.json";
preferences.defaultThemeId = "phosphor-green.json";

// File resolved from ~/.dispatch/themes/{themeId}
const themePath = `~/.dispatch/themes/${themeId}`;
const theme = JSON.parse(fs.readFileSync(themePath));
```

### Example Theme File Structure

```json
{
  "id": "dracula.json",
  "name": "Dracula Official",
  "description": "Classic pink, purple, blue palette",
  "isPreset": true,
  "tokensJson": {
    "--theme-bg-primary": "#282a36",
    "--theme-fg-primary": "#f8f8f2",
    "--theme-accent-primary": "#bd93f9",
    "--theme-ansi-black": "#21222c",
    "--theme-ansi-red": "#ff5555",
    "--theme-ansi-green": "#50fa7b",
    // ... all 24+ canonical palette variables
  }
}
```

---

## Implementation Phases (Updated)

### Phase 1: Foundation & File System (Week 1)

- ✅ Simplify CSS variables (64 → 30)
- ✅ Create `~/.dispatch/themes/` directory structure
- ✅ Implement `installPresetsForOnboarding()` and `areThemesInstalled()`
- ✅ Add `defaultThemeId` to user_preferences
- ✅ Add `themeId` column to workspaces table
- ✅ Theme parsing functions (VS Code, xterm)
- ✅ Create OnboardingThemeStep component

### Phase 2: Services & API (Week 2)

- ✅ ThemeService with file-based storage
- ✅ Theme hierarchy resolution logic
- ✅ API endpoints (upload, list, default, workspace, resolve, delete)
- ✅ Client-side theme loader
- ✅ Optional SSR integration

### Phase 3: UI Components (Week 3)

- ✅ ThemeViewModel with Svelte 5 runes
- ✅ ThemeManager modal with upload zone
- ✅ ThemePreviewCard with live demos
- ✅ Default theme selector
- ✅ Per-workspace theme selector

### Phase 4: Editor & Terminal Integration (Week 4)

- ✅ CodeMirror 6 theme (CSS variable-based)
- ✅ xterm.js theme generator
- ✅ Create preset theme JSON files
- ✅ Test with all 6 preset themes

### Phase 5: Polish & Testing (Week 5)

- ✅ Accessibility (keyboard, screen reader)
- ✅ Performance optimization
- ✅ E2E tests (upload, default, override, delete)
- ✅ Documentation

---

## Key Technical Details

### Why File-Based Storage?

**Pros:**
- User can manually add themes (drop JSON file)
- Easy to backup/restore (`~/.dispatch/themes/` directory)
- No database migrations for new themes
- Simple file operations (copy, delete)
- Works without database connection

**Cons:**
- Slightly slower than database (acceptable for theme loading)
- Need file system permissions

**Decision:** File storage wins for user control and simplicity.

### Why Client-Side Primary?

**Pros:**
- Works without SSR (progressive enhancement)
- Easier to debug (console shows theme application)
- No FOUC with optional SSR
- Consistent behavior across deployments

**Cons:**
- Slight flash if SSR not used (mitigated with SSR option)

**Decision:** Client-side primary with SSR optimization available.

### Why Filename-Based IDs?

**Pros:**
- One less mapping layer (ID → filename)
- Intuitive (ID = what you see in directory)
- Easy file operations (`fs.readFile(themeId)`)
- Simple delete (just remove file)

**Cons:**
- Filenames must be sanitized
- Can't use special characters

**Decision:** Simplicity wins, sanitize on upload.

---

## Success Metrics

**User Adoption:**
- % users who upload custom themes
- % users who set workspace-specific themes
- Most popular preset themes

**Quality:**
- % themes passing format validation
- User feedback on theme accuracy
- Visual workspace identification success

**Performance:**
- Theme upload/parse: <500ms ✅
- Theme resolution API: <50ms ✅
- Page refresh after activation: <2s ✅
- Startup preset install: <200ms ✅

---

## Security Considerations

**File Operations:**
- Path traversal prevention (sanitize filenames)
- File size limit: 1MB
- Only JSON files accepted
- Read-only access to `static/themes/`

**API Authentication:**
- All endpoints require TERMINAL_KEY
- No unauthenticated theme access
- Prevent deletion of in-use themes

**User Data Isolation:**
- Themes stored in user home directory
- No cross-user theme access
- Workspace themes tied to user account

---

## Out of Scope (Future)

- Live theme switching without reload
- Visual theme editor
- Theme marketplace/sharing
- Theme import/export between instances
- Auto light/dark variants
- Per-session themes (workspace-level only)

---

## Ready for Implementation ✅

**Architectural Decisions:**
- ✅ File-based storage in `~/.dispatch/themes/`
- ✅ Global default + per-workspace override
- ✅ Client-side primary, SSR optional
- ✅ Filename-based theme IDs
- ✅ Onboarding-time preset installation (one-time, respects user deletions)

**Next Steps:**
1. Create `static/themes/` directory with 6 preset JSONs
2. Implement `installPresetsForOnboarding()` and `areThemesInstalled()`
3. Build OnboardingThemeStep component with theme selector
4. Update OnboardingViewModel with theme selection state
5. Build ThemeService with file operations
6. Create API endpoints following spec
7. Build client-side theme loader

**Timeline:** 5 weeks from start
