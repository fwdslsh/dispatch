# Visual Design System

This document establishes the consistent visual design patterns for the Dispatch application. All components should follow these guidelines to maintain visual cohesion and professional appearance.

## Design Philosophy

**Clean, Professional, Terminal-Inspired**

- Minimal use of decorative elements
- Strategic application of augmented-ui for key containers only
- Consistent spacing, colors, and typography
- Retro terminal aesthetic without visual noise

## Component Standards

### 1. **Modals**

**✅ ALWAYS USE:** Shared `Modal.svelte` component

```svelte
<Modal
	bind:open
	title="Modal Title"
	size="medium"
	closeOnBackdrop={true}
	closeOnEscape={true}
	showCloseButton={true}
	augmented="tl-clip tr-clip bl-clip br-clip both"
>
	{#snippet children()}
		<div class="modal-content">
			<!-- Content here -->
		</div>
	{/snippet}

	{#snippet footer()}
		<Button variant="ghost" onclick={close}>Cancel</Button>
		<Button variant="primary" augmented="tl-clip br-clip both">Confirm</Button>
	{/snippet}
</Modal>
```

**Modal Footer Standards:**

- Use shared `Button` component only
- Maximum 2 buttons: Cancel (ghost) + Primary action
- Primary button gets `tl-clip br-clip both` augmented styling
- Cancel button gets `augmented="none"`

### 2. **Buttons**

**✅ ALWAYS USE:** Shared `Button.svelte` component

```svelte
<!-- Primary actions -->
<Button variant="primary" augmented="tl-clip br-clip both">
	{#snippet icon()}<IconPlus size={18} />{/snippet}
	Create Session
</Button>

<!-- Secondary actions -->
<Button variant="ghost" augmented="none">Cancel</Button>

<!-- Dangerous actions -->
<Button variant="danger" augmented="tl-clip br-clip both">Delete</Button>
```

**Button Augmented-UI Rules:**

- **Primary actions:** `tl-clip br-clip both` ONLY
- **Secondary/Ghost actions:** `augmented="none"`
- **Never** use `tl-clip tr-clip bl-clip br-clip both` on buttons
- **Never** use custom button HTML elements - always use shared component

### 3. **Panels & Containers**

**✅ PROPER PANEL STYLING:**

```css
/* Clean panel appearance */
.panel {
  background: var(--surface);
  border: 2px solid var(--primary-dim);
  border-radius: 0;
  padding: var(--space-4);
  box-shadow: inset 0 0 8px var(--glow);
}

/* Container with minimal augmented-ui (ONLY if truly needed) */
.main-container {
  /* Use augmented-ui SPARINGLY - only on primary containers */
  data-augmented-ui="tl-clip br-clip both";
}
```

**Panel Rules:**

- Use clean borders with `var(--primary-dim)`
- Simple backgrounds: `var(--surface)` or `var(--bg)`
- Consistent padding with design system spacing
- **NO decorative gradients or excessive shadows**
- Augmented-UI only on main container, never on sub-panels

### 4. **Augmented-UI Usage Guidelines**

**✅ ALLOWED:**

- Main application containers (sparingly)
- Primary action buttons: `tl-clip br-clip both`
- Key modals: `tl-clip tr-clip bl-clip br-clip both`

**❌ PROHIBITED:**

- Multiple augmented-ui elements in single component
- Augmented-ui on list items, cards, or repetitive elements
- Different augmented-ui patterns within same component family
- Augmented-ui as pure decoration without functional purpose

### 5. **Color System**

**Use CSS Custom Properties:**

```css
/* Primary colors */
--bg: #0c1210 --surface: #121a17 --text: #d9ffe6 --muted: #92b3a4 /* Accent colors */
	--accent: #2ee66b --primary: #2ee66b --primary-dim: #1ea851 /* Status colors */ --ok: #26d07c
	--warn: #ffb703 --err: #ef476f --info: #00c2ff /* Spacing */ --space-1: 4px --space-2: 8px
	--space-3: 12px --space-4: 16px --space-5: 24px;
```

### 6. **Typography**

**Font Families:**

- **Headings/Labels:** `var(--font-mono)` (Share Tech Mono)
- **Body text:** `var(--font-sans)` (Exo 2)
- **Accent:** `var(--font-accent)` (Protest Revolution)

**Font Sizes:**

```css
--font-size-0: 12px /* Small text, badges */ --font-size-1: 14px /* Body text, labels */
	--font-size-2: 16px /* Default text */ --font-size-3: 18px /* Subheadings */ --font-size-4: 22px
	/* Headings */ --font-size-5: 28px /* Large headings */;
```

## Component Examples

### ✅ Good Modal Implementation

```svelte
<Modal bind:open title="Create Session" size="medium">
	{#snippet children()}
		<div class="modal-content">
			<FormSection label="Session Type">
				<!-- Clean form content -->
			</FormSection>
		</div>
	{/snippet}

	{#snippet footer()}
		<Button variant="ghost" augmented="none">Cancel</Button>
		<Button variant="primary" augmented="tl-clip br-clip both">Create</Button>
	{/snippet}
</Modal>
```

### ✅ Good Panel Implementation

```svelte
<div class="sessions-panel">
	<div class="panel-header">
		<h2>Active Sessions</h2>
		<span class="count-badge">3</span>
	</div>
	<div class="panel-content">
		<!-- Session list here -->
	</div>
</div>

<style>
	.sessions-panel {
		background: var(--bg);
		border: 2px solid var(--primary-dim);
		border-radius: 0;
		box-shadow: inset 0 0 8px var(--glow);
	}

	.panel-header {
		padding: var(--space-4);
		border-bottom: 1px solid var(--primary-dim);
		background: var(--surface);
	}
</style>
```

### ❌ Bad Implementation (Before Fix)

```svelte
<!-- DON'T DO THIS - Multiple augmented-ui elements -->
<div data-augmented-ui="tl-clip tr-clip bl-clip br-clip both">
	<div data-augmented-ui="tl-clip br-clip both">
		<div data-augmented-ui="tl-clip tr-clip bl-clip br-clip both">
			<button data-augmented-ui="tl-clip br-clip both">Button 1</button>
			<button data-augmented-ui="tl-clip br-clip both">Button 2</button>
		</div>
	</div>
</div>
```

## Design System Implementation

### Settings Page Design Patterns

Based on the Settings Page Visual Design Review (2025-10-08), the following patterns should be consistently applied across all settings sections:

#### Visual Hierarchy Standards

**Page Title (H1):**

```css
font-size: 28px; /* --font-size-5 (add to design system) */
text-transform: uppercase;
color: var(--primary);
text-shadow: 0 0 12px var(--primary-glow-25);
margin-bottom: var(--space-6);
letter-spacing: 0.08em;
```

**Section Titles (H2):**

```css
font-size: 22px; /* --font-size-4 */
text-transform: uppercase;
color: var(--primary);
margin-bottom: var(--space-5);
letter-spacing: 0.08em;
font-weight: 600;
```

**Subsection Titles (H3):**

```css
font-size: 18px; /* --font-size-3 */
font-weight: 600;
color: var(--text);
margin-bottom: var(--space-4);
/* Sentence case, not uppercase */
```

**Field Labels:**

```css
font-size: 14px; /* --font-size-1 */
font-weight: 500;
color: var(--text);
margin-bottom: var(--space-2);
/* Sentence case */
```

#### Spacing Rhythm

**Between Elements:**

- Form fields: `var(--space-4)` (16px)
- Field groups: `var(--space-5)` (24px)
- Major sections: `var(--space-6)` (32px)
- Within field groups: `var(--space-3)` (12px)
- Button groups: `var(--space-3)` (12px)

**Container Padding:**

```css
.settings-panel {
	padding: var(--space-5); /* 24px - breathing room */
}

.settings-card {
	padding: var(--space-4); /* 16px - content padding */
}
```

#### Reusable Component Patterns

**Status Badge:**

```svelte
<span class="status-badge status-{variant}">
	{label}
</span>

<style>
	.status-badge {
		display: inline-flex;
		padding: var(--space-1) var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		font-weight: 600;
		border-radius: var(--radius-full);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.status-active {
		background: var(--ok);
		color: var(--bg);
	}
	.status-disabled {
		background: var(--muted);
		color: var(--bg);
	}
	.status-error {
		background: var(--err);
		color: var(--bg);
	}
</style>
```

**Metric Card:**

```svelte
<div class="metric-card">
	<div class="metric-value">{value}</div>
	<div class="metric-label">{label}</div>
</div>

<style>
	.metric-card {
		background: var(--surface-primary-98);
		border: 1px solid var(--primary-glow-15);
		border-radius: var(--radius-sm);
		padding: var(--space-4);
		text-align: center;
	}

	.metric-value {
		font-size: var(--font-size-4);
		font-weight: 600;
		color: var(--primary);
		font-family: var(--font-mono);
	}

	.metric-label {
		font-size: var(--font-size-0);
		color: var(--muted);
		text-transform: uppercase;
		margin-top: var(--space-1);
	}
</style>
```

**Info Box:**

```svelte
<div class="info-box info-box-{variant}">
	<div class="info-icon">{icon}</div>
	<div class="info-content"><slot /></div>
</div>

<style>
	.info-box {
		display: flex;
		gap: var(--space-3);
		padding: var(--space-3);
		border-left: 3px solid;
		border-radius: var(--radius-xs);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.5;
	}

	.info-box-info {
		background: color-mix(in oklab, var(--info) 15%, var(--surface));
		border-color: var(--info);
		color: var(--text);
	}

	.info-box-warning {
		background: color-mix(in oklab, var(--warn) 15%, var(--surface));
		border-color: var(--warn);
		color: var(--text);
	}

	.info-box-error {
		background: var(--err-dim);
		border-color: var(--err);
		color: var(--text);
	}
</style>
```

**Empty State:**

```svelte
<div class="empty-state">
	<div class="empty-state-icon">{icon}</div>
	<h3 class="empty-state-title">{title}</h3>
	<p class="empty-state-message">{message}</p>
	{#if action}
		<Button onclick={action.handler}>{action.label}</Button>
	{/if}
</div>

<style>
	.empty-state {
		text-align: center;
		padding: var(--space-7);
		background: var(--surface-primary-98);
		border: 1px dashed var(--line);
		border-radius: var(--radius-sm);
	}

	.empty-state-icon {
		font-size: 48px;
		opacity: 0.5;
		margin-bottom: var(--space-4);
		color: var(--primary);
	}

	.empty-state-title {
		font-size: var(--font-size-3);
		color: var(--text);
		margin: 0 0 var(--space-2) 0;
	}

	.empty-state-message {
		font-size: var(--font-size-1);
		color: var(--muted);
		margin: 0 0 var(--space-5) 0;
		line-height: 1.6;
	}
</style>
```

#### Button Hierarchy

**Visual Differentiation:**

```css
/* Primary - main actions */
.button-primary {
	background: var(--primary);
	color: var(--bg);
	font-weight: 600;
	box-shadow: 0 0 12px var(--primary-glow-25);
}

/* Secondary - common actions */
.button-secondary {
	background: transparent;
	border: 1px solid var(--line);
	color: var(--text);
}

/* Danger - destructive actions */
.button-danger {
	background: var(--err);
	color: var(--bg);
	font-weight: 600;
	box-shadow: 0 0 8px color-mix(in oklab, var(--err) 30%, transparent);
}

/* Ghost - tertiary actions */
.button-ghost {
	background: transparent;
	color: var(--muted);
	border: none;
}
```

#### Form Field Grouping

**FormSection Component Pattern:**

```svelte
<section class="form-section">
	<header class="form-section-header">
		<h4>{title}</h4>
		{#if description}
			<p class="form-section-description">{description}</p>
		{/if}
	</header>
	<div class="form-section-content">
		<slot />
	</div>
</section>

<style>
	.form-section {
		background: var(--surface-primary-98);
		border: 1px solid var(--primary-glow-15);
		border-radius: var(--radius-sm);
		padding: var(--space-4);
		margin-bottom: var(--space-5);
	}

	.form-section-header {
		margin-bottom: var(--space-4);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--line);
	}

	.form-section-header h4 {
		font-size: var(--font-size-2);
		font-weight: 600;
		color: var(--text);
		margin: 0 0 var(--space-2) 0;
	}

	.form-section-description {
		font-size: var(--font-size-1);
		color: var(--muted);
		margin: 0;
		line-height: 1.5;
	}

	.form-section-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
</style>
```

#### Color Usage Guidelines

**Reserve Primary Color For:**

- Active states
- Primary action buttons
- Focus indicators
- Important headings (H2 level)
- Status: Active/Enabled
- **Avoid:** Regular text, all borders, every icon

**Use Semantic Colors:**

```css
.status-active {
	color: var(--ok);
}
.status-warning {
	color: var(--warn);
}
.status-error {
	color: var(--err);
}
.status-info {
	color: var(--info);
}
```

**Background Hierarchy:**

- Base: `--bg` for page background
- Surface: `--surface` for cards/panels
- Elevated: `--elev` for hover states
- Accent tint: `--surface-primary-98` for subtle emphasis (use sparingly)

**Border Color System:**

- Default borders: `--line` (25% opacity)
- Emphasis borders: `--line-strong` (35% opacity)
- Accent borders: `--primary-glow-15` (only for special emphasis)

### Visual Effects Guidelines

**Glow Effect Usage:**

- **Use glow on:**
  - Page title (H1)
  - Primary action buttons
  - Active state indicators
  - Focus rings (accessibility requirement)
- **Avoid glow on:**
  - Regular headings (H3, H4)
  - Static borders
  - Every element with primary color

**Transition Standards:**

```css
/* Fast: UI feedback */
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);

/* Medium: Component states */
--transition-medium: 250ms cubic-bezier(0.4, 0, 0.2, 1);

/* Slow: Layout changes */
--transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);
```

**Hover State Patterns:**

```css
.interactive-element {
	transition: background var(--transition-fast);
}

.interactive-element:hover {
	background: var(--elev);
}

.button:hover {
	transform: translateY(-1px);
	box-shadow: 0 2px 8px var(--primary-glow-25);
}
```

### Accessibility Standards

**Color Contrast:**

- Body text: Minimum 4.5:1 (WCAG AA)
- Large text: Minimum 3:1 (WCAG AA)
- UI components: Minimum 3:1 (WCAG AA)

**Touch Targets:**

- All interactive elements: Minimum 44×44px
- Mobile specific: Ensure buttons meet size on screens ≤800px

**Focus Indicators:**

```css
:focus-visible {
	outline: 2px solid var(--primary);
	outline-offset: 2px;
	box-shadow: 0 0 0 4px var(--primary-glow-25);
}
```

**Reduced Motion:**

```css
@media (prefers-reduced-motion: reduce) {
	* {
		animation-duration: 0.01ms !important;
		animation-iteration-count: 1 !important;
		transition-duration: 0.01ms !important;
	}
}
```

## Related Documentation

- **CSS Guidelines**: `docs/contributing/css-guidelines.md`
- **Settings Migration**: `docs/reference/settings-migration.md`
- **MVVM Patterns**: `src/docs/architecture/mvvm-patterns.md`
- **Settings Review** (2025-10-08): Archived in root directory

## References

- **Visual Design Settings Review** (2025-10-08): Identified inconsistencies and recommended improvements
- **CSS Quality Review** (2025-10-08): Found 15+ duplicate patterns, 350-400 lines can be eliminated
- **Remaining Visual Issues** (2025-10-07): 24 issues fixed, 8.5/10 quality rating achieved
