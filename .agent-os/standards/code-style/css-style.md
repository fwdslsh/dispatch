# CSS Style Guide

We use modern CSS features and a comprehensive design token system for all styling in the Dispatch application.

## Design System Overview

The Dispatch CSS architecture is built around:
- **Design Tokens**: CSS custom properties for colors, spacing, and effects
- **Component Patterns**: Reusable classes for common UI elements
- **Animation System**: Unified keyframes for consistent motion
- **Responsive Design**: Mobile-first approach with CSS Grid and Flexbox

## Core Principles

### 1. Use Design Tokens
Always use CSS custom properties instead of hardcoded values:

```css
/* ✅ Good - Uses design tokens */
.card {
	background: var(--surface);
	border: 1px solid var(--surface-border);
	border-radius: var(--radius-md);
	padding: var(--space-4);
	color: var(--text);
}

/* ❌ Bad - Hardcoded values */
.card {
	background: #121a17;
	border: 1px solid rgba(46, 230, 107, 0.2);
	border-radius: 8px;
	padding: 16px;
	color: #cfe7d8;
}
```

### 2. Component Composition Over Duplication
Build components using base classes and modifiers:

```css
/* Base pattern */
.card {
	background: var(--surface);
	border: 1px solid var(--surface-border);
	border-radius: var(--radius-md);
	padding: var(--space-4);
	transition: var(--transition-default);
}

/* State modifiers */
.card.is-active {
	border-color: var(--success);
	background: var(--success-bg);
}

.card.is-selected {
	border-color: var(--primary);
	box-shadow: var(--shadow-primary);
}

/* Type modifiers */
.card--session {
	/* Session-specific overrides only */
	--card-icon-size: 48px;
}
```

### 3. Use Unified Animation System
Reference existing keyframes instead of creating duplicates:

```css
/* ✅ Good - Uses unified animation */
.loading-indicator {
	animation: scan 2s linear infinite;
}

.status-bar {
	animation: pulse 2s ease-in-out infinite;
}

/* ❌ Bad - Creates duplicate animation */
@keyframes myCustomScan {
	0% { transform: translateX(-100%); }
	100% { transform: translateX(100%); }
}
```

## Design Token Reference

### Colors
```css
/* Primary palette */
--primary: #2ee66b;           /* Main brand color */
--primary-bright: #4eff82;    /* Lighter variant */
--primary-dim: #1ea851;       /* Darker variant */

/* Semantic colors */
--success: var(--ok);         /* #26d07c */
--warning: var(--warn);       /* #ffb703 */
--error: var(--err);          /* #ef476f */
--info: #00c2ff;

/* Surface colors */
--bg: #0c1210;                /* Background */
--surface: #121a17;           /* Cards, panels */
--elev: #18231f;              /* Elevated elements */

/* Text colors */
--text: #d9ffe6;              /* Primary text */
--muted: #92b3a4;             /* Secondary text */
```

### Transparency & Effects
```css
/* Glow effects (primary color with transparency) */
--primary-glow-10: color-mix(in oklab, var(--primary) 10%, transparent);
--primary-glow-20: color-mix(in oklab, var(--primary) 20%, transparent);
--primary-glow-30: color-mix(in oklab, var(--primary) 30%, transparent);
--primary-glow-40: color-mix(in oklab, var(--primary) 40%, transparent);
--primary-glow-50: color-mix(in oklab, var(--primary) 50%, transparent);
--primary-glow-60: color-mix(in oklab, var(--primary) 60%, transparent);

/* Common effects */
--glow: color-mix(in oklab, var(--accent) 40%, transparent);
--focus: color-mix(in oklab, var(--accent) 80%, white 10%);
--line: color-mix(in oklab, var(--text) 20%, transparent);
```

### Spacing Scale
```css
--space-0: 2px;    /* Hairline spacing */
--space-1: 4px;    /* Tight spacing */
--space-2: 8px;    /* Small spacing */
--space-3: 12px;   /* Medium spacing */
--space-4: 16px;   /* Default spacing */
--space-5: 24px;   /* Large spacing */
--space-6: 32px;   /* Extra large spacing */
```

## Animation Guidelines

### Available Keyframes
```css
/* Core animations - use these instead of creating new ones */
@keyframes fadeIn { /* Fade in */ }
@keyframes fadeInUp { /* Fade in with upward motion */ }
@keyframes slideIn { /* Scale and slide */ }
@keyframes pulse { /* Opacity pulse */ }
@keyframes spin { /* 360° rotation */ }
@keyframes scan { /* Horizontal sweep - unified for all scan effects */ }
@keyframes shimmer { /* Background position shimmer */ }
```

### Animation Best Practices
```css
/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
	.animated-element {
		animation: none;
		transition: none;
	}
}

/* Use consistent timing functions */
.smooth-interaction {
	transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1);
}

.quick-feedback {
	transition: all 0.15s ease-out;
}
```

## Component Patterns

### Cards
```css
.card {
	background: var(--surface);
	border: 1px solid var(--surface-border);
	border-radius: var(--radius-md);
	padding: var(--space-4);
	transition: all 0.2s ease;
}

.card:hover {
	border-color: var(--primary-dim);
	transform: translateY(-1px);
	box-shadow: 0 2px 8px var(--shadow-sm);
}

.card.is-active {
	border-color: var(--success);
	background: color-mix(in oklab, var(--success) 5%, transparent);
}
```

### Interactive Elements
```css
.interactive {
	transition: all 0.2s ease;
	cursor: pointer;
}

.interactive:hover {
	transform: translateY(-1px);
}

.interactive:active {
	transform: translateY(0);
}
```

### Focus States
```css
.focusable:focus {
	outline: 2px solid var(--primary);
	outline-offset: 2px;
	box-shadow: 0 0 0 4px var(--primary-glow-20);
}
```

## File Organization

### Global Styles Structure
```
src/lib/client/shared/styles/
├── index.css          # Main import file
├── variables.css      # Design tokens
├── fonts.css         # Font definitions
├── animations.css    # Keyframes and animation utilities
├── retro.css        # Theme-specific styles
└── window-manager.css # Window management system
```

### Component Styles Guidelines
- Keep component-specific styles minimal
- Use global patterns and tokens
- Only add truly unique styles to components
- Prefer composition over duplication

```svelte
<!-- ✅ Good - Uses global patterns -->
<div class="card interactive is-active">
	<h3 class="card__title">Session Name</h3>
</div>

<style>
	/* Only component-specific styles */
	.card__title {
		--title-color: var(--primary-bright);
	}
</style>
```

## Migration Guidelines

When updating existing components:

1. **Replace hardcoded values** with design tokens
2. **Consolidate duplicate animations** - use existing keyframes
3. **Extract common patterns** to global classes
4. **Use semantic color variables** instead of direct color references
5. **Test for visual regressions** after changes

### Example Migration
```css
/* Before */
.my-component {
	background: #121a17;
	border: 1px solid rgba(46, 230, 107, 0.2);
	transition: all 0.2s ease;
}

.my-component:hover {
	background: #18231f;
	border-color: #2ee66b;
	transform: translateY(-1px);
}

/* After */
.my-component {
	background: var(--surface);
	border: 1px solid var(--primary-glow-20);
	transition: var(--transition-default);
}

/* Use global interactive pattern instead */
.my-component.interactive:hover {
	background: var(--elev);
	border-color: var(--primary);
}
```

## Performance Considerations

- **Use CSS variables** for runtime theme switching
- **Minimize specificity** - prefer classes over complex selectors  
- **Consolidate animations** - reuse existing keyframes
- **Use color-mix()** for dynamic color variations
- **Leverage CSS-in-JS sparingly** - prefer CSS custom properties

This style guide ensures consistency, maintainability, and performance across the Dispatch application's CSS architecture.
