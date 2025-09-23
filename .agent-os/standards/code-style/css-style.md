# CSS Style Guide

This document outlines the CSS conventions, patterns, and best practices used in the Dispatch project. Our CSS architecture emphasizes modern CSS features, design tokens, and maintainable component styling.

## Overview

Dispatch uses a custom CSS architecture with:

- **Design Token System**: CSS custom properties for colors, spacing, typography
- **Modern CSS Features**: Nested CSS, `color-mix()`, `light-dark()` functions
- **Component Scoping**: Svelte component styles with strategic global patterns
- **Theme Support**: Built-in light/dark mode with terminal-inspired aesthetics
- **Performance Focus**: Optimized CSS with minimal duplication

## CSS Architecture

### File Structure

```
src/lib/client/shared/styles/
├── index.css          # Main entry point
├── variables.css      # Design tokens and CSS custom properties
├── fonts.css         # Font face definitions
├── retro.css         # Global UI styles and terminal theme
├── animations.css    # Shared animations and keyframes
└── window-manager.css # Window management specific styles
```

### Import Order

Always import CSS files in this order:

```css
@import url(./fonts.css);
@import url(./variables.css);
@import url(./retro.css);
@import url(./animations.css);
```

## Design Token System

### Color Variables

Use CSS custom properties for all colors. Never use hardcoded color values.

```css
/* ✅ Correct */
.button {
	background: var(--primary);
	color: var(--text);
	border: 1px solid var(--primary-dim);
}

/* ❌ Wrong */
.button {
	background: #2ee66b;
	color: #d9ffe6;
	border: 1px solid #1ea851;
}
```

#### Core Color Palette

```css
/* Base colors */
--bg: #0c1210 /* Main background */ --surface: #121a17 /* Panel/card backgrounds */ --elev: #18231f
	/* Elevated surface */ --text: #d9ffe6 /* Primary text */ --muted: #92b3a4 /* Secondary text */
	/* Accent colors */ --accent: #2ee66b /* Primary accent */ --primary: #2ee66b
	/* Primary actions */ --primary-dim: #1ea851 /* Dimmed primary */ /* Status colors */
	--ok: #26d07c /* Success states */ --warn: #ffb703 /* Warning states */ --err: #ef476f
	/* Error states */ --info: #00c2ff /* Info states */;
```

### Spacing System

Use consistent spacing variables for all layout and positioning:

```css
/* Spacing scale */
--space-0: 2px --space-1: 4px --space-2: 8px --space-3: 12px --space-4: 16px --space-5: 24px
	--space-6: 32px;
```

**Usage Examples:**

```css
.card {
	padding: var(--space-4);
	margin-bottom: var(--space-3);
	gap: var(--space-2);
}
```

### Typography Scale

```css
/* Font families */
--font-sans: 'Exo 2', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'Share Tech Mono', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
--font-accent: 'Protest Revolution', 'Courier New', monospace;

/* Font sizes */
--font-size-0: 12px /* Small text, badges */ --font-size-1: 14px /* Body text, labels */
	--font-size-2: 16px /* Default text */ --font-size-3: 18px /* Subheadings */ --font-size-4: 22px
	/* Headings */ --font-size-5: 28px /* Large headings */;
```

## Modern CSS Features

### Nested CSS

Use nested CSS for better organization and readability:

```css
.session-card {
	background: var(--surface);
	border: 1px solid var(--primary-dim);
	padding: var(--space-4);

	& .title {
		font-family: var(--font-mono);
		color: var(--text);
		margin: 0 0 var(--space-2) 0;
	}

	& .status {
		font-size: var(--font-size-1);
		color: var(--muted);

		&.active {
			color: var(--ok);
		}

		&.error {
			color: var(--err);
		}
	}

	&:hover {
		border-color: var(--primary);
		transform: translateY(-1px);
	}
}
```

### Color Functions

Use modern CSS color functions for dynamic color manipulation:

```css
/* color-mix() for transparency and blending */
.overlay {
	background: color-mix(in oklab, var(--bg) 80%, transparent);
}

.glow-effect {
	box-shadow: 0 0 20px color-mix(in oklab, var(--primary) 40%, transparent);
}

/* light-dark() for theme-aware colors */
.theme-aware {
	background: light-dark(#ffffff, #0c1210);
	color: light-dark(#000000, #d9ffe6);
}
```

### Logical Properties

Prefer logical properties for better internationalization:

```css
/* ✅ Correct - logical properties */
.content {
	margin-block: var(--space-4);
	margin-inline: var(--space-2);
	padding-block-start: var(--space-3);
	border-inline-start: 2px solid var(--primary);
}

/* ❌ Avoid - physical properties */
.content {
	margin-top: var(--space-4);
	margin-bottom: var(--space-4);
	margin-left: var(--space-2);
	margin-right: var(--space-2);
}
```

## Component Styling Patterns

### Inline Styles

DO NOT USE INLINE STYLES

### Svelte Component Styles

#### Scoped Styles

Keep component-specific styles scoped within the component:

```svelte
<script>
	let isActive = $state(false);
</script>

<div class="session-item" class:active={isActive}>
	<h3 class="title">Session Name</h3>
	<p class="description">Session description</p>
</div>

<style>
	.session-item {
		background: var(--surface);
		border: 1px solid var(--primary-dim);
		border-radius: 0;
		padding: var(--space-4);
		transition: all 0.2s ease;

		&:hover {
			border-color: var(--primary);
			transform: translateY(-1px);
		}

		&.active {
			border-color: var(--ok);
			background: color-mix(in oklab, var(--ok) 10%, var(--surface));
		}
	}

	.title {
		font-family: var(--font-mono);
		font-size: var(--font-size-3);
		color: var(--text);
		margin: 0 0 var(--space-2) 0;
	}

	.description {
		font-size: var(--font-size-1);
		color: var(--muted);
		margin: 0;
	}
</style>
```

#### Global Styles

Use `:global()` sparingly for styling child components or library elements:

```svelte
<style>
	/* Scoped to this component's children */
	.terminal-container :global(.xterm-screen) {
		background: var(--bg);
	}

	/* Global keyframe animations */
	:global {
		@keyframes componentSpecificAnimation {
			from {
				opacity: 0;
			}
			to {
				opacity: 1;
			}
		}
	}
</style>
```

#### CSS Custom Properties in Components

Pass CSS custom properties to child components for theming:

```svelte
<CustomButton
	--button-bg="var(--primary)"
	--button-color="var(--bg)"
	--button-border="var(--primary-dim)"
>
	Click me
</CustomButton>
```

## Animation Guidelines

### Performance

Use transform and opacity for animations to ensure smooth performance:

```css
/* ✅ Correct - hardware accelerated */
.slide-in {
	transform: translateX(100%);
	opacity: 0;
	transition:
		transform 0.3s ease,
		opacity 0.3s ease;

	&.visible {
		transform: translateX(0);
		opacity: 1;
	}
}

/* ❌ Avoid - causes layout thrashing */
.slide-in-bad {
	left: 100%;
	transition: left 0.3s ease;

	&.visible {
		left: 0;
	}
}
```

### Shared Animations

Use shared keyframes from `animations.css`:

```css
.fade-in {
	animation: fadeIn 0.3s ease-out;
}

.pulse-effect {
	animation: pulse 2s infinite;
}

.loading-spinner {
	animation: spin 1s linear infinite;
}
```

## Theme Creation and Management

### Adding New Themes

1. **Define theme variables in `variables.css`:**

```css
[data-theme='cyberpunk'] {
	--bg: #0a0a0a;
	--surface: #1a1a2e;
	--elev: #16213e;
	--text: #00fff9;
	--muted: #6c7b7f;
	--accent: #ff00ff;
	--primary: #00fff9;
	--primary-dim: #008b8b;
	--ok: #00ff00;
	--warn: #ffff00;
	--err: #ff0040;
	--info: #00bfff;
}
```

### Theme-Aware Components

Write components that automatically adapt to theme changes:

```css
.component {
	/* Uses CSS custom properties that change with theme */
	background: var(--surface);
	color: var(--text);
	border-color: var(--primary-dim);

	/* Responsive to system theme changes */
	@media (prefers-color-scheme: dark) {
		/* Additional dark theme adjustments if needed */
	}
}
```

## Best Practices

### Performance

1. **Minimize CSS bundle size:**
   - Avoid duplicate styles across components
   - Use shared animations and patterns
   - Leverage CSS custom properties for variations

2. **Optimize selectors:**
   - Prefer class selectors over complex descendant selectors
   - Use CSS nesting for organization, not performance

3. **Use efficient animations:**
   - Animate `transform` and `opacity` only
   - Use `will-change` sparingly and remove after animation

### Maintainability

1. **Follow naming conventions:**
   - Use descriptive class names: `.session-card`, `.button-primary`
   - Prefix component-specific classes: `.terminal-output`, `.modal-header`

2. **Keep styles close to components:**
   - Component-specific styles in Svelte `<style>` blocks
   - Shared patterns in global stylesheets

3. **Document complex CSS:**

   ```css
   /* Complex grid layout for responsive terminal layout */
   .terminal-grid {
   	display: grid;
   	grid-template-columns:
   		[sidebar-start] 300px
   		[content-start] 1fr
   		[content-end];
   	/* ... */
   }
   ```

### Accessibility

1. **Respect user preferences:**

   ```css
   @media (prefers-reduced-motion: reduce) {
   	* {
   		animation-duration: 0.01ms !important;
   		animation-iteration-count: 1 !important;
   		transition-duration: 0.01ms !important;
   	}
   }
   ```

2. **Ensure sufficient contrast:**
   - Use design token colors that meet WCAG guidelines
   - Test themes with accessibility tools

3. **Focus management:**

   ```css
   .interactive-element:focus-visible {
   	outline: 2px solid var(--primary);
   	outline-offset: 2px;
   }
   ```
