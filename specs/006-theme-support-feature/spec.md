# Feature Specification: Theme Support System

**Feature Branch**: `006-theme-support-feature`
**Created**: 2025-10-02
**Status**: Draft
**Input**: User description: "theme support feature that supports uploading theme files"

## Execution Flow (main)

```
1. Parse user description from Input
   → Extracted: Unified theming system for single-user Dispatch application
2. Extract key concepts from description
   → Identified: theme upload, theme selection, workspace themes, CSS variables, simple implementation
3. For each unclear aspect:
   → RESOLVED: Single-user app, no sharing needed
   → RESOLVED: No theme limits needed (single user)
   → RESOLVED: Hardcoded Phosphor Green fallback solves all missing-theme scenarios
4. Fill User Scenarios & Testing section
   → Primary user flows identified: onboarding theme selection, theme upload, workspace-specific themes
   → Edge cases resolved with hardcoded fallback approach
5. Generate Functional Requirements
   → All requirements testable and derived from PRD v1.2
   → Added simplicity requirements (FR-031, FR-032)
   → Added hardcoded fallback requirements (FR-029, FR-030)
6. Identify Key Entities
   → Theme, Workspace, UserPreferences - all simplified for single-user context
7. Run Review Checklist
   → All clarifications resolved
   → Simplicity and single-user context emphasized throughout
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines

- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-10-02

- Q: When a theme upload or activation fails, what response time is acceptable for showing the error message to the user? → A: Quick (< 500ms) - Brief loading indicator, then error
- Q: When the page automatically refreshes after theme activation (FR-011), what happens to unsaved work in terminal sessions or open editors? → A: N/A - Sessions and editors are already tracked and resumed by the app's existing persistence mechanisms
- Q: When displaying "warnings about missing colors" (Edge Cases, FR-018), where should these warnings appear? → A: Upload dialog - Inline warnings in the upload UI immediately after parsing
- Q: FR-004 specifies "at least 3 preset themes including: Phosphor Green (default) and two more." Which 2 additional preset themes should be included? → A: Light and Dark (basic light/dark pair)
- Q: FR-002 requires "a simple plugin architecture that allows adding support for additional theme formats." What defines "simple" in this context to avoid over-engineering? → A: Class-based with inheritance - abstract class ThemeParser { parse() }

---

## User Scenarios & Testing

### Primary User Story

As the sole user of my Dispatch instance, I want to customize the visual appearance of my workspace by uploading or selecting color themes, so that the interface matches my preferences and helps me visually distinguish between different workspaces. The theming system should support both global defaults and per-workspace overrides, allowing me to use different color schemes for different projects.

**Context**: Dispatch is a single-user application. All theme management, storage, and configuration is for one user only. There is no multi-user support, sharing, or permissions complexity.

### Acceptance Scenarios

1. **Given** I am completing the onboarding process, **When** I reach the theme selection step, **Then** I should see a grid of preset themes with live previews and be able to select my preferred default theme.

2. **Given** I have completed onboarding with a selected default theme, **When** I navigate to any workspace, **Then** I should see the interface rendered with my chosen default theme colors.

3. **Given** I have multiple workspaces, **When** I set a workspace-specific theme override, **Then** that workspace should display with the override theme while others use the global default.

4. **Given** I have an xterm theme file, **When** I upload it through the theme manager, **Then** the theme should be saved, validated, and immediately available for selection.

5. **Given** I activate a new theme, **When** the theme is applied, **Then** the page should automatically refresh to show the new colors without requiring manual reload.

6. **Given** I delete a custom theme, **When** the application restarts, **Then** the deleted theme should remain deleted and not be automatically restored.

7. **Given** I have set a workspace-specific theme, **When** I clear the workspace theme override, **Then** the workspace should revert to using the global default theme.

### Edge Cases

- What happens when a user uploads a theme with missing ANSI color definitions?
  - System should use intelligent fallbacks and display inline warnings in the upload dialog immediately after parsing, listing the specific missing colors

- What happens when a user tries to delete a theme that is currently in use by multiple workspaces?
  - System should prevent deletion and show which workspaces are using the theme

- What happens when the theme file becomes corrupted or inaccessible?
  - System should fall back to the default Phosphor Green theme

- What happens when a user deletes all preset themes?
  - System should recreate the default Phosphor Green theme programmatically from hardcoded values in the codebase

- What happens during onboarding if theme installation fails?
  - System should recreate the default Phosphor Green theme programmatically and allow onboarding to proceed

- What happens if the themes directory is deleted or corrupted?
  - System should detect missing themes and recreate the default Phosphor Green theme from hardcoded values

## Requirements

### Functional Requirements

- **FR-001**: System MUST support uploading xterm theme files with automatic format detection and parsing
- **FR-002**: System MUST provide a simple class-based parser interface (abstract class with parse() method) that allows adding support for additional theme formats without modifying core theme management code
- **FR-003**: System MUST validate uploaded theme files for correct structure and color format validity
- **FR-004**: System MUST provide exactly 3 preset themes: Phosphor Green (default), Light, and Dark
- **FR-005**: System MUST copy preset themes from bundled static directory to user data directory during onboarding (one-time operation)
- **FR-006**: System MUST allow users to set a global default theme that applies to all workspaces without specific overrides
- **FR-007**: System MUST allow users to set workspace-specific theme overrides that take precedence over the global default
- **FR-008**: System MUST resolve themes using the hierarchy: workspace override → global default → system fallback (Phosphor Green)
- **FR-009**: System MUST store custom uploaded themes in the user's data directory (`~/.dispatch/themes/`)
- **FR-010**: System MUST use theme filenames as unique identifiers (e.g., `dracula.json` as the file, `dracula` as the ID without extension)
- **FR-011**: System MUST automatically refresh the page when a theme is activated or changed (existing session persistence mechanisms will restore terminal sessions and editor state)
- **FR-012**: System MUST respect user intent when themes are deleted (no automatic restoration on restart)
- **FR-013**: System MUST prevent deletion of themes that are currently in use as global default or workspace overrides
- **FR-014**: System MUST display theme preview cards with terminal-style window chrome and live color demonstrations
- **FR-015**: System MUST normalize all uploaded themes to a canonical set of CSS custom properties
- **FR-016**: System MUST apply themes consistently across UI components and terminal sessions (code editor integration deferred to future release with CodeMirror support)
- **FR-017**: System MUST validate color values as hex, rgb, rgba, hsl, or hsla format
- **FR-018**: System MUST provide inline warnings in the upload dialog for themes with missing ANSI colors, listing the specific missing colors, while still allowing the upload to proceed
- **FR-019**: System MUST limit uploaded theme files to 5MB maximum size
- **FR-020**: System MUST require authentication for all theme management operations
- **FR-021**: Users MUST be able to select their preferred default theme during the onboarding process
- **FR-022**: Users MUST be able to upload custom themes via drag-and-drop interface
- **FR-023**: Users MUST be able to delete custom themes they have uploaded
- **FR-024**: Users MUST be able to view all available themes in a grid layout with preview cards
- **FR-025**: Users MUST receive immediate visual feedback when a theme is successfully uploaded or activated
- **FR-026**: Users MUST receive clear error messages when theme upload or activation fails, displayed within 500ms with a brief loading indicator
- **FR-027**: System MUST allow users to manually add themes by placing JSON files in the themes directory
- **FR-028**: System MUST maintain a hardcoded copy of the Phosphor Green theme definition in the codebase for programmatic recreation
- **FR-029**: System MUST recreate the Phosphor Green theme from hardcoded values when no themes are available or themes directory is missing
- **FR-030**: System MUST use the simplest possible implementation without unnecessary abstraction, multi-user complexity, or over-engineering
- **FR-031**: System MUST NOT include theme sharing, export, or multi-user features (single-user application only)
- **FR-032**: System MUST reuse existing code, patterns, and infrastructure wherever possible rather than creating new abstractions or duplicating functionality

### Key Entities

**Note**: Keep entities simple - this is a single-user application with straightforward file-based storage. Avoid over-engineering.

- **Theme**: A color scheme stored as a JSON file with filename as ID, display name, source type (xterm/preset/custom), and normalized CSS variables. Simple file-based storage in `~/.dispatch/themes/`.

- **ThemeParser**: A simple abstract class interface with a parse() method that converts theme JSON to canonical CSS variables and validates theme structure. Concrete implementations (e.g., XtermThemeParser) include validation logic as part of parsing. No separate validator class needed.

- **Workspace**: A project environment with optional theme override stored as a filename string. NULL means use the global default theme.

- **UserPreferences**: Single-user settings including the global default theme filename. Stored in database under "themes" category.

- **PresetTheme**: Bundled theme JSON file in static directory, copied to user directory during onboarding. Hardcoded Phosphor Green theme in codebase as ultimate fallback.

- **CSSVariables**: Simple key-value map of CSS custom property names to color values. No complex transformation or validation beyond basic format checking.

- **ThemeMetadata**: In-memory cached representation of theme files loaded at startup. Includes parsed CSS variables, file path, last modified timestamp, and active status. Internal implementation detail for performance optimization.


## xterm Theme Format

Example xterm theme file structure (based on xterm.js ITheme interface):

```json
{
  "name": "Dark",
  "description": "Professional dark theme with balanced contrast",
  "background": "#0d1117",
  "foreground": "#e6edf3",
  "cursor": "#58a6ff",
  "cursorAccent": "#0d1117",
  "selectionBackground": "#58a6ff40",
  "black": "#484f58",
  "red": "#ff7b72",
  "green": "#3fb950",
  "yellow": "#d29922",
  "blue": "#58a6ff",
  "magenta": "#bc8cff",
  "cyan": "#39c5cf",
  "white": "#b1bac4",
  "brightBlack": "#6e7681",
  "brightRed": "#ffa198",
  "brightGreen": "#56d364",
  "brightYellow": "#e3b341",
  "brightBlue": "#79c0ff",
  "brightMagenta": "#d2a8ff",
  "brightCyan": "#56d4dd",
  "brightWhite": "#f0f6fc"
}
```

**Required fields**: `background`, `foreground`, and ANSI colors (`black` through `brightWhite`)
**Optional fields**: `name`, `description`, `cursor`, `cursorAccent`, `selectionBackground`

---

## Review & Acceptance Checklist

### Content Quality

- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded (single-user, simple implementation)
- [x] Dependencies and assumptions identified (hardcoded fallback, file-based storage)

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities resolved (single-user, hardcoded fallback)
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---
