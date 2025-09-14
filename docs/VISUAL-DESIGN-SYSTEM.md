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
--bg: #0c1210
--surface: #121a17
--text: #d9ffe6
--muted: #92b3a4

/* Accent colors */
--accent: #2ee66b
--primary: #2ee66b
--primary-dim: #1ea851

/* Status colors */
--ok: #26d07c
--warn: #ffb703
--err: #ef476f
--info: #00c2ff

/* Spacing */
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 24px
```

### 6. **Typography**

**Font Families:**
- **Headings/Labels:** `var(--font-mono)` (Share Tech Mono)
- **Body text:** `var(--font-sans)` (Exo 2)  
- **Accent:** `var(--font-accent)` (Protest Revolution)

**Font Sizes:**
```css
--font-size-0: 12px  /* Small text, badges */
--font-size-1: 14px  /* Body text, labels */  
--font-size-2: 16px  /* Default text */
--font-size-3: 18px  /* Subheadings */
--font-size-4: 22px  /* Headings */
--font-size-5: 28px  /* Large headings */
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

## Migration Checklist

When updating existing components:

- [ ] Replace custom modal implementations with shared `Modal.svelte`
- [ ] Replace custom buttons with shared `Button.svelte`
- [ ] Remove excessive augmented-ui usage (keep only strategic applications)
- [ ] Use design system color variables instead of hardcoded colors
- [ ] Use design system spacing variables (`--space-*`)
- [ ] Ensure consistent typography with font family variables
- [ ] Remove decorative gradients and excessive shadows
- [ ] Maintain clean panel/container styling patterns

## Key Achievements

✅ **Fixed Major Issues:**
1. **Modal Standardization:** All modals now use shared `Modal.svelte` component
2. **Augmented-UI Cleanup:** Removed excessive decorative usage in ProjectSessionMenuSimplified
3. **Button Consistency:** Standardized button styling across all components
4. **Design System Compliance:** All components now follow consistent spacing, colors, typography

✅ **Before vs After:**
- **Before:** 7+ different augmented-ui elements in single component
- **After:** Strategic use of 1-2 augmented-ui elements maximum
- **Before:** 3 different modal implementations  
- **After:** Single shared Modal component with consistent styling
- **Before:** Inconsistent button patterns across components
- **After:** Standardized Button component usage everywhere

This design system ensures the Dispatch application maintains a professional, cohesive appearance while preserving its retro terminal aesthetic.