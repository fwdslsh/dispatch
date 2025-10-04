# PRD: Unified Theming System for Dispatch

**Version:** 1.1
**Status:** Ready for Implementation
**Last Updated:** 2025-09-30
**Reviewers:** Frontend Design Expert, Refactoring Specialist

## Document Changelog

**v1.2 (2025-09-30):**

- ✅ Added global default theme with per-workspace override capability
- ✅ Changed theme storage to `~/.dispatch/themes/` (user data directory)
- ✅ Preset themes installed during onboarding (one-time copy, not on every startup)
- ✅ Default theme selection added to onboarding flow
- ✅ Theme IDs are filenames (e.g., `dracula.json`)
- ✅ SSR support optional (client-side fallback for theme loading)
- ✅ Deleted themes stay deleted (no auto-restore)

**v1.1 (2025-09-30):**

- ✅ Removed all WCAG contrast validation (user choice over standards)
- ✅ Updated preset themes: GitHub (Light/Dark), One Dark Pro, Dracula, Winter Is Coming
- ✅ Added per-workspace theme support for visual identification
- ✅ Changed to automatic page refresh (no manual reload required)
- ✅ Simplified CSS variables: Layer 2/3 normalized (64 → ~30 core variables, -45% complexity)
- ✅ Removed rate limiting (single-user app)
- ✅ Added CSS variable cleanup/migration plan in Phase 1

**v1.0 (Initial Draft):**

- Original PRD with full WCAG validation

---

## Executive Summary

This PRD defines a comprehensive theming system for Dispatch that allows users to upload VS Code or xterm theme JSON files, which are normalized into a canonical CSS custom property palette and applied consistently across the entire application (UI, CodeMirror 6, and xterm.js terminals).

**Key Principles:**

- **Consistency First**: Single source of truth for all colors
- **Existing Architecture Alignment**: Leverages current MVVM patterns and service layer
- **Professional UX**: Beautiful theme previews with terminal-style aesthetic
- **Performance Focused**: Minimal bundle impact, optimized rendering
- **Per-Workspace Themes**: Visual workspace identification via theme selection
- **Simplified Maintenance**: Normalized CSS variable layers for easier upkeep

---

## 1. Goals & Non-Goals

### Goals

1. **Universal Theme Upload**: Support VS Code theme JSON and xterm theme JSON formats
2. **Canonical Palette**: Normalize all themes to CSS custom properties (design tokens)
3. **Consistent Application**: Apply themes uniformly to:
   - Dispatch UI components
   - CodeMirror 6 editor instances
   - xterm.js terminal sessions
4. **Preset Library**: Include popular VS Code themes:
   - GitHub Theme (Light and Dark)
   - One Dark Pro
   - Dracula Official
   - Winter Is Coming
   - Phosphor Green (Dispatch default)
5. **Global Default + Per-Workspace Override**: Set a global default theme with optional per-workspace overrides
6. **User Directory Theme Storage**: Themes stored in `~/.dispatch/themes/` with preset auto-copy on startup
7. **Auto Page Refresh**: Automatically refresh page when theme is activated (no manual reload needed)
8. **SSR Optional**: Client-side theme loading with optional SSR optimization

### Non-Goals

- **Monaco Editor Support**: Only CodeMirror 6 is supported
- **Theme Editing UI**: No visual theme customization tool (upload/preset selection only)
- **Contrast Validation**: Users decide if they like a theme; no enforcement of WCAG standards

---

## 2. Background & Context

### Current State

**Strengths:**

- Comprehensive CSS custom property system (118 variables in `variables.css`)
- Professional design system with "Phosphor Green" identity (#2ee66b)
- Modern CSS patterns (`color-mix()`, `light-dark()`, `@property`)
- xterm.js integration already present in `TerminalPane.svelte`

**Gaps:**

- No terminal theming (xterm.js initialized without `theme` property)
- No CodeMirror 6 integration (planned for file editing feature)
- No user-customizable color schemes
- Hardcoded color palette limits user preference

### User Stories

**As a developer**, I want to:

- Upload my favorite VS Code theme so Dispatch matches my IDE
- Select preset themes (GitHub, Dracula, One Dark Pro) without manual configuration
- See live previews of themes before activating them
- Use different themes per workspace as visual indicators
- Have themes activate immediately with automatic page refresh

**As a workspace power user**, I want to:

- Set a global default theme that applies to all workspaces
- Override the default theme for specific workspaces
- Quickly identify which workspace I'm working in by theme colors
- Preview theme changes in real-time before committing

**As a new user going through onboarding**, I want to:

- Choose my preferred default theme during setup
- Have preset themes installed automatically during onboarding
- Start using the app with my chosen theme immediately

**As an experienced user**, I want to:

- Have themes persist in user data directory (`~/.dispatch/themes/`)
- Add custom themes by dropping JSON files in the themes folder
- Delete unwanted themes without them being restored

---

## 3. Architecture Overview

### 3.1 Three-Layer CSS Variable System

The theming architecture uses a **simplified, normalized** layered approach:

```css
:root {
	/* LAYER 1: CANONICAL PALETTE (theme upload targets) */
	--theme-bg-primary: #0c1210;
	--theme-bg-secondary: #121a17;
	--theme-fg-primary: #d9ffe6;
	--theme-fg-secondary: #92b3a4;
	--theme-accent-primary: #2ee66b;
	--theme-accent-secondary: #00c2ff;
	--theme-ansi-black: #0c1210;
	--theme-ansi-red: #ef476f;
	--theme-ansi-green: #2ee66b;
	/* ... 16 ANSI colors total */

	/* LAYER 2: SEMANTIC BASE COLORS (normalized names) */
	--bg: var(--theme-bg-primary);
	--surface: var(--theme-bg-secondary);
	--surface-raised: #18231f;
	--text: var(--theme-fg-primary);
	--text-muted: var(--theme-fg-secondary);
	--primary: var(--theme-accent-primary);
	--accent: var(--primary);
	--success: #26d07c;
	--warning: #ffb703;
	--error: #ef476f;
	--info: var(--theme-accent-secondary);
	--border: color-mix(in oklab, var(--text) 20%, transparent);

	/* LAYER 3: DERIVED VARIANTS (simplified, consistent naming) */
	--primary-bright: #4eff82;
	--primary-dim: #1ea851;
	--primary-10: color-mix(in oklab, var(--primary) 10%, transparent);
	--primary-20: color-mix(in oklab, var(--primary) 20%, transparent);
	--primary-40: color-mix(in oklab, var(--primary) 40%, transparent);
	--primary-60: color-mix(in oklab, var(--primary) 60%, transparent);
	--surface-tint-subtle: color-mix(in oklab, var(--surface) 95%, var(--primary) 5%);
	--surface-tint-medium: color-mix(in oklab, var(--surface) 90%, var(--primary) 10%);
	--focus-ring: 0 0 0 3px var(--primary-40);
}
```

**Benefits:**

- Theme parsers only modify Layer 1 variables
- **Simplified Layer 2/3**: Reduced from 64 to ~30 core variables (-45% complexity)
- **Consistent naming**: `{base}-{opacity}` pattern for all transparent variants
- **Easier maintenance**: No redundant aliases, single source of truth
- Derivative colors automatically update via CSS cascade

**Key Simplifications:**

- Reduced `--primary-glow-X` variants from 9 to 4 essential opacity levels
- Normalized surface tints to 2 levels (subtle/medium) vs 7+ variants
- Consolidated status colors (`--ok`/`--warn`/`--err` → `--success`/`--warning`/`--error`)
- Removed ambiguous aliases (`--muted` → `--text-muted`, `--elev` → `--surface-raised`)

### 3.2 Data Model

**Database Schema (Global Default + Per-Workspace Override):**

```sql
-- User preferences for global default theme
-- Stored in user_preferences table (category: "themes")
{
  "category": "themes",
  "preferences": {
    "defaultThemeId": "phosphor-green.json"  // Global default
  }
}

-- Workspaces table (existing):
ALTER TABLE workspaces ADD COLUMN themeId TEXT DEFAULT NULL;
-- NULL = use global default, otherwise use workspace-specific theme
```

**File System Structure:**

```
~/.dispatch/themes/               # User data directory for themes
├── phosphor-green.json           # Copied from static/ on first run
├── github-dark.json              # Copied from static/ on first run
├── github-light.json             # Copied from static/ on first run
├── one-dark-pro.json             # Copied from static/ on first run
├── dracula.json                  # Copied from static/ on first run
├── winter-is-coming.json         # Copied from static/ on first run
└── my-custom-theme.json          # User uploaded theme

static/themes/                    # Bundled preset themes (read-only)
├── phosphor-green.json           # Source for preset
├── github-dark.json
├── github-light.json
├── one-dark-pro.json
├── dracula.json
└── winter-is-coming.json
```

**Theme ID Format:**

- Theme IDs are **filenames** (e.g., `dracula.json`, `my-theme.json`)
- Stored in database as filename strings
- Resolved by reading `~/.dispatch/themes/{themeId}`

**Theme Loading Hierarchy:**

1. Check `workspace.themeId` (workspace-specific override)
2. If NULL, use `preferences.defaultThemeId` (global default)
3. If not set, fall back to `phosphor-green.json`

**Onboarding Behavior:**

- During onboarding, after authentication step
- Create `~/.dispatch/themes/` directory if it doesn't exist
- Copy all preset themes from `static/themes/` to `~/.dispatch/themes/`
- Present theme selector with preview cards
- User selects default theme (pre-select Phosphor Green)
- Save selected theme as `defaultThemeId` in user preferences
- Complete onboarding

**Post-Onboarding Behavior:**

- Themes are NOT copied on subsequent app startups
- If user deletes themes, they stay deleted (user intent respected)
- User can manually add new themes via upload or file copy
- No auto-restore of deleted presets

**Theme Object Structure:**

```typescript
interface Theme {
	id: string; // Unique identifier
	name: string; // Display name
	sourceType: 'vscode' | 'xterm' | 'preset';
	sourceJson: object; // Original uploaded theme (preserved)
	tokensJson: Record<string, string>; // Canonical CSS variables
	createdAt: string; // ISO timestamp
}
```

### 3.3 Component Architecture

**Service Layer:**

```
ThemeService.svelte.js (NEW)
├── parseVSCodeTheme(json) → tokensJson
├── parseXtermTheme(json) → tokensJson
├── validateThemeFormat(json) → boolean  // JSON structure only, no contrast
├── saveTheme(filename, theme) → Promise<void>  // Save to ~/.dispatch/themes/{filename}
├── setDefaultTheme(themeId) → Promise<void>     // Set global default
├── setWorkspaceTheme(workspaceId, themeId) → Promise<void>  // Set workspace override
├── clearWorkspaceTheme(workspaceId) → Promise<void>  // Remove override, use default
├── deleteTheme(themeId) → Promise<void>          // Delete from ~/.dispatch/themes/
├── loadThemeForWorkspace(workspaceId) → Theme    // Resolve hierarchy
├── loadThemeById(themeId) → Theme                // Read from ~/.dispatch/themes/{themeId}
├── listAvailableThemes() → Theme[]               // List all themes in ~/.dispatch/themes/
├── installPresetsForOnboarding() → Promise<void> // ONE-TIME copy during onboarding
└── autoRefreshPage() → void                      // Trigger page reload after theme change
```

**ViewModel Layer:**

```
ThemeViewModel.svelte.js (NEW)
├── themes = $state([])          // All available themes
├── activeTheme = $state(null)   // Currently active theme
├── uploadedFile = $state(null)  // Uploaded theme file
├── validationError = $state(null)
├── isUploading = $state(false)
├── filteredThemes = $derived.by(() => /* search/filter */)
└── Methods:
    ├── uploadTheme(file)
    ├── activateTheme(themeId)
    ├── deleteTheme(themeId)
    ├── loadThemes()
    └── installPresetsForOnboarding()  // Called during onboarding

OnboardingViewModel.svelte.js (EXISTING, UPDATED)
├── currentStep = $state('auth')
├── selectedTheme = $state('phosphor-green.json')  // NEW
├── availableThemes = $state([])                   // NEW
└── Methods:
    ├── completeAuthStep()
    ├── completeWorkspaceStep()
    ├── completeThemeStep()  // NEW - Install presets & set default
    └── completeOnboarding()
```

**UI Components:**

```
ThemeManager.svelte (NEW)
├── ThemeUploadZone.svelte
├── ThemePreviewCard.svelte
├── ThemeGrid.svelte
└── ThemeValidationAlert.svelte

OnboardingThemeStep.svelte (NEW)
├── ThemePreviewCard.svelte (reused)
└── ThemeGrid.svelte (reused)
```

---

## 4. Input Formats & Detection

### 4.1 Accepted Uploads

**File Requirements:**

- **Format**: `.json` (text/plain)
- **Size Limit**: 1 MB
- **Encoding**: UTF-8

**Supported Schemas:**

1. **VS Code Theme:**

```json
{
	"name": "My Theme",
	"type": "dark",
	"colors": {
		"editor.background": "#1e1e1e",
		"editor.foreground": "#d4d4d4",
		"terminal.background": "#1e1e1e",
		"terminal.ansiBlack": "#000000",
		"terminal.ansiRed": "#cd3131"
		/* ... */
	},
	"tokenColors": [
		/* syntax highlighting rules */
	]
}
```

2. **xterm Theme:**

```json
{
	"background": "#1e1e1e",
	"foreground": "#d4d4d4",
	"cursor": "#aeafad",
	"selection": "#264f78",
	"black": "#000000",
	"red": "#cd3131",
	"green": "#0dbc79"
	/* ... 16 ANSI colors */
}
```

### 4.2 Detection Logic

```javascript
function detectThemeType(json) {
	// VS Code theme detection
	if (json.colors || json.tokenColors) {
		return 'vscode';
	}

	// xterm theme detection
	if (json.background && json.foreground && json.black) {
		return 'xterm';
	}

	throw new Error('Unsupported theme format. Upload VS Code or xterm theme JSON.');
}
```

---

## 5. Theme Parsing & Mapping

### 5.1 VS Code → Canonical Palette

**Mapping Strategy:**

```javascript
const VS_CODE_MAPPING = {
	// Backgrounds
	'terminal.background': '--theme-bg-primary',
	'panel.background': '--theme-bg-secondary',
	'editor.background': '--theme-bg-primary', // Fallback

	// Foregrounds
	'terminal.foreground': '--theme-fg-primary',
	'editor.foreground': '--theme-fg-primary', // Fallback
	descriptionForeground: '--theme-fg-secondary',

	// Accents
	'button.background': '--theme-accent-primary',
	focusBorder: '--theme-accent-primary',
	'activityBarBadge.background': '--theme-accent-secondary',

	// Terminal ANSI (16 colors)
	'terminal.ansiBlack': '--theme-ansi-black',
	'terminal.ansiRed': '--theme-ansi-red',
	'terminal.ansiGreen': '--theme-ansi-green',
	'terminal.ansiYellow': '--theme-ansi-yellow',
	'terminal.ansiBlue': '--theme-ansi-blue',
	'terminal.ansiMagenta': '--theme-ansi-magenta',
	'terminal.ansiCyan': '--theme-ansi-cyan',
	'terminal.ansiWhite': '--theme-ansi-white',
	'terminal.ansiBrightBlack': '--theme-ansi-bright-black',
	'terminal.ansiBrightRed': '--theme-ansi-bright-red',
	'terminal.ansiBrightGreen': '--theme-ansi-bright-green',
	'terminal.ansiBrightYellow': '--theme-ansi-bright-yellow',
	'terminal.ansiBrightBlue': '--theme-ansi-bright-blue',
	'terminal.ansiBrightMagenta': '--theme-ansi-bright-magenta',
	'terminal.ansiBrightCyan': '--theme-ansi-bright-cyan',
	'terminal.ansiBrightWhite': '--theme-ansi-bright-white'
};
```

**Implementation:**

```javascript
export function parseVSCodeTheme(vsCodeTheme) {
	const colors = vsCodeTheme.colors ?? {};
	const tokens = {};

	// Map VS Code colors to canonical palette
	for (const [vsKey, canonicalVar] of Object.entries(VS_CODE_MAPPING)) {
		if (colors[vsKey]) {
			tokens[canonicalVar] = colors[vsKey];
		}
	}

	// Derive missing UI colors from terminal/editor colors
	if (!tokens['--theme-bg-secondary']) {
		tokens['--theme-bg-secondary'] = deriveSecondaryBg(tokens['--theme-bg-primary']);
	}

	if (!tokens['--theme-accent-primary']) {
		tokens['--theme-accent-primary'] =
			colors['focusBorder'] || tokens['--theme-ansi-blue'] || '#2ee66b'; // Phosphor Green fallback
	}

	// Fill missing ANSI colors with defaults
	return fillDefaults(tokens);
}

function deriveSecondaryBg(primaryBg) {
	// Lighten/darken by 5% using color-mix in JS
	// For server-side: use simple hex manipulation
	return adjustBrightness(primaryBg, 0.05);
}

function fillDefaults(tokens) {
	const DEFAULTS = {
		'--theme-bg-primary': '#0c1210',
		'--theme-bg-secondary': '#121a17',
		'--theme-fg-primary': '#d9ffe6',
		'--theme-fg-secondary': '#92b3a4',
		'--theme-accent-primary': '#2ee66b',
		'--theme-accent-secondary': '#00c2ff',
		'--theme-ansi-black': '#0c1210',
		'--theme-ansi-red': '#ef476f',
		'--theme-ansi-green': '#2ee66b',
		'--theme-ansi-yellow': '#f5f543',
		'--theme-ansi-blue': '#2472c8',
		'--theme-ansi-magenta': '#bc3fbc',
		'--theme-ansi-cyan': '#11a8cd',
		'--theme-ansi-white': '#e5e5e5',
		'--theme-ansi-bright-black': '#666666',
		'--theme-ansi-bright-red': '#f14c4c',
		'--theme-ansi-bright-green': '#23d18b',
		'--theme-ansi-bright-yellow': '#f5f543',
		'--theme-ansi-bright-blue': '#3b8eea',
		'--theme-ansi-bright-magenta': '#d670d6',
		'--theme-ansi-bright-cyan': '#29b8db',
		'--theme-ansi-bright-white': '#ffffff'
	};

	return { ...DEFAULTS, ...tokens };
}
```

### 5.2 xterm → Canonical Palette

```javascript
export function parseXtermTheme(xtermTheme) {
	const tokens = {
		// Direct mappings
		'--theme-bg-primary': xtermTheme.background,
		'--theme-fg-primary': xtermTheme.foreground,
		'--theme-ansi-black': xtermTheme.black,
		'--theme-ansi-red': xtermTheme.red,
		'--theme-ansi-green': xtermTheme.green,
		'--theme-ansi-yellow': xtermTheme.yellow,
		'--theme-ansi-blue': xtermTheme.blue,
		'--theme-ansi-magenta': xtermTheme.magenta,
		'--theme-ansi-cyan': xtermTheme.cyan,
		'--theme-ansi-white': xtermTheme.white,
		'--theme-ansi-bright-black': xtermTheme.brightBlack,
		'--theme-ansi-bright-red': xtermTheme.brightRed,
		'--theme-ansi-bright-green': xtermTheme.brightGreen,
		'--theme-ansi-bright-yellow': xtermTheme.brightYellow,
		'--theme-ansi-bright-blue': xtermTheme.brightBlue,
		'--theme-ansi-bright-magenta': xtermTheme.brightMagenta,
		'--theme-ansi-bright-cyan': xtermTheme.brightCyan,
		'--theme-ansi-bright-white': xtermTheme.brightWhite
	};

	// Derive UI colors from terminal palette
	tokens['--theme-bg-secondary'] = deriveSecondaryBg(tokens['--theme-bg-primary']);
	tokens['--theme-fg-secondary'] = tokens['--theme-ansi-bright-black'] || '#92b3a4';
	tokens['--theme-accent-primary'] = tokens['--theme-ansi-blue'] || '#2ee66b';
	tokens['--theme-accent-secondary'] = tokens['--theme-ansi-cyan'] || '#00c2ff';

	return fillDefaults(tokens);
}
```

### 5.3 Preset Themes

**Bundled Presets (auto-installed from `static/themes/` to `~/.dispatch/themes/`):**

```javascript
// Preset theme definitions (shipped in static/themes/)
export const PRESET_THEMES = [
	{
		id: 'phosphor-green.json',
		name: 'Phosphor Green (Default)',
		description: 'Dispatch default terminal aesthetic',
		isPreset: true
	},
	{
		id: 'github-dark.json',
		name: 'GitHub Dark',
		description: 'GitHub website dark theme',
		isPreset: true
	},
	{
		id: 'github-light.json',
		name: 'GitHub Light',
		description: 'GitHub website light theme',
		isPreset: true
	},
	{
		id: 'one-dark-pro.json',
		name: 'One Dark Pro',
		description: 'Popular balanced dark theme for long coding sessions',
		isPreset: true
	},
	{
		id: 'dracula.json',
		name: 'Dracula Official',
		description: 'Classic pink, purple, and blue palette that reduces eye strain',
		isPreset: true
	},
	{
		id: 'winter-is-coming.json',
		name: 'Winter Is Coming',
		description: 'Light theme with clean and crisp look',
		isPreset: true
	}
];

// On startup: ensurePresetsInstalled()
// - Check if ~/.dispatch/themes/ exists, create if missing
// - For each preset, check if ~/.dispatch/themes/{id} exists
// - If missing, copy from static/themes/{id}
// - If exists, preserve (user may have modified)
```

**Onboarding Theme Installation:**

```javascript
// src/lib/server/shared/theme-installer.js
import fs from 'fs/promises';
import path from 'path';
import { PRESET_THEMES } from './preset-themes.js';

/**
 * Install preset themes during onboarding (ONE-TIME operation)
 * Called from onboarding flow, NOT on app startup
 */
export async function installPresetsForOnboarding() {
	const themesDir = path.join(process.env.HOME || '~', '.dispatch', 'themes');
	const staticThemesDir = path.join(process.cwd(), 'static', 'themes');

	// Create themes directory
	await fs.mkdir(themesDir, { recursive: true });

	// Copy ALL presets (no existence check - this is first-time setup)
	for (const preset of PRESET_THEMES) {
		const userThemePath = path.join(themesDir, preset.id);
		const staticThemePath = path.join(staticThemesDir, preset.id);

		await fs.copyFile(staticThemePath, userThemePath);
		console.log(`Installed preset theme: ${preset.name}`);
	}

	console.log('Preset themes installed successfully');
}

/**
 * Check if themes have been installed (onboarding complete check)
 */
export async function areThemesInstalled() {
	const themesDir = path.join(process.env.HOME || '~', '.dispatch', 'themes');

	try {
		const files = await fs.readdir(themesDir);
		// If directory has files, assume onboarding completed
		return files.length > 0;
	} catch {
		// Directory doesn't exist or can't be read
		return false;
	}
}
```

---

## 6. Theme Application

### 6.1 Theme Loading Strategy

**Client-Side Loading (Primary):**

```javascript
// src/lib/client/theming/theme-loader.js

export async function loadThemeForWorkspace(workspaceId) {
	// Fetch theme via API (resolves hierarchy server-side)
	const response = await fetch(`/api/themes/resolve?workspaceId=${workspaceId}`);
	const theme = await response.json();

	// Apply CSS variables
	applyThemeTokens(theme.tokensJson);

	return theme;
}

function applyThemeTokens(tokens) {
	const root = document.documentElement;
	for (const [key, value] of Object.entries(tokens)) {
		root.style.setProperty(key, value);
	}
}
```

**SSR Optimization (Optional):**

```javascript
// src/routes/+layout.server.js (optional SSR)
import { getWorkspaceTheme } from '$lib/server/shared/theme-storage.js';

export async function load({ url, cookies }) {
	const workspaceId = url.searchParams.get('workspace') || cookies.get('activeWorkspace');

	// Optional: Pre-render theme CSS variables for FOUC prevention
	const workspaceTheme = workspaceId
		? await getWorkspaceTheme(workspaceId)
		: await getDefaultTheme();

	return {
		themeTokens: workspaceTheme?.tokensJson || null,
		workspaceId
	};
}
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
	import { onMount } from 'svelte';
	import { loadThemeForWorkspace } from '$lib/client/theming/theme-loader.js';

	let { data, children } = $props();

	// Client-side theme loading (always runs)
	onMount(async () => {
		await loadThemeForWorkspace(data.workspaceId);
	});
</script>

<!-- Optional SSR: Inject theme variables if available (FOUC prevention) -->
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

{@render children()}
```

**Theme Resolution Hierarchy (Server-Side):**

```javascript
// src/lib/server/shared/theme-storage.js
import fs from 'fs/promises';
import path from 'path';

export async function getWorkspaceTheme(workspaceId) {
	// 1. Check workspace-specific theme
	const workspace = await db.getWorkspace(workspaceId);
	if (workspace.themeId) {
		return await loadThemeFromFile(workspace.themeId);
	}

	// 2. Fall back to global default theme
	const prefs = await db.getUserPreferences('themes');
	const defaultThemeId = prefs?.defaultThemeId || 'phosphor-green.json';
	return await loadThemeFromFile(defaultThemeId);
}

async function loadThemeFromFile(themeId) {
	const themesDir = path.join(process.env.HOME || '~', '.dispatch', 'themes');
	const themePath = path.join(themesDir, themeId);

	const themeJson = await fs.readFile(themePath, 'utf-8');
	return JSON.parse(themeJson);
}
```

### 6.2 CodeMirror 6 Theme

**Create theme extension that references CSS variables:**

```javascript
// src/lib/client/editor/cm6-theme.js
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const dispatchTheme = EditorView.theme(
	{
		'&': {
			backgroundColor: 'var(--theme-bg-primary)',
			color: 'var(--theme-fg-primary)'
		},
		'.cm-content': {
			caretColor: 'var(--theme-accent-primary)'
		},
		'.cm-cursor, .cm-dropCursor': {
			borderLeftColor: 'var(--theme-accent-primary)'
		},
		'&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
			backgroundColor: 'color-mix(in srgb, var(--theme-accent-primary) 30%, transparent)'
		},
		'.cm-activeLine': {
			backgroundColor: 'color-mix(in srgb, var(--theme-fg-primary) 7%, transparent)'
		},
		'.cm-gutters': {
			backgroundColor: 'var(--theme-bg-secondary)',
			color: 'var(--theme-ansi-bright-black)',
			borderRight: '1px solid color-mix(in srgb, var(--theme-fg-primary) 10%, transparent)'
		},
		'.cm-activeLineGutter': {
			backgroundColor: 'color-mix(in srgb, var(--theme-fg-primary) 10%, transparent)'
		}
	},
	{ dark: true }
);

export const dispatchSyntaxHighlighting = syntaxHighlighting(
	HighlightStyle.define([
		{ tag: t.comment, color: 'var(--theme-ansi-bright-black)' },
		{ tag: t.keyword, color: 'var(--theme-ansi-bright-magenta)' },
		{ tag: t.string, color: 'var(--theme-ansi-green)' },
		{ tag: [t.number, t.bool, t.atom], color: 'var(--theme-ansi-cyan)' },
		{
			tag: [t.function(t.variableName), t.function(t.propertyName)],
			color: 'var(--theme-ansi-yellow)'
		},
		{ tag: [t.typeName, t.className], color: 'var(--theme-ansi-blue)' },
		{ tag: [t.variableName, t.propertyName], color: 'var(--theme-fg-primary)' },
		{ tag: t.operator, color: 'var(--theme-accent-primary)' },
		{ tag: t.regexp, color: 'var(--theme-ansi-red)' }
	])
);

// Usage in editor initialization:
// new EditorView({
//   extensions: [dispatchTheme, dispatchSyntaxHighlighting]
// });
```

### 6.3 xterm.js Theme

**Generate ITheme from CSS variables at runtime:**

```javascript
// src/lib/client/terminal/xterm-theme-generator.js

/**
 * Generates xterm.js ITheme object from CSS custom properties
 * Reads computed values from document root
 */
export function generateXtermTheme() {
	const root = document.documentElement;
	const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();

	return {
		background: cssVar('--theme-bg-primary'),
		foreground: cssVar('--theme-fg-primary'),
		cursor: cssVar('--theme-accent-primary'),
		cursorAccent: cssVar('--theme-bg-primary'),
		selectionBackground: cssVar('--theme-accent-primary') + '4d', // 30% alpha
		selectionForeground: cssVar('--theme-fg-primary'),

		// ANSI colors
		black: cssVar('--theme-ansi-black'),
		red: cssVar('--theme-ansi-red'),
		green: cssVar('--theme-ansi-green'),
		yellow: cssVar('--theme-ansi-yellow'),
		blue: cssVar('--theme-ansi-blue'),
		magenta: cssVar('--theme-ansi-magenta'),
		cyan: cssVar('--theme-ansi-cyan'),
		white: cssVar('--theme-ansi-white'),
		brightBlack: cssVar('--theme-ansi-bright-black'),
		brightRed: cssVar('--theme-ansi-bright-red'),
		brightGreen: cssVar('--theme-ansi-bright-green'),
		brightYellow: cssVar('--theme-ansi-bright-yellow'),
		brightBlue: cssVar('--theme-ansi-bright-blue'),
		brightMagenta: cssVar('--theme-ansi-bright-magenta'),
		brightCyan: cssVar('--theme-ansi-bright-cyan'),
		brightWhite: cssVar('--theme-ansi-bright-white')
	};
}
```

**Integration in TerminalPane.svelte:**

```javascript
import { generateXtermTheme } from './xterm-theme-generator.js';

onMount(() => {
	term = new Terminal({
		theme: generateXtermTheme(), // Apply theme from CSS vars
		fontFamily: 'var(--font-mono)',
		fontSize: 14,
		cursorBlink: true
		// ... other options
	});
});
```

---

## 7. Theme Validation

### 7.1 Validation Requirements

**Format validation only (no contrast enforcement):**

1. **JSON Structure**: Valid JSON, matches VS Code or xterm schema
2. **Color Format**: All color values are valid hex, rgb(), rgba(), hsl(), or hsla()
3. **Completeness**: All 16 ANSI colors defined (with fallback defaults if missing)

**User choice over standards:**

- No WCAG contrast ratio enforcement
- Users decide if theme readability works for them
- Themes upload successfully regardless of contrast levels

### 7.2 Format Validation

```javascript
// src/lib/client/theming/theme-validator.js

/**
 * Validate theme format only (structure and color validity)
 * No contrast or accessibility enforcement
 */
export function validateThemeFormat(json, sourceType) {
	const errors = [];
	const warnings = [];

	// Validate JSON structure
	if (sourceType === 'vscode') {
		if (!json.colors && !json.tokenColors) {
			errors.push({
				code: 'INVALID_VSCODE_STRUCTURE',
				message: 'VS Code theme must have "colors" or "tokenColors" property.'
			});
		}
	} else if (sourceType === 'xterm') {
		if (!json.background || !json.foreground) {
			errors.push({
				code: 'INVALID_XTERM_STRUCTURE',
				message: 'xterm theme must have "background" and "foreground" properties.'
			});
		}
	}

	// Validate color formats
	const colorRegex = /^(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\()/;
	const colors = sourceType === 'vscode' ? json.colors : json;

	for (const [key, value] of Object.entries(colors || {})) {
		if (typeof value === 'string' && !colorRegex.test(value)) {
			warnings.push({
				code: 'INVALID_COLOR_FORMAT',
				message: `Color "${key}" has invalid format: "${value}". Expected hex, rgb(), or hsl().`
			});
		}
	}

	// Check for missing ANSI colors (warning only)
	const requiredAnsiColors = [
		'black',
		'red',
		'green',
		'yellow',
		'blue',
		'magenta',
		'cyan',
		'white',
		'bright-black',
		'bright-red',
		'bright-green',
		'bright-yellow',
		'bright-blue',
		'bright-magenta',
		'bright-cyan',
		'bright-white'
	];

	if (sourceType === 'vscode') {
		const missingColors = requiredAnsiColors.filter(
			(color) => !json.colors?.[`terminal.ansi${capitalize(camelize(color))}`]
		);

		if (missingColors.length > 0) {
			warnings.push({
				code: 'MISSING_ANSI_COLORS',
				message: `Missing ANSI colors: ${missingColors.join(', ')}. Defaults will be used.`
			});
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings
	};
}
```

---

## 8. API Endpoints

### 8.1 POST /api/themes/upload

**Upload and save theme to ~/.dispatch/themes/**

**Request:**

```http
POST /api/themes/upload
Content-Type: multipart/form-data
Authorization: Bearer {authKey}

file: theme.json
name: my-custom-theme (optional, defaults to sanitized theme name from JSON)
```

**Response (Success):**

```json
{
	"success": true,
	"theme": {
		"id": "my-custom-theme.json",
		"name": "My Custom Theme",
		"sourceType": "vscode",
		"path": "~/.dispatch/themes/my-custom-theme.json",
		"validation": {
			"valid": true,
			"warnings": [
				{
					"code": "MISSING_ANSI_COLORS",
					"message": "Missing ANSI colors: bright-cyan. Defaults will be used."
				}
			]
		}
	}
}
```

**File Naming:**

- Uploaded theme is saved to `~/.dispatch/themes/{sanitized-name}.json`
- Theme ID is the filename: `my-custom-theme.json`
- If file exists, append timestamp: `my-custom-theme-1234567890.json`

**Response (Format Error):**

```json
{
	"success": false,
	"error": "INVALID_FORMAT",
	"validation": {
		"valid": false,
		"errors": [
			{
				"code": "INVALID_VSCODE_STRUCTURE",
				"message": "VS Code theme must have 'colors' or 'tokenColors' property."
			}
		]
	}
}
```

### 8.2 GET /api/themes

**List all available themes from ~/.dispatch/themes/**

**Request:**

```http
GET /api/themes?authKey={authKey}
```

**Response:**

```json
{
	"defaultThemeId": "phosphor-green.json",
	"themes": [
		{
			"id": "phosphor-green.json",
			"name": "Phosphor Green (Default)",
			"isPreset": true,
			"path": "~/.dispatch/themes/phosphor-green.json"
		},
		{
			"id": "dracula.json",
			"name": "Dracula Official",
			"isPreset": true,
			"path": "~/.dispatch/themes/dracula.json"
		},
		{
			"id": "my-custom-theme.json",
			"name": "My Custom Theme",
			"isPreset": false,
			"path": "~/.dispatch/themes/my-custom-theme.json",
			"createdAt": "2025-09-30T12:00:00Z"
		}
	]
}
```

### 8.3 POST /api/themes/default

**Set global default theme**

**Request:**

```http
POST /api/themes/default
Content-Type: application/json

{
  "themeId": "dracula.json",
  "authKey": "..."
}
```

**Response:**

```json
{
	"success": true,
	"message": "Default theme updated. Page will refresh automatically.",
	"defaultThemeId": "dracula.json"
}
```

### 8.4 POST /api/workspaces/:workspaceId/theme

**Set workspace-specific theme override**

**Request:**

```http
POST /api/workspaces/workspace-123/theme
Content-Type: application/json

{
  "themeId": "github-dark.json",
  "authKey": "..."
}
```

**Response:**

```json
{
	"success": true,
	"message": "Workspace theme updated. Page will refresh automatically.",
	"workspace": {
		"id": "workspace-123",
		"themeId": "github-dark.json"
	}
}
```

### 8.5 DELETE /api/workspaces/:workspaceId/theme

**Remove workspace theme override (revert to global default)**

**Request:**

```http
DELETE /api/workspaces/workspace-123/theme?authKey={authKey}
```

**Response:**

```json
{
	"success": true,
	"message": "Workspace theme cleared. Using global default. Page will refresh automatically.",
	"workspace": {
		"id": "workspace-123",
		"themeId": null
	}
}
```

### 8.6 GET /api/themes/resolve

**Resolve theme for current workspace (follows hierarchy)**

**Request:**

```http
GET /api/themes/resolve?workspaceId=workspace-123&authKey={authKey}
```

**Response:**

```json
{
	"theme": {
		"id": "github-dark.json",
		"name": "GitHub Dark",
		"tokensJson": {
			/* CSS variables */
		},
		"source": "workspace" // "workspace" | "default" | "fallback"
	}
}
```

### 8.7 DELETE /api/themes/:id

**Delete custom theme from ~/.dispatch/themes/**

**Request:**

```http
DELETE /api/themes/my-custom-theme.json?authKey={authKey}
```

**Response:**

```json
{
	"success": true,
	"message": "Theme deleted successfully."
}
```

**Error (Cannot Delete Preset):**

```json
{
	"success": false,
	"error": "CANNOT_DELETE_PRESET",
	"message": "Cannot delete preset themes. To restore defaults, delete the file and restart the application."
}
```

**Error (Theme In Use):**

```json
{
	"success": false,
	"error": "THEME_IN_USE",
	"message": "Theme is currently in use by 3 workspace(s). Change workspace themes first.",
	"workspaces": ["workspace-1", "workspace-2", "workspace-3"]
}
```

---

## 9. UI Components

### 9.1 OnboardingThemeStep.svelte

**Theme selection during onboarding (NEW)**

**Features:**

- Shows before workspace creation step
- Grid of preset theme previews with live demos
- Pre-selected default (Phosphor Green)
- Single-click selection
- "Continue" button to complete step

**Flow:**

1. User completes terminal key creation step
2. App calls `installPresetsForOnboarding()` (copies themes)
3. Theme step shows all available presets
4. User selects preferred theme (or keeps default)
5. Clicking "Continue" sets `defaultThemeId` and continues the onboarding flow

**Layout:**

```svelte
<OnboardingStep title="Choose Your Theme">
	<p class="description">
		Select a color theme for your workspace. You can change this later in settings.
	</p>

	<ThemeGrid>
		{#each presetThemes as theme}
			<ThemePreviewCard
				{theme}
				selected={selectedTheme === theme.id}
				onclick={() => (selectedTheme = theme.id)}
			/>
		{/each}
	</ThemeGrid>

	<div class="actions">
		<Button variant="ghost" onclick={skipStep}>Skip</Button>
		<Button variant="primary" onclick={completeThemeStep}>
			Continue with {selectedThemeName}
		</Button>
	</div>
</OnboardingStep>
```

### 9.2 ThemeManager.svelte

**Main theme management interface (post-onboarding)**

**Features:**

- Upload zone for drag-and-drop theme files
- All installed themes grid with previews
- Custom themes grid with delete actions
- Current default theme indicator
- Theme activation (sets default or workspace override)

**Layout:**

```svelte
<Modal title="Theme Manager" size="large" augmented="tl-clip tr-clip bl-clip br-clip both">
	{#snippet children()}
		<div class="theme-manager">
			<!-- Upload Section -->
			<FormSection label="Upload Theme">
				<ThemeUploadZone
					onupload={handleUpload}
					uploading={viewModel.isUploading}
					error={viewModel.validationError}
				/>
			</FormSection>

			<!-- Preset Themes -->
			<FormSection label="Preset Themes">
				<ThemeGrid themes={presetThemes}>
					{#each presetThemes as theme}
						<ThemePreviewCard
							{theme}
							active={viewModel.activeTheme?.id === theme.id}
							onclick={() => viewModel.activateTheme(theme.id)}
						/>
					{/each}
				</ThemeGrid>
			</FormSection>

			<!-- Custom Themes -->
			{#if viewModel.themes.length > 0}
				<FormSection label="Custom Themes">
					<ThemeGrid themes={viewModel.themes}>
						{#each viewModel.themes as theme}
							<ThemePreviewCard
								{theme}
								active={viewModel.activeTheme?.id === theme.id}
								deletable={true}
								ondelete={() => viewModel.deleteTheme(theme.id)}
								onclick={() => viewModel.activateTheme(theme.id)}
							/>
						{/each}
					</ThemeGrid>
				</FormSection>
			{/if}
		</div>
	{/snippet}

	{#snippet footer()}
		<Button variant="ghost" onclick={close}>Close</Button>
	{/snippet}
</Modal>
```

### 9.3 ThemePreviewCard.svelte

**Individual theme preview with interactive demo**

**Design:**

- Terminal-style window chrome (macOS-style traffic light dots)
- Live terminal command preview with ANSI colors
- UI elements (button, text) in theme colors
- Hover glow effect using theme accent
- Active indicator border

**Implementation:**

```svelte
<script>
	let { theme, active = false, deletable = false, onclick, ondelete } = $props();
</script>

<div
	class="theme-preview"
	class:active
	style="
    --preview-bg: {theme.tokensJson['--theme-bg-primary']};
    --preview-fg: {theme.tokensJson['--theme-fg-primary']};
    --preview-accent: {theme.tokensJson['--theme-accent-primary']};
  "
	role="button"
	tabindex="0"
	{onclick}
	onkeydown={(e) => e.key === 'Enter' && onclick?.()}
>
	<!-- Window Chrome -->
	<div class="preview-header">
		<div class="preview-dots">
			<span class="dot" style="background: {theme.tokensJson['--theme-ansi-red']}"></span>
			<span class="dot" style="background: {theme.tokensJson['--theme-ansi-yellow']}"></span>
			<span class="dot" style="background: {theme.tokensJson['--theme-ansi-green']}"></span>
		</div>
		<span class="preview-title">{theme.name}</span>
		{#if deletable}
			<button
				class="delete-btn"
				onclick={(e) => {
					e.stopPropagation();
					ondelete?.();
				}}
				aria-label="Delete theme">×</button
			>
		{/if}
	</div>

	<!-- Terminal Preview -->
	<div class="preview-terminal">
		<div class="terminal-line">
			<span style="color: {theme.tokensJson['--theme-ansi-green']}">$</span>
			<span style="color: {theme.tokensJson['--theme-fg-primary']}">npm run dev</span>
		</div>
		<div class="terminal-line">
			<span style="color: {theme.tokensJson['--theme-ansi-cyan']}">&gt;</span>
			<span style="color: {theme.tokensJson['--theme-fg-primary']}">Server ready at</span>
			<span style="color: {theme.tokensJson['--theme-accent-primary']}">localhost:3030</span>
		</div>
	</div>

	<!-- UI Elements Preview -->
	<div class="preview-ui">
		<div
			class="preview-button"
			style="
        background: {theme.tokensJson['--theme-accent-primary']};
        color: {theme.tokensJson['--theme-bg-primary']};
      "
		>
			Primary Button
		</div>
		<div
			class="preview-text"
			style="color: {theme.tokensJson['--theme-fg-secondary'] ||
				theme.tokensJson['--theme-fg-primary']}"
		>
			Secondary text
		</div>
	</div>

	{#if active}
		<div class="active-badge">Active</div>
	{/if}
</div>

<style>
	.theme-preview {
		background: var(--preview-bg);
		border: 2px solid var(--preview-accent);
		border-radius: 8px;
		padding: var(--space-4);
		cursor: pointer;
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}

	.theme-preview:hover {
		transform: translateY(-4px);
		box-shadow:
			0 8px 24px color-mix(in oklab, var(--preview-accent) 40%, transparent),
			0 0 0 4px color-mix(in oklab, var(--preview-accent) 20%, transparent);
	}

	.theme-preview.active {
		border-color: var(--preview-accent);
		border-width: 3px;
		box-shadow: 0 0 0 4px color-mix(in oklab, var(--preview-accent) 30%, transparent);
	}

	.preview-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-3);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid color-mix(in oklab, var(--preview-fg) 20%, transparent);
	}

	.preview-dots {
		display: flex;
		gap: 6px;
	}

	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	.preview-title {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--preview-fg);
		font-size: var(--font-size-1);
		flex: 1;
	}

	.delete-btn {
		width: 24px;
		height: 24px;
		border: none;
		background: color-mix(in oklab, var(--preview-fg) 10%, transparent);
		color: var(--preview-fg);
		border-radius: 4px;
		cursor: pointer;
		font-size: 18px;
		line-height: 1;
		transition: all 0.2s;
	}

	.delete-btn:hover {
		background: color-mix(in oklab, var(--preview-fg) 20%, transparent);
	}

	.preview-terminal {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		line-height: 1.6;
		margin-bottom: var(--space-3);
	}

	.terminal-line {
		margin-bottom: 4px;
	}

	.preview-ui {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.preview-button {
		padding: var(--space-2) var(--space-3);
		border-radius: 6px;
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: var(--font-size-0);
	}

	.preview-text {
		font-size: var(--font-size-0);
	}

	.active-badge {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		background: var(--preview-accent);
		color: var(--preview-bg);
		padding: 4px 8px;
		border-radius: 4px;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
</style>
```

### 9.4 ThemeUploadZone.svelte

**Drag-and-drop file upload with validation feedback**

```svelte
<script>
	let { onupload, uploading = false, error = null } = $props();
	let isDragOver = $state(false);

	async function handleFile(file) {
		if (!file || !file.name.endsWith('.json')) {
			error = 'Please upload a .json file';
			return;
		}

		if (file.size > 1024 * 1024) {
			// 1MB
			error = 'File size exceeds 1MB limit';
			return;
		}

		onupload?.(file);
	}

	function handleDrop(e) {
		e.preventDefault();
		isDragOver = false;
		const file = e.dataTransfer?.files[0];
		handleFile(file);
	}

	function handleFileInput(e) {
		const file = e.target.files?.[0];
		handleFile(file);
	}
</script>

<div
	class="upload-zone"
	class:drag-over={isDragOver}
	data-augmented-ui="tl-clip br-clip both"
	role="button"
	tabindex="0"
	ondragover={(e) => {
		e.preventDefault();
		isDragOver = true;
	}}
	ondragleave={() => (isDragOver = false)}
	ondrop={handleDrop}
>
	<input
		type="file"
		accept=".json"
		onchange={handleFileInput}
		disabled={uploading}
		style="display: none;"
		id="theme-file-input"
	/>

	<label for="theme-file-input" class="upload-label">
		{#if uploading}
			<div class="spinner"></div>
			<p>Uploading theme...</p>
		{:else}
			<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
				<polyline points="17 8 12 3 7 8" />
				<line x1="12" y1="3" x2="12" y2="15" />
			</svg>
			<p class="upload-hint">Drop VS Code or xterm theme JSON</p>
			<p class="upload-subhint">or click to browse</p>
		{/if}
	</label>

	{#if error}
		<div class="upload-error" role="alert">
			{error}
		</div>
	{/if}
</div>

<style>
	.upload-zone {
		border: 2px dashed var(--primary-dim);
		background: var(--surface);
		padding: var(--space-5);
		text-align: center;
		transition: all 0.3s ease;
		cursor: pointer;
	}

	.upload-zone:hover,
	.upload-zone.drag-over {
		border-color: var(--primary);
		background: color-mix(in oklab, var(--surface) 95%, var(--primary) 5%);
	}

	.upload-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		color: var(--text);
	}

	.upload-hint {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: var(--font-size-1);
	}

	.upload-subhint {
		font-size: var(--font-size-0);
		color: var(--muted);
	}

	.upload-error {
		margin-top: var(--space-3);
		padding: var(--space-2);
		background: color-mix(in oklab, var(--danger) 10%, transparent);
		border: 1px solid var(--danger);
		border-radius: 4px;
		color: var(--danger);
		font-size: var(--font-size-0);
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid var(--primary-dim);
		border-top-color: var(--primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
```

---

## 10. Implementation Checklist

### Phase 1: Foundation & CSS Cleanup (Week 1)

- [ ] **CSS Variable Refactoring & Simplification**
  - [ ] Add Layer 1 (canonical palette) variables to `variables.css`
  - [ ] Simplify Layer 2: Normalize semantic names (64 → ~30 variables)
    - [ ] Replace `--muted` → `--text-muted`
    - [ ] Replace `--elev` → `--surface-raised`
    - [ ] Replace `--line` → `--border`
    - [ ] Replace `--ok`/`--warn`/`--err` → `--success`/`--warning`/`--error`
  - [ ] Simplify Layer 3: Consolidate derived variants
    - [ ] Reduce `--primary-glow-X` (9 variants → 4: 10%, 20%, 40%, 60%)
    - [ ] Consolidate surface tints (7+ variants → 2: subtle/medium)
    - [ ] Standardize opacity naming: `{base}-{opacity}` pattern
  - [ ] Update component usage incrementally
    - [ ] High-traffic components first (buttons, inputs, cards)
    - [ ] Use find-replace with careful review
  - [ ] Verify Layer 3 (derived variants) cascade correctly
  - [ ] Test color propagation with manual CSS variable changes
  - [ ] Create migration guide for variable renames

- [ ] **Database Schema & File System**
  - [ ] Add `defaultThemeId` to `user_preferences` (category: "themes")
  - [ ] Add `themeId` column to `workspaces` table (NULL = use default)
  - [ ] Create `~/.dispatch/themes/` directory structure
  - [ ] Implement `installPresetsForOnboarding()` for ONE-TIME theme copy
  - [ ] Implement `areThemesInstalled()` to check if onboarding completed
  - [ ] Create migration script for database updates

- [ ] **Theme Parsing**
  - [ ] Implement `parseVSCodeTheme()` function
  - [ ] Implement `parseXtermTheme()` function
  - [ ] Add theme type detection logic
  - [ ] Create default theme fallback system
  - [ ] Unit tests for parsing functions

### Phase 2: Services & API (Week 2)

- [ ] **ThemeService**
  - [ ] Create `ThemeService.svelte.js` with dependency injection
  - [ ] Implement file-based theme storage (`~/.dispatch/themes/`)
  - [ ] Implement theme hierarchy resolution (workspace → default → fallback)
  - [ ] Add `setDefaultTheme()`, `setWorkspaceTheme()`, `clearWorkspaceTheme()`
  - [ ] Add theme validation logic (format only, no contrast)
  - [ ] Register service in `ServiceContainer`
  - [ ] Unit tests for ThemeService

- [ ] **API Endpoints**
  - [ ] `POST /api/themes/upload` with file save to `~/.dispatch/themes/`
  - [ ] `GET /api/themes` for listing all themes from directory
  - [ ] `POST /api/themes/default` for setting global default
  - [ ] `POST /api/workspaces/:id/theme` for workspace override
  - [ ] `DELETE /api/workspaces/:id/theme` for clearing override
  - [ ] `GET /api/themes/resolve` for hierarchy resolution
  - [ ] `DELETE /api/themes/:id` for theme deletion
  - [ ] Integration tests for all endpoints

- [ ] **Theme Loading (Client-Side Primary)**
  - [ ] Create `theme-loader.js` for client-side theme application
  - [ ] Implement workspace theme resolution via `/api/themes/resolve`
  - [ ] Add `applyThemeTokens()` to update CSS variables
  - [ ] Optional: Add SSR optimization in `+layout.server.js` for FOUC prevention

### Phase 3: UI Components (Week 3)

- [ ] **ViewModels**
  - [ ] Create `ThemeViewModel.svelte.js` with runes
  - [ ] Implement reactive state management
  - [ ] Add derived state for filtering/searching
  - [ ] Unit tests for ViewModel logic

- [ ] **Theme Components**
  - [ ] Build `ThemeManager.svelte` modal
  - [ ] Build `ThemePreviewCard.svelte` with live preview
  - [ ] Build `ThemeUploadZone.svelte` with drag-and-drop
  - [ ] Build `ThemeGrid.svelte` responsive layout
  - [ ] Add theme validation feedback UI
  - [ ] Component tests with Testing Library

- [ ] **Onboarding Integration**
  - [ ] Add theme selection step to onboarding flow
  - [ ] Create `OnboardingThemeStep.svelte` component
  - [ ] Update `OnboardingViewModel` with theme selection state
  - [ ] Call `installPresetsForOnboarding()` before showing theme step
  - [ ] Save selected `defaultThemeId` on step completion

- [ ] **Settings Integration**
  - [ ] Add "Themes" section to settings page
  - [ ] Add per-workspace theme selector
  - [ ] Auto page refresh after theme activation (no manual reload)

### Phase 4: Editor & Terminal Integration (Week 4)

- [ ] **CodeMirror 6 Theme**
  - [ ] Create `cm6-theme.js` with CSS variable references
  - [ ] Implement syntax highlighting using ANSI colors
  - [ ] Test with various code samples
  - [ ] Document editor theme extension usage

- [ ] **xterm.js Theme**
  - [ ] Create `xterm-theme-generator.js`
  - [ ] Update `TerminalPane.svelte` to apply theme
  - [ ] Test terminal color rendering
  - [ ] Verify ANSI color accuracy

- [ ] **Preset Themes**
  - [ ] Create `static/themes/` directory
  - [ ] Create Phosphor Green (default) JSON in `static/themes/`
  - [ ] Create GitHub Dark theme JSON
  - [ ] Create GitHub Light theme JSON
  - [ ] Create One Dark Pro theme JSON
  - [ ] Create Dracula Official theme JSON
  - [ ] Create Winter Is Coming theme JSON
  - [ ] Implement `installPresetsForOnboarding()` (called from onboarding, not startup)
  - [ ] Test theme installation during onboarding flow

### Phase 5: Polish & Testing (Week 5)

- [ ] **Accessibility**
  - [ ] Keyboard navigation for theme manager
  - [ ] Screen reader announcements
  - [ ] High contrast mode support (OS-level)
  - [ ] Accessibility audit (keyboard/screen reader only)

- [ ] **Performance**
  - [ ] Bundle size analysis
  - [ ] Theme parsing performance testing
  - [ ] SSR rendering performance
  - [ ] CSS variable update optimization

- [ ] **Documentation**
  - [ ] User guide for theme uploads
  - [ ] Developer guide for theme creation
  - [ ] API documentation
  - [ ] Add section to CLAUDE.md
  - [ ] Update README with theming features

- [ ] **E2E Testing**
  - [ ] Onboarding theme selection flow
  - [ ] Upload VS Code theme flow
  - [ ] Upload xterm theme flow
  - [ ] Set global default theme
  - [ ] Set workspace override theme
  - [ ] Delete custom theme
  - [ ] Theme validation errors
  - [ ] Page reload after activation
  - [ ] Verify deleted themes stay deleted (no auto-restore)

---

## 11. Success Metrics

**User Adoption:**

- % of users who upload custom themes
- Most popular preset themes
- Average number of custom themes per user

**Quality:**

- % of uploaded themes passing format validation
- User feedback on theme accuracy
- Theme preview rendering quality

**Performance:**

- Theme upload/parse time < 500ms
- SSR theme injection time < 50ms
- Page refresh time after theme activation < 2s

**Workspace Integration:**

- Theme persistence per workspace
- Visual workspace identification success rate

---

## 12. Future Enhancements (Out of Scope)

- **Live Theme Switching**: Apply themes without reload (requires CM6 compartments)
- **Theme Editor**: Visual theme customization tool
- **Theme Marketplace**: Community theme sharing platform
- **Theme Import/Export**: Share themes between Dispatch instances
- **Syntax Token Customization**: Fine-grained syntax highlighting control
- **Theme Variables Export**: Generate CSS variables from active theme
- **Dark/Light Mode Auto-Switch**: Respect system theme preference
- **Theme Variants**: Auto-generate light/dark variants from single theme

---

## 13. Dependencies & Bundle Impact

**New Dependencies:**

```json
{
	"dependencies": {
		"codemirror": "^6.0.1",
		"@codemirror/view": "^6.34.3",
		"@codemirror/language": "^6.10.5",
		"@lezer/highlight": "^1.2.1",
		"@codemirror/theme-one-dark": "^6.1.2",
		"color-parse": "^2.0.2"
	}
}
```

**Estimated Bundle Impact:**

- CodeMirror 6 core: ~120KB (gzipped: ~40KB)
- Theme parsing utilities: ~8KB (gzipped: ~3KB)
- UI components: ~15KB (gzipped: ~5KB)
- **Total addition: ~143KB raw, ~48KB gzipped**

**Lazy Loading Strategy:**

- Load CM6 only when file editor is opened
- Theme manager UI loaded on-demand (modal)
- Parse theme files server-side to minimize client bundle

---

## 14. Security Considerations

**Input Validation:**

- File size limit: 1 MB
- JSON parsing with error handling (no eval)
- Color value sanitization (regex validation)
- Reject non-JSON files

**XSS Prevention:**

- Sanitize all theme names and metadata
- Escape CSS custom property values
- No inline styles from user input (only CSS variables)

**Storage:**

- Store custom themes in `~/.dispatch/themes/` directory
- Store preset themes in `static/themes/` (copied to user directory on startup)
- Themes require authentication via TERMINAL_KEY
- Global default theme in user_preferences table
- Per-workspace theme overrides in workspaces table

---

## 15. Open Questions & Decisions

**Q1: Should we support theme import/export for sharing?**

- **Decision:** No, out of scope for v1. Upload mechanism covers basic need.

**Q2: Should theme activation require explicit confirmation?**

- **Decision:** No, activate immediately with auto page refresh
- Preview card makes theme choice intentional

**Q3: How to handle incomplete VS Code themes (missing terminal colors)?**

- **Decision:** Use intelligent fallbacks, show warnings
- Don't block upload, fill with sensible defaults

**Q4: Should we support TextMate grammar for advanced syntax highlighting?**

- **Decision:** No, out of scope for v1
- Use simple tag-based syntax highlighting from Lezer

**Q5: Should we allow editing uploaded themes?**

- **Decision:** No, only upload and activate
- Re-upload modified theme if changes needed

**Q6: Should deleted themes be restored on app restart?**

- **Decision:** No, deleted themes stay deleted
- Respects user intent (they chose to delete)
- Only copy presets during onboarding (one-time)

---

## 16. Appendix: Example Preset Theme

**Phosphor Green (Dispatch Default):**

```json
{
	"id": "phosphor-green",
	"name": "Phosphor Green (Default)",
	"sourceType": "preset",
	"tokensJson": {
		"--theme-bg-primary": "#0c1210",
		"--theme-bg-secondary": "#121a17",
		"--theme-fg-primary": "#d9ffe6",
		"--theme-fg-secondary": "#92b3a4",
		"--theme-accent-primary": "#2ee66b",
		"--theme-accent-secondary": "#00c2ff",
		"--theme-ansi-black": "#0c1210",
		"--theme-ansi-red": "#ef476f",
		"--theme-ansi-green": "#2ee66b",
		"--theme-ansi-yellow": "#ffd166",
		"--theme-ansi-blue": "#2472c8",
		"--theme-ansi-magenta": "#bc3fbc",
		"--theme-ansi-cyan": "#00c2ff",
		"--theme-ansi-white": "#d9ffe6",
		"--theme-ansi-bright-black": "#666666",
		"--theme-ansi-bright-red": "#f14c4c",
		"--theme-ansi-bright-green": "#2ee66b",
		"--theme-ansi-bright-yellow": "#ffd166",
		"--theme-ansi-bright-blue": "#3b8eea",
		"--theme-ansi-bright-magenta": "#d670d6",
		"--theme-ansi-bright-cyan": "#00c2ff",
		"--theme-ansi-bright-white": "#ffffff"
	}
}
```

---

**End of PRD**
