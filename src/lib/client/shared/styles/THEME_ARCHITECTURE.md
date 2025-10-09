# Theme Architecture Guide

## Overview

The Dispatch CSS architecture now supports dynamic theme switching via CSS custom properties (CSS variables). This guide explains how themes work and how to add new themes.

## Current Theme: Retro Terminal

**File:** `retro.css`
**Design System:** Phosphor Green terminal aesthetic with CRT effects
**Active:** Default theme (currently loaded)

## Theme Structure

### 1. Base Theme File (`retro.css`)

Contains ONLY base HTML element styling:

- Document defaults (html, body)
- Typography (h1-h6, p, code, pre)
- Links (a)
- Forms (input, select, textarea with all states)
- Tables (table, thead, tbody)
- Theme-specific effects (.glow, .prompt, body::before scanlines)

**What belongs in a theme file:**

- ✅ Default HTML element styles
- ✅ Focus and selection states
- ✅ Scrollbar customization
- ✅ Theme-specific visual effects
- ✅ Form input states (hover, focus, disabled, invalid, valid)

**What does NOT belong in a theme file:**

- ❌ Component-specific classes (`.card`, `.badge`, `.modal-actions`)
- ❌ Layout utilities (`.container`, `.flex`, `.grid`)
- ❌ Component BEM selectors (`.btn--primary`, `.workspace-selector`)

### 2. Design Tokens (`variables.css`)

All themes share the same design token structure but with different values:

```css
:root {
  /* Typography */
  --font-sans: ...;
  --font-mono: ...;
  --font-accent: ...;

  /* Spacing */
  --space-0 through --space-7;

  /* Colors */
  --bg: ...;
  --surface: ...;
  --text: ...;
  --accent: ...;
  --ok, --warn, --err: ...;

  /* Effects */
  --glow: ...;
  --focus: ...;
}
```

### 3. Component Styles (Separate from Themes)

**Location:** `src/lib/client/shared/styles/components/`

- `buttons.css` - Button system (BEM pattern)
- `forms.css` - Form component patterns
- `modal.css` - Modal system
- `menu-panel.css` - Menu/panel layouts
- `misc.css` - Cards, badges, error messages, etc.

These files use design tokens and work with any theme.

## Adding a New Theme

### Step 1: Create Theme File

Create `src/lib/client/shared/styles/themes/[theme-name].css`:

```css
/* ==================================================================
   [THEME NAME] THEME - Base HTML Styles

   Description: [Brief theme description]
   ================================================================== */

/* Copy structure from retro.css */
/* Modify styles to match your theme aesthetic */
```

### Step 2: Update Design Tokens (Optional)

If your theme needs different color values, create a theme-specific variables file:

`src/lib/client/shared/styles/themes/[theme-name]-variables.css`

```css
:root {
	/* Override only the tokens that change */
	--bg: #ffffff;
	--surface: #f5f5f5;
	--text: #1a1a1a;
	--accent: #0066cc;
	/* etc. */
}
```

### Step 3: Update Import

In `src/lib/client/shared/styles/index.css`:

```css
/* Switch between themes by commenting/uncommenting */
/* @import url(./retro.css); */
@import url(./themes/modern.css);
```

Or use dynamic loading based on user preference:

```javascript
// In theme switching logic
if (theme === 'modern') {
	import('./themes/modern.css');
} else {
	import('./retro.css');
}
```

## Theme Examples

### Retro Terminal (Current)

- **Colors:** Dark phosphor green (#2ee66b), dark background
- **Effects:** CRT scanlines, glow effects, terminal prompts
- **Typography:** Monospace primary, uppercase headers
- **Forms:** Futuristic with gradient borders

### Modern (Future)

- **Colors:** Clean whites/grays, subtle blues
- **Effects:** Subtle shadows, minimal glow
- **Typography:** Sans-serif, normal case
- **Forms:** Clean borders, soft focus states

### High Contrast (Future)

- **Colors:** Pure black/white, high contrast accent
- **Effects:** No effects, maximum readability
- **Typography:** Large, clear fonts
- **Forms:** Bold borders, clear states

## Design Token Categories

### Typography Tokens

- `--font-sans`, `--font-mono`, `--font-accent`
- `--font-size-0` through `--font-size-4`

### Spacing Tokens

- `--space-0` through `--space-7` (2px to 48px)
- `--radius-xs` through `--radius-full`

### Color Tokens

**Surface Colors:**

- `--bg` - Background
- `--surface` - Card/panel surface
- `--elev` - Elevated surface
- `--line` - Border color

**Text Colors:**

- `--text` - Primary text
- `--muted` - Secondary text
- `--text-dim` - Tertiary text

**Semantic Colors:**

- `--accent` / `--primary` - Primary brand color
- `--ok` / `--success` - Success state
- `--warn` / `--warning` - Warning state
- `--err` / `--error` - Error state
- `--info` - Information

**Effect Colors:**

- `--glow` - Glow/shadow effect
- `--focus` - Focus ring color
- `--primary-glow-[10-60]` - Opacity variants for gradients

## Theme Switching Implementation

### Option 1: Build-Time Theme Selection

In `svelte.config.js` or build script:

```javascript
const theme = process.env.THEME || 'retro';
// Import appropriate theme file
```

### Option 2: Runtime Theme Switching

```svelte
<script>
	import { settingsService } from '$lib/client/shared/services/SettingsService.svelte.js';

	let theme = $state(settingsService.get('appearance.theme', 'retro'));

	$effect(() => {
		// Dynamically load theme CSS
		if (theme === 'modern') {
			import('./themes/modern.css');
		} else {
			import('./retro.css');
		}
	});
</script>
```

### Option 3: CSS Custom Property Override

```javascript
// Override design tokens at runtime
document.documentElement.style.setProperty('--bg', '#ffffff');
document.documentElement.style.setProperty('--accent', '#0066cc');
// etc.
```

## Testing Theme Changes

1. **Build test:** `npm run build` - Ensure no CSS errors
2. **Visual test:** Check all form states, focus states, hover states
3. **Accessibility:** Test keyboard navigation, screen readers
4. **Responsive:** Test mobile, tablet, desktop viewports
5. **Component test:** Verify buttons, modals, cards, forms all work

## Migration Notes

**Previous State:**

- retro.css contained 810 lines mixing base HTML and components

**Current State (Refactored):**

- retro.css: 386 lines (pure base HTML theme)
- Component styles moved to:
  - `WorkspaceSelector.svelte` (66 lines)
  - `FormSection.svelte` (24 lines)
  - `CreateSessionModal.svelte` (type-grid)
  - `misc.css` (cards, badges, error messages, button groups)

**Benefits:**

- Clean separation enables theme switching
- Components work with any theme
- Reduced global CSS footprint
- Better maintainability

## Best Practices

1. **Use Design Tokens:** Always reference CSS variables, never hardcode colors
2. **Scope Component Styles:** Keep component-specific styles in component files
3. **Theme Consistency:** Maintain consistent structure across all theme files
4. **Accessibility First:** Ensure all themes meet WCAG 2.1 AA standards
5. **Document Changes:** Update this file when adding new themes

## Future Enhancements

- [ ] Add light theme (`themes/light.css`)
- [ ] Add high-contrast theme (`themes/high-contrast.css`)
- [ ] Add theme preview component
- [ ] Add theme switching UI in settings
- [ ] Persist theme preference in user settings
- [ ] Add smooth theme transition animations
