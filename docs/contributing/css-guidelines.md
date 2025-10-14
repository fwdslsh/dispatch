# CSS Guidelines

**Last Updated**: 2025-10-08
**Purpose**: Maintain consistent, maintainable CSS across Dispatch components

## Overview

This guide establishes CSS quality standards, naming conventions, and best practices for Dispatch. All components should follow these guidelines to ensure visual consistency, maintainability, and performance.

## Design System Integration

### Available Design Tokens

Dispatch has a comprehensive design system defined in `src/lib/client/shared/styles/variables.css`. **Always use design tokens instead of hardcoded values.**

#### Spacing System

```css
--space-0: 2px;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 48px;
```

**Usage:**

- Form field spacing: `--space-4` (16px)
- Field group spacing: `--space-5` (24px)
- Section spacing: `--space-6` (32px)

#### Color System

**Surface Colors:**

```css
--bg: /* Base background */ --surface: /* Card/panel background */ --elev: /* Elevated elements */
	--surface-primary-98: /* Subtle accent tint */;
```

**Text Colors:**

```css
--text: /* Primary text */ --muted: /* Secondary text (75% opacity, WCAG AA compliant) */
	--text-dim: /* Tertiary text (55% opacity) */;
```

**Primary Colors:**

```css
--primary: /* Accent color */ --primary-bright: /* Brighter variant */
	--primary-dim: /* Dimmer variant */ --primary-muted: /* Muted variant */;
```

**Primary Glows (for shadows/borders):**

```css
--primary-glow-10 through --primary-glow-60
/* Use for subtle effects, borders, and shadows */
```

**Semantic Colors:**

```css
--ok / --success: /* Success states */
--warn / --warning: /* Warning states */
--err / --error: /* Error states */
--info: /* Informational states */
--err-dim: /* Error background tints */
```

**Borders:**

```css
--line: /* Default borders */ --line-strong: /* Emphasized borders */;
```

#### Typography

**Font Families:**

```css
--font-mono: /* Monospace (Share Tech Mono) */ --font-sans: /* Sans-serif (Exo 2) */
	--font-accent: /* Accent headings (Protest Revolution) */;
```

**Font Sizes:**

```css
--font-size-0: 12px; /* Small text, badges */
--font-size-1: 14px; /* Body text, labels */
--font-size-2: 16px; /* Emphasized text */
--font-size-3: 18px; /* Subsection headings */
--font-size-4: 22px; /* Section headings */
```

#### Border Radius

```css
--radius-xs: 1px;
--radius-sm: 2px;
--radius-md: 4px;
--radius-lg: 6px;
--radius-xl: 8px;
--radius-full: 9999px;
```

#### Shadows

```css
--shadow-1 through --shadow-5
--card-shadow
--focus-ring-shadow
```

### Utility Classes

Located in `src/lib/client/shared/styles/utilities.css`:

**Layout:**

```css
.flex, .flex-col, .flex-center, .flex-between, .flex-wrap
.flex-1, .items-center, .justify-start, .justify-end
```

**Spacing:**

```css
.gap-1 through .gap-6
.p-1 through .p-6
.m-0 through .m-3
```

**Typography:**

```css
.text-muted, .text-primary, .text-sm, .text-xs, .text-base
.font-medium, .font-semibold, .font-bold
```

**Backgrounds:**

```css
.bg-surface, .bg-surface-glass, .bg-surface-highlight
```

## CSS Architecture Patterns

### Component Organization

Each component should have:

1. **Local styles** - Component-specific styling
2. **Shared styles** - Reusable patterns extracted to `src/lib/client/shared/styles/components/`
3. **Utility classes** - Use existing utilities when possible

### File Structure

```
src/lib/client/shared/styles/
├── variables.css       # Design tokens
├── retro.css          # Retro terminal theme
├── utilities.css      # Utility classes
└── components/
    ├── index.css      # Component imports
    ├── buttons.css    # Button styles
    ├── forms.css      # Form styles
    ├── modal.css      # Modal styles
    ├── misc.css       # Misc components
    └── settings.css   # Settings components
```

## Common Patterns & Shared Styles

### Settings Components

**Section Headers:**

```css
/* Use: .settings-section-header and child classes */
.settings-section-header {
	padding: var(--space-3) 0;
	border-bottom: 1px solid var(--line);
}

.settings-section-header__title {
	margin: 0;
	font-size: var(--font-size-3);
	font-weight: 600;
	color: var(--text);
	font-family: var(--font-mono);
}

.settings-section-header__description {
	margin: var(--space-2) 0 0 0;
	font-size: var(--font-size-1);
	color: var(--muted);
	font-family: var(--font-mono);
	line-height: 1.5;
}
```

**Section Containers:**

```css
.settings-card {
	background: var(--bg);
	padding: var(--space-5);
	border-radius: var(--radius-lg);
	border: 1px solid var(--primary-glow-20);
	box-shadow: 0 0 15px var(--primary-glow-10);
}
```

**Section Titles:**

```css
.settings-section-title {
	font-family: var(--font-mono);
	text-transform: uppercase;
	letter-spacing: 0.1em;
	font-size: var(--font-size-2);
	margin: 0 0 var(--space-2) 0;
	color: var(--primary);
}
```

**Dividers:**

```css
.settings-divider {
	height: 1px;
	background: linear-gradient(90deg, transparent, var(--primary-glow-30), transparent);
	margin: var(--space-4) 0;
}
```

### Form Patterns

**Status Messages:**

```css
.form-status {
	font-family: var(--font-mono);
	font-size: var(--font-size-1);
	padding: var(--space-2) 0;
	min-height: var(--space-5);
	display: flex;
	align-items: center;
}

.form-status--success {
	color: var(--ok);
}
.form-status--error {
	color: var(--err);
}
.form-status--warning {
	color: var(--warn);
}
```

**Message Boxes:**

```css
.message-box {
	padding: var(--space-3);
	border-radius: var(--radius-sm);
	font-size: var(--font-size-1);
	display: flex;
	align-items: center;
	gap: var(--space-2);
	font-family: var(--font-mono);
}

.message-box--error {
	background: var(--err-dim);
	border: 1px solid var(--err);
	color: var(--err);
}

.message-box--success {
	background: color-mix(in oklab, var(--ok) 15%, var(--surface));
	border: 1px solid var(--ok);
	color: var(--ok);
}

.message-box--warning {
	background: color-mix(in oklab, var(--warn) 15%, var(--surface));
	border: 1px solid var(--warn);
	color: var(--warn);
}
```

### Loading States

```css
.loading-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: var(--space-6);
	gap: var(--space-3);
	color: var(--muted);
	font-family: var(--font-mono);
}

.loading-spinner {
	width: 2rem;
	height: 2rem;
	border: 2px solid transparent;
	border-top: 2px solid currentColor;
	border-radius: var(--radius-full);
	animation: spin 1s linear infinite;
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}
```

## Naming Conventions

### BEM Methodology

Use Block-Element-Modifier (BEM) for component-specific styles:

```css
/* Block */
.settings-panel {
}

/* Element */
.settings-panel__header {
}
.settings-panel__content {
}

/* Modifier */
.settings-panel--collapsed {
}
.settings-panel__header--sticky {
}
```

### Naming Rules

1. **Blocks**: Component name (kebab-case)
2. **Elements**: `block__element` (double underscore)
3. **Modifiers**: `block--modifier` or `block__element--modifier` (double dash)
4. **Utility classes**: Single word or hyphenated (`.flex`, `.text-muted`)
5. **State classes**: Prefix with `is-` or `has-` (`.is-active`, `.has-error`)

## Best Practices

### DO

✅ **Use design tokens**

```css
/* Good */
padding: var(--space-4);
color: var(--text);
border: 1px solid var(--line);
```

✅ **Use utility classes for simple patterns**

```html
<!-- Good: Reuse utilities -->
<div class="flex gap-2 items-center"></div>
```

✅ **Extract repeated patterns to shared components**

```css
/* Good: Shared pattern */
.settings-section-header {
	/* ... */
}
```

✅ **Use OKLAB color-mix for dynamic tints**

```css
/* Good: Dynamic color mixing */
background: color-mix(in oklab, var(--ok) 15%, var(--surface));
```

✅ **Provide accessibility features**

```css
/* Good: Accessible focus states */
:focus-visible {
	outline: 2px solid var(--primary);
	outline-offset: 2px;
}

/* Good: Respect motion preferences */
@media (prefers-reduced-motion: reduce) {
	.loading-spinner {
		animation: none;
	}
}
```

### DON'T

❌ **Use hardcoded values**

```css
/* Bad: Hardcoded values */
padding: 16px;
color: #2ee66b;
border: 1px solid rgba(46, 230, 107, 0.2);
```

❌ **Use deprecated tokens**

```css
/* Bad: Deprecated tokens */
color: var(--text-primary); /* Use --text */
color: var(--text-muted); /* Use --muted */
border: 1px solid var(--border-color); /* Use --line */
```

❌ **Create custom CSS for simple layouts**

```css
/* Bad: Reinventing utilities */
.my-container {
    display: flex;
    gap: 8px;
}
/* Good: Use utilities */
<div class="flex gap-2">
```

❌ **Duplicate patterns across components**

```css
/* Bad: Duplicated in 5 components */
.section-header {
	padding: var(--space-3) 0;
	border-bottom: 1px solid var(--line);
}
/* Good: Use shared .settings-section-header */
```

## Deprecated Tokens Reference

The following tokens should **NOT** be used. Replace with modern equivalents:

| Deprecated         | Use Instead              |
| ------------------ | ------------------------ |
| `--border-color`   | `--line`                 |
| `--text-primary`   | `--text`                 |
| `--text-secondary` | `--muted`                |
| `--text-muted`     | `--muted`                |
| `--error-color`    | `--err`                  |
| `--primary-light`  | `--primary-bright`       |
| `--accent-red`     | `--err` or `--secondary` |
| `--text-sm`        | `--font-size-1`          |

## Performance Considerations

### Transitions

Use hardware-accelerated properties:

```css
/* Good: GPU-accelerated */
transition:
	transform 150ms,
	opacity 150ms;

/* Bad: Layout-triggering */
transition:
	width 150ms,
	left 150ms;
```

### Animations

Respect reduced motion preferences:

```css
.animated-element {
	animation: slide-in 0.3s ease;
}

@media (prefers-reduced-motion: reduce) {
	.animated-element {
		animation: none;
	}
}
```

### Color-mix() Browser Support

`color-mix()` is supported in modern browsers (Chrome 111+, Firefox 113+, Safari 16.2+). Always provide fallback:

```css
/* With fallback */
background: var(--surface-primary-98); /* Fallback */
background: color-mix(in oklab, var(--primary) 2%, var(--surface));
```

## Migration Guide

### Updating Components to Design System

1. **Audit current styles**
   - Find hardcoded values
   - Identify deprecated tokens
   - Note repeated patterns

2. **Replace hardcoded values**

   ```css
   /* Before */
   padding: 16px;
   color: #2ee66b;

   /* After */
   padding: var(--space-4);
   color: var(--primary);
   ```

3. **Update deprecated tokens**

   ```css
   /* Before */
   color: var(--text-muted);
   border: 1px solid var(--border-color);

   /* After */
   color: var(--muted);
   border: 1px solid var(--line);
   ```

4. **Extract shared patterns**
   - Move to appropriate file in `components/`
   - Use BEM naming
   - Document usage

5. **Replace custom CSS with utilities**

   ```html
   <!-- Before -->
   <div class="custom-flex-container">
   	<style>
   		.custom-flex-container {
   			display: flex;
   			gap: 8px;
   			align-items: center;
   		}
   	</style>

   	<!-- After -->
   	<div class="flex gap-2 items-center"></div>
   </div>
   ```

## Code Review Checklist

When reviewing CSS changes:

- [ ] Uses design tokens (no hardcoded values)
- [ ] No deprecated tokens
- [ ] Follows BEM naming convention
- [ ] Extracts repeated patterns to shared styles
- [ ] Uses utility classes where appropriate
- [ ] Includes focus states for interactive elements
- [ ] Respects `prefers-reduced-motion`
- [ ] Provides color-mix() fallbacks
- [ ] Consistent spacing using design system
- [ ] Accessible color contrast (WCAG AA)

## Resources

- **Design Tokens**: `src/lib/client/shared/styles/variables.css`
- **Utilities**: `src/lib/client/shared/styles/utilities.css`
- **Shared Components**: `src/lib/client/shared/styles/components/`
- **Visual Design System**: `docs/reference/visual-design-system.md`
- **CSS Quality Review**: Root directory review documents (archived)

## Getting Help

- Review existing components for patterns
- Check shared component styles in `components/`
- Consult design system documentation
- Ask in code reviews for CSS guidance

---

**Last Reviewed**: CSS Quality Settings Review (2025-10-08)
**Key Findings**: Identified 15+ duplicate patterns, 350-400 lines of CSS can be eliminated through consolidation
