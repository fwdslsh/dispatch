# Data Model: Theme Support System

**Feature**: Theme Support System
**Date**: 2025-10-02

## Overview

The theme system uses a hybrid storage approach:
- **Theme content**: JSON files in file system (`static/themes/` for presets, `~/.dispatch/themes/` for custom)
- **Theme preferences**: SQLite database (existing tables)
- **Theme metadata**: In-memory cache loaded from file system

## Core Entities

### 1. Theme (File-Based)

**Storage**: JSON files in `~/.dispatch/themes/` or `static/themes/`

**Structure** (xterm.js ITheme format):

```typescript
interface Theme {
  // Metadata (optional)
  name?: string;              // Display name (defaults to filename)
  description?: string;       // User-facing description

  // Required colors
  background: string;         // Background color (hex, rgb, hsl)
  foreground: string;         // Default text color

  // ANSI colors (required)
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;

  // Terminal-specific (optional)
  cursor?: string;            // Cursor color
  cursorAccent?: string;      // Cursor text color
  selectionBackground?: string; // Selection highlight
}
```

**File Naming**: Filename acts as unique identifier
- Example: `dracula.json`, `phosphor-green.json`, `nord.json`
- Filename rules: lowercase, alphanumeric + hyphens, `.json` extension
- Uniqueness enforced by file system (no duplicates)

**Source Types**:
1. **preset**: Bundled in `static/themes/`, read-only
2. **custom**: User-uploaded to `~/.dispatch/themes/`, writable

**Validation Rules**:
- All required fields must be present
- Color values: Valid hex (#rrggbb), rgb(r,g,b), rgba, hsl, or hsla
- File size: Max 5MB (FR-019)
- JSON structure: Must parse without errors

**Example** (`phosphor-green.json`):

```json
{
  "name": "Phosphor Green",
  "description": "Dispatch default theme with phosphorescent green accent",
  "background": "#0a0e0f",
  "foreground": "#39ff14",
  "cursor": "#39ff14",
  "selectionBackground": "#39ff1440",
  "black": "#1a1a1a",
  "red": "#ff6b6b",
  "green": "#39ff14",
  "yellow": "#f1fa8c",
  "blue": "#6272a4",
  "magenta": "#bd93f9",
  "cyan": "#8be9fd",
  "white": "#f8f8f2",
  "brightBlack": "#6272a4",
  "brightRed": "#ff6655",
  "brightGreen": "#50fa7b",
  "brightYellow": "#ffff66",
  "brightBlue": "#8899ff",
  "brightMagenta": "#ff79c6",
  "brightCyan": "#66ddff",
  "brightWhite": "#ffffff"
}
```

### 2. ThemeMetadata (In-Memory)

**Purpose**: Cached representation of theme files loaded into memory

```typescript
interface ThemeMetadata {
  id: string;                 // Filename without .json (e.g., "dracula")
  name: string;               // Display name from file or filename
  description: string;        // Description from file or empty
  source: 'preset' | 'custom'; // Where theme file is stored
  filePath: string;           // Absolute path to JSON file
  cssVariables: CSSVariables; // Parsed CSS custom properties
  isActive: boolean;          // Currently active theme
  lastModified: Date;         // File modification timestamp
}
```

**Lifecycle**:
1. Loaded on app start from both `static/themes/` and `~/.dispatch/themes/`
2. Cached in `ThemeManager` instance
3. Invalidated on theme CRUD operations (upload, delete)
4. Refreshed on cache miss

### 3. CSSVariables (Derived)

**Purpose**: Normalized CSS custom property representation

```typescript
interface CSSVariables {
  // Terminal colors
  '--theme-background': string;
  '--theme-foreground': string;
  '--theme-cursor': string;
  '--theme-cursor-accent': string;
  '--theme-selection-bg': string;

  // ANSI colors (16 total)
  '--theme-ansi-black': string;
  '--theme-ansi-red': string;
  '--theme-ansi-green': string;
  '--theme-ansi-yellow': string;
  '--theme-ansi-blue': string;
  '--theme-ansi-magenta': string;
  '--theme-ansi-cyan': string;
  '--theme-ansi-white': string;
  '--theme-ansi-bright-black': string;
  '--theme-ansi-bright-red': string;
  '--theme-ansi-bright-green': string;
  '--theme-ansi-bright-yellow': string;
  '--theme-ansi-bright-blue': string;
  '--theme-ansi-bright-magenta': string;
  '--theme-ansi-bright-cyan': string;
  '--theme-ansi-bright-white': string;
}
```

**Transformation** (ThemeParser):
- Input: xterm Theme JSON
- Output: CSS variable key-value pairs
- Example: `{ "background": "#0a0e0f" }` → `{ "--theme-background": "#0a0e0f" }`

### 4. UserPreferences (Database)

**Table**: `user_preferences` (existing)

**Schema**:

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  category TEXT PRIMARY KEY,   -- "themes"
  preferences TEXT NOT NULL,   -- JSON object
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Theme Preferences Row**:

```json
{
  "category": "themes",
  "preferences": {
    "globalDefault": "phosphor-green.json"
  }
}
```

**Operations**:
- **Read**: `SELECT preferences FROM user_preferences WHERE category = 'themes'`
- **Write**: `INSERT OR REPLACE INTO user_preferences (category, preferences) VALUES ('themes', ?)`
- **Default**: If row missing, use hardcoded fallback ("phosphor-green.json")

### 5. Workspace (Database - Existing Table)

**Table**: `workspaces` (existing, add column)

**Schema Addition** (via `DatabaseManager.ensureWorkspaceSchema()`):

```sql
-- Automatically added on database initialization if missing
ALTER TABLE workspaces ADD COLUMN theme_override TEXT DEFAULT NULL;
```

**Fields**:
- `id` (TEXT PRIMARY KEY): Workspace path
- `name` (TEXT): Display name
- `status` (TEXT): 'new', 'active', 'archived'
- `theme_override` (TEXT): Optional theme filename (e.g., "dracula.json")
- `createdAt`, `updatedAt`, `lastActive`: Timestamps

**Theme Resolution for Workspace**:

```javascript
function resolveThemeForWorkspace(workspaceId) {
  const workspace = db.getWorkspace(workspaceId);

  // 1. Workspace-specific override
  if (workspace.theme_override) {
    return workspace.theme_override;
  }

  // 2. Global default preference
  const prefs = db.getUserPreferences('themes');
  if (prefs?.globalDefault) {
    return prefs.globalDefault;
  }

  // 3. System fallback
  return 'phosphor-green.json';
}
```

## Relationships

```
UserPreferences (themes)
  └─ globalDefault: string  ──┬─> Theme File (one-to-one)
                              │
Workspace                     │
  └─ theme_override: string ──┴─> Theme File (optional, one-to-one)

Theme File (JSON)
  ├─ Parsed by → ThemeParser (includes validation)
  └─ Transformed to → CSSVariables
```

**Cardinality**:
- **User → GlobalDefault**: 1 to 1 (single default theme)
- **Workspace → ThemeOverride**: 1 to 0..1 (optional override)
- **ThemeFile → Workspaces**: 1 to many (one theme used by multiple workspaces)

## State Transitions

### Theme Lifecycle

```
[Not Exists]
    │
    ├─ (Upload) ──> [Uploaded] ──> [Validated] ──┬─> [Active]
    │                                             │
    └─ (Copy Preset) ──> [Installed] ─────────────┘
                                                  │
                                                  ├─> (Activate) ──> [Active as Global Default]
                                                  │
                                                  ├─> (Set Override) ──> [Active for Workspace]
                                                  │
                                                  └─> (Delete) ──> [Deleted]
```

**Constraints**:
- Cannot delete theme if `isActiveGlobal` or used by any workspace (FR-013)
- Cannot delete preset themes (read-only)
- Upload validates before saving to disk

### Workspace Theme Lifecycle

```
[No Override]
  │
  ├─> (Select Theme) ──> [Override Set] ──> (Uses specific theme)
  │                           │
  │                           └─> (Clear Override) ──> [No Override]
  │
  └─> (Uses Global Default)
```

## Data Flow

### 1. Theme Upload Flow

```
User selects file
  │
  ├─> Upload to /api/themes (POST)
  │     │
  │     ├─> Validate file size (< 5MB)
  │     ├─> Parse JSON
  │     ├─> Validate structure (required fields)
  │     ├─> Validate colors (format check)
  │     │
  │     ├─> If valid:
  │     │     ├─> Save to ~/.dispatch/themes/{filename}
  │     │     ├─> Invalidate theme cache
  │     │     └─> Return success + metadata
  │     │
  │     └─> If invalid:
  │           └─> Return errors (400) + validation messages
  │
  └─> UI displays result (success toast or error list)
```

### 2. Theme Activation Flow

```
User clicks "Set as Default"
  │
  ├─> PUT /api/preferences
  │     │
  │     ├─> Update user_preferences.themes.globalDefault
  │     ├─> Return success (200)
  │
  ├─> UI receives success
  │     │
  │     └─> window.location.reload() (FR-011)
  │
  └─> Page reloads
        │
        ├─> Load active theme (GET /api/themes/active)
        ├─> Apply CSS variables to :root
        └─> Render UI with new theme
```

### 3. Workspace Override Flow

```
User selects workspace theme
  │
  ├─> PUT /api/workspaces/{id}
  │     │
  │     ├─> Update workspaces.theme_override
  │     └─> Return success
  │
  ├─> UI receives success
  │     │
  │     └─> window.location.reload()
  │
  └─> Page reloads with workspace theme
```

### 4. Theme Resolution Flow (Server)

```
Request: GET /api/themes/active?workspaceId=xxx
  │
  ├─> Load workspace from database
  │     │
  │     ├─> If workspace.theme_override exists:
  │     │     └─> Load theme file (override)
  │     │
  │     ├─> Else: Load user_preferences.themes.globalDefault
  │     │     └─> Load theme file (global)
  │     │
  │     └─> Else: Use hardcoded FALLBACK_THEME
  │
  ├─> Parse theme JSON
  ├─> Transform to CSS variables
  └─> Return { themeName, cssVariables }
```

## Validation Rules

### Theme File Validation

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];    // Blocking errors
  warnings: string[];  // Non-blocking issues
}

function validateTheme(themeContent: string): ValidationResult {
  const errors = [];
  const warnings = [];

  // 1. Parse JSON
  let theme;
  try {
    theme = JSON.parse(themeContent);
  } catch (e) {
    errors.push('Invalid JSON syntax');
    return { valid: false, errors, warnings };
  }

  // 2. Required fields
  const required = ['background', 'foreground', 'black', 'red', 'green',
                   'yellow', 'blue', 'magenta', 'cyan', 'white',
                   'brightBlack', 'brightRed', 'brightGreen', 'brightYellow',
                   'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite'];

  for (const field of required) {
    if (!theme[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // 3. Color format validation
  const colorRegex = /^(#[0-9a-f]{6}|rgb\(|rgba\(|hsl\(|hsla\()/i;

  for (const [key, value] of Object.entries(theme)) {
    if (typeof value === 'string' && !colorRegex.test(value)) {
      errors.push(`Invalid color format for ${key}: ${value}`);
    }
  }

  // 4. Warnings for missing optional fields
  if (!theme.name) warnings.push('Missing optional field: name');
  if (!theme.cursor) warnings.push('Missing optional field: cursor (will use foreground)');

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```

### Deletion Prevention

```javascript
async function canDeleteTheme(themeName) {
  // Check if theme is global default
  const prefs = await db.getUserPreferences('themes');
  if (prefs?.globalDefault === themeName) {
    return {
      canDelete: false,
      reason: 'Theme is currently set as global default'
    };
  }

  // Check if theme is used by any workspace
  const workspaces = await db.getWorkspacesWithTheme(themeName);
  if (workspaces.length > 0) {
    return {
      canDelete: false,
      reason: `Theme is used by ${workspaces.length} workspace(s)`,
      workspaces: workspaces.map(w => w.name)
    };
  }

  // Check if theme is a preset
  const theme = await themeManager.getTheme(themeName);
  if (theme.source === 'preset') {
    return {
      canDelete: false,
      reason: 'Cannot delete preset themes'
    };
  }

  return { canDelete: true };
}
```

## Caching Strategy

### In-Memory Theme Cache

```javascript
class ThemeManager {
  constructor() {
    this.cache = new Map();      // Map<themeId, ThemeMetadata>
    this.lastCacheUpdate = Date.now();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async loadThemes() {
    // Load from both directories
    const presetThemes = await this.loadFromDirectory('static/themes', 'preset');
    const customThemes = await this.loadFromDirectory('~/.dispatch/themes', 'custom');

    // Update cache
    this.cache.clear();
    [...presetThemes, ...customThemes].forEach(theme => {
      this.cache.set(theme.id, theme);
    });

    this.lastCacheUpdate = Date.now();
  }

  async getTheme(themeId) {
    // Check cache validity
    if (Date.now() - this.lastCacheUpdate > this.cacheTimeout) {
      await this.loadThemes();
    }

    return this.cache.get(themeId);
  }

  invalidateCache() {
    this.cache.clear();
    this.lastCacheUpdate = 0;
  }
}
```

## Database Schema Updates

### Adding theme_override Column

The `theme_override` column is added to the `workspaces` table automatically via the existing `DatabaseManager.ensureWorkspaceSchema()` method pattern:

```javascript
// Update in src/lib/server/shared/db/DatabaseManager.js
// Add to ensureWorkspaceSchema() method

async ensureWorkspaceSchema() {
  const columns = await this.all('PRAGMA table_info(workspaces)');

  // Existing name column check
  const hasNameColumn = columns.some((column) => column.name === 'name');
  if (!hasNameColumn) {
    await this.run('ALTER TABLE workspaces ADD COLUMN name TEXT');
  }

  // NEW: Add theme_override column check
  const hasThemeOverrideColumn = columns.some((column) => column.name === 'theme_override');
  if (!hasThemeOverrideColumn) {
    await this.run('ALTER TABLE workspaces ADD COLUMN theme_override TEXT DEFAULT NULL');
  }

  // ... existing workspace name derivation logic
}
```

This approach:
- Automatically runs on database initialization
- Checks if column exists before adding (idempotent)
- Follows existing pattern used for `name` column
- No separate migration file needed

## Summary

**Key Design Principles**:
1. **Simplicity**: File-based storage, minimal database changes
2. **Flexibility**: Parser abstraction allows future formats
3. **Reliability**: Hardcoded fallback ensures app never breaks
4. **Performance**: In-memory caching, fast file I/O
5. **Single-User**: No sharing, permissions, or multi-user complexity

**Data Stores**:
- **File System**: Theme content (JSON files)
- **Database**: Preferences (global default) and workspace overrides
- **Memory**: Cached theme metadata for fast access

**Next**: Generate API contracts in `contracts/` directory
