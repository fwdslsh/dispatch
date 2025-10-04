# Research: Theme Support System

**Feature**: Theme Support System
**Date**: 2025-10-02
**Status**: Complete

## Research Questions

### 1. CSS Custom Properties Strategy

**Decision**: Use CSS custom properties (CSS variables) for all theme colors

**Rationale**:

- Already in use by xterm.js (`@xterm/xterm` 5.5.0) for terminal theming
- Native browser support (no build step required)
- Real-time switching via `document.documentElement.style.setProperty()`
- Automatic cascade to all components without prop drilling
- Performance: Browser-native, no JavaScript calculations

**Alternatives Considered**:

- Tailwind theme configuration: Requires build step, not suitable for runtime theme changes
- Inline styles per component: Poor performance, difficult to maintain
- CSS-in-JS libraries: Unnecessary dependency for simple color theming

**Implementation Notes**:

- Define standard property names: `--theme-background`, `--theme-foreground`, `--theme-ansi-*`
- Map xterm theme JSON to CSS variables in ThemeParser
- Apply to `:root` selector in `app.html`

### 2. Theme File Format & Validation

**Decision**: Support xterm.js ITheme JSON format with validation

**Rationale**:

- xterm.js already provides well-documented theme interface
- Large ecosystem of existing themes (dracula, nord, github, solarized, etc.)
- Minimal required fields: background, foreground, 16 ANSI colors
- Simple JSON structure - easy to create and validate
- No conversion needed for terminal themes

**Validation Rules**:

- Required fields: `background`, `foreground`, 16 ANSI colors (`black` through `brightWhite`)
- Optional fields: `name`, `description`, `cursor`, `cursorAccent`, `selectionBackground`
- Color format: hex (#rrggbb), rgb(r,g,b), rgba(r,g,b,a), hsl(h,s,l), hsla(h,s,l,a)
- File size limit: 5MB (FR-019)
- JSON structure validation via JSON.parse with try/catch

**Alternatives Considered**:

- VS Code theme format: More complex, includes editor token colors (out of scope)
- iTerm2 color scheme: XML format, unnecessarily complex
- Custom JSON schema: Reinventing the wheel when xterm format exists

### 3. Theme Storage Architecture

**Decision**: Hybrid storage - preset themes in `static/`, user themes in `~/.dispatch/themes/`

**Rationale**:

- Preset themes bundled with application (no network dependency)
- User themes persist in data directory (survive container restarts)
- One-time copy during onboarding (FR-005) from `static/themes/` to user directory
- Simple file-based CRUD (no database rows for theme content)
- Filename as unique identifier (e.g., `phosphor-green.json`, `dracula.json`)

**Storage Locations**:

- **Bundled presets**: `/static/themes/` (read-only, version-controlled)
- **User themes**: `~/.dispatch/themes/` (writable, persisted in volume)
- **Global default preference**: SQLite `user_preferences` table (category: "themes", key: "globalDefault")
- **Workspace overrides**: SQLite `workspaces` table (new column: `theme_override`)

**Alternatives Considered**:

- All themes in database as BLOBs: Harder to manually edit, no direct file access
- Remote theme repository: Adds network dependency, complexity
- Git-based themes: Over-engineering for single-user use case

### 4. Database Schema Changes

**Decision**: Minimal schema additions - reuse existing tables

**Rationale**:

- `user_preferences` table already exists for user settings (see PreferencesPanel.svelte)
- `workspaces` table already exists for workspace metadata
- No need for new tables (simplicity principle)

**Schema Additions**:

```sql
-- Add to workspaces table (via ensureWorkspaceSchema)
ALTER TABLE workspaces ADD COLUMN theme_override TEXT DEFAULT NULL;

-- User preferences (use existing table)
-- category: "themes"
-- Store global default theme preference
INSERT INTO user_preferences (category, preferences, updatedAt)
VALUES ('themes', '{"globalDefault": "phosphor-green.json"}', CURRENT_TIMESTAMP)
ON CONFLICT(category) DO UPDATE SET
  preferences = excluded.preferences,
  updatedAt = CURRENT_TIMESTAMP;
```

**Theme Resolution Hierarchy** (FR-008):

1. Workspace-specific override (`workspaces.theme_override`)
2. Global default (`user_preferences` category="themes", key="globalDefault")
3. System fallback (hardcoded Phosphor Green in code)

**Alternatives Considered**:

- Separate `themes` table: Unnecessary for file-based storage
- Theme history table: Out of scope (no version control needed)
- Theme sharing table: Violates single-user principle

### 5. Parser Architecture

**Decision**: Abstract ThemeParser class with format-specific subclasses

**Rationale**:

- Satisfies FR-002: simple plugin architecture
- Allows future theme formats (VS Code, iTerm2) without modifying core
- Class-based inheritance (clarification answer: "abstract class ThemeParser { parse() }")
- Single responsibility: each parser handles one format

**Class Structure**:

```javascript
// Abstract base class
class ThemeParser {
	parse(fileContent) {
		throw new Error('parse() must be implemented by subclass');
	}

	validate(themeData) {
		// Common validation logic
	}

	toCssVariables(themeData) {
		// Convert to standard CSS custom property format
	}
}

// Concrete implementation
class XtermThemeParser extends ThemeParser {
	parse(fileContent) {
		const theme = JSON.parse(fileContent);
		this.validate(theme);
		return this.toCssVariables(theme);
	}
}
```

**Extensibility Pattern**:

- Register parsers in ThemeManager constructor
- Auto-detect format by file extension or content structure
- Graceful fallback to XtermThemeParser as default

**Alternatives Considered**:

- Function-based parsers: Less extensible, no shared validation
- Strategy pattern with composition: More complex than needed
- Plugin system with dynamic loading: Over-engineering

### 6. Frontend State Management

**Decision**: Svelte 5 runes-based ThemeState.svelte.js ViewModel

**Rationale**:

- Matches existing architecture (see WorkspaceState.svelte.js, SessionState.svelte.js)
- Reactive state with `$state` rune
- Derived computations with `$derived`
- Clean separation: ViewModel (state) + View (ThemeSettings.svelte)

**State Structure**:

```javascript
class ThemeState {
	themes = $state([]); // All available themes
	globalDefault = $state(null); // Current global default theme
	workspaceOverrides = $state({}); // Map: workspaceId -> themeName
	loading = $state(false);
	error = $state(null);

	// Derived: filtered/sorted theme lists
	presetThemes = $derived.by(() => this.themes.filter((t) => t.source === 'preset'));
	customThemes = $derived.by(() => this.themes.filter((t) => t.source === 'custom'));

	// Derived: active theme for current workspace
	activeTheme = $derived.by(() => {
		const workspaceId = this.currentWorkspaceId;
		return this.workspaceOverrides[workspaceId] || this.globalDefault;
	});
}
```

**Alternatives Considered**:

- Svelte stores (writable/readable): Old API, runes are more ergonomic
- Redux/Zustand: Unnecessary dependency for simple theme state
- Context API only: Loses reactivity benefits of runes

### 7. Theme Application Strategy

**Decision**: Automatic page refresh on theme activation (FR-011)

**Rationale**:

- Ensures all components render with new theme (no stale state)
- Existing session persistence handles terminal/editor recovery
- Simpler than coordinating real-time updates across all components
- Acceptable UX: brief refresh < 500ms (FR-027)

**Implementation**:

```javascript
async function activateTheme(themeName) {
	// Save preference to database
	await fetch('/api/preferences', {
		method: 'PUT',
		body: JSON.stringify({
			category: 'themes',
			preferences: { globalDefault: themeName }
		})
	});

	// Trigger page reload
	window.location.reload();
}
```

**CSS Variable Application** (on page load):

```javascript
// In +layout.svelte or app.html <script>
async function applyTheme() {
	const response = await fetch('/api/themes/active');
	const { cssVariables } = await response.json();

	for (const [property, value] of Object.entries(cssVariables)) {
		document.documentElement.style.setProperty(property, value);
	}
}
```

**Alternatives Considered**:

- Real-time theme switching without refresh: Complex state coordination
- Server-side CSS generation: Unnecessary build step
- LocalStorage for theme caching: Database is source of truth

### 8. Preset Theme Strategy

**Decision**: Three hardcoded presets with one ultimate fallback

**Rationale**:

- FR-004: Phosphor Green (default), Light, Dark
- FR-029/FR-030: Hardcoded Phosphor Green as ultimate fallback
- Simple, predictable color schemes for basic needs
- Covers primary use cases: dark mode, light mode, branded default

**Preset Theme Files** (`static/themes/`):

1. **phosphor-green.json** - Default theme (also hardcoded in code)
   - Dark background with phosphorescent green accent
   - Existing Dispatch branding colors

2. **light.json** - Professional light theme
   - White background, dark text
   - Soft ANSI colors for readability

3. **dark.json** - Professional dark theme
   - Dark gray background, light text
   - Balanced contrast ANSI colors

**Hardcoded Fallback Implementation**:

```javascript
// In ThemeManager.js
const FALLBACK_THEME = {
	name: 'Phosphor Green',
	background: '#0a0e0f',
	foreground: '#39ff14'
	// ... (complete xterm theme definition)
};

async function ensureThemesExist() {
	const themesDir = path.join(dataDir, 'themes');
	const themeFiles = await fs.readdir(themesDir).catch(() => []);

	if (themeFiles.length === 0) {
		// Recreate phosphor-green.json from FALLBACK_THEME
		await fs.writeFile(
			path.join(themesDir, 'phosphor-green.json'),
			JSON.stringify(FALLBACK_THEME, null, 2)
		);
	}
}
```

**Alternatives Considered**:

- More preset themes (5-10): Clutters UI, harder to maintain
- Downloadable theme marketplace: Out of scope for single-user app
- User-contributed themes: No sharing mechanism needed

### 9. Error Handling & Validation

**Decision**: Multi-level validation with graceful degradation

**Rationale**:

- FR-018: Inline warnings for missing ANSI colors (non-blocking)
- FR-027: Clear error messages within 500ms
- Progressive validation: parse → structure → colors → application

**Validation Levels**:

1. **Parse Level** (XtermThemeParser validation):
   - Valid JSON structure
   - File size < 5MB
   - Return: `{ valid: boolean, errors: [], warnings: [] }`

2. **Structure Level**:
   - Required fields present (`background`, `foreground`, ANSI colors)
   - Warnings for missing optional fields
   - Return: List of missing fields

3. **Color Level**:
   - Valid color format (hex, rgb, rgba, hsl, hsla)
   - Regex validation: `/^#[0-9a-f]{6}$/i` for hex, etc.
   - Warnings for unusual values (e.g., both fg/bg are black)

4. **Application Level**:
   - File system permissions
   - Duplicate theme names
   - Theme currently in use (deletion prevention per FR-013)

**Error UX**:

- Upload dialog: Inline error messages with specific issues
- Brief loading indicator (< 500ms per FR-027)
- Success feedback: Toast notification + theme preview update

**Alternatives Considered**:

- Strict validation (reject on any issue): Poor UX, blocks users unnecessarily
- No validation: Risk of broken themes, confusing errors
- Server-side only validation: Slower feedback, no client-side warnings

### 10. Performance Optimization

**Decision**: Minimal caching, fast file I/O, lazy loading

**Rationale**:

- Single-user app: limited theme count (~3-20 themes)
- File I/O is fast for small JSON files (< 10KB typical)
- Database lookups cached by existing DatabaseManager
- No need for complex optimization

**Performance Targets** (from Technical Context):

- Theme activation: < 500ms (FR-027)
- Upload validation: < 200ms
- File I/O: < 50ms
- Theme list fetch: < 100ms

**Optimization Strategies**:

1. Read all themes once on app start, cache in memory
2. Invalidate cache on theme CRUD operations
3. Async file operations (non-blocking)
4. Batch CSS variable application (single reflow)

**No Optimization Needed**:

- Image optimization: Themes are JSON text only
- CDN: Local files, no network
- Compression: File sizes tiny (< 10KB)
- Database indexing: Workspaces already indexed

**Alternatives Considered**:

- Redis caching: Unnecessary infrastructure for 10-20 themes
- Service worker for theme files: Over-engineering
- Preload all theme CSS: Wastes bandwidth, themes switched infrequently

## Technology Stack Summary

**Backend**:

- Node.js >=22 (ES modules)
- File system (fs/promises) for theme storage
- better-sqlite3 for preferences/workspace overrides
- Express 5.1.0 (via SvelteKit adapter-node)

**Frontend**:

- Svelte 5 (runes-based reactivity)
- SvelteKit 2.x (routing, API routes)
- CSS custom properties (theming)
- Drag-and-drop file upload (HTML5 File API)

**Testing**:

- Vitest (unit tests for parsers, validators, state)
- Playwright (E2E tests for theme upload, activation, workspace overrides)
- @testing-library/svelte (component tests)

**No New Dependencies Required**:

- All functionality achievable with existing packages
- File I/O: Native Node.js `fs/promises`
- JSON parsing: Native `JSON.parse()`
- Color validation: Simple regex (no external library)

## Risk Assessment

**Low Risk**:

- File-based storage: Simple, well-understood
- CSS variables: Native browser feature
- xterm theme format: Existing standard

**Medium Risk**:

- Database schema update for workspace overrides: Test carefully
- Theme resolution hierarchy: Clear documentation needed
- File upload validation: Comprehensive error handling required

**Mitigations**:

- Hardcoded fallback theme ensures app never breaks (FR-029, FR-030)
- Existing session persistence handles page refresh (FR-011)
- Simple validation prevents malformed themes
- File size limit prevents DoS (FR-019: 5MB max)

## Open Questions

None - all clarifications resolved in spec.md Session 2025-10-02.

## Next Steps

Proceed to Phase 1:

1. Generate data-model.md (entities and relationships)
2. Create API contracts in contracts/ directory
3. Generate contract tests
4. Update CLAUDE.md with theme system documentation
