# Settings Component Library - Quick Reference

**🚀 Quick Start:** Import components and start building consistent settings UI

---

## Import Components

```svelte
<script>
  import StatusBadge from '$lib/client/shared/components/StatusBadge.svelte';
  import MetricCard from '$lib/client/shared/components/MetricCard.svelte';
  import InfoBox from '$lib/client/shared/components/InfoBox.svelte';
  import SettingsFormSection from '$lib/client/shared/components/SettingsFormSection.svelte';
  import EmptyState from '$lib/client/shared/components/EmptyState.svelte';
</script>
```

---

## Quick Examples

### Status Badge
```svelte
<StatusBadge variant="active">Running</StatusBadge>
<StatusBadge variant="error">Failed</StatusBadge>
<StatusBadge variant="warning">Pending</StatusBadge>
```

### Metric Card
```svelte
<MetricCard value="1.2 MB" label="Storage" />

<!-- Grid layout -->
<div class="metric-grid">
  <MetricCard value="12" label="Total" />
  <MetricCard value="8" label="Active" />
</div>
```

### Info Box
```svelte
<InfoBox variant="info">
  This setting requires a restart.
</InfoBox>

<InfoBox variant="warning" title="Important">
  API keys are stored locally.
</InfoBox>
```

### Settings Section
```svelte
<SettingsFormSection
  title="Authentication"
  subtitle="Configure API access"
>
  <!-- form fields here -->
</SettingsFormSection>
```

### Empty State
```svelte
<EmptyState
  icon="📦"
  message="No items found"
>
  <Button>Add Item</Button>
</EmptyState>
```

---

## CSS Classes (No Import Needed)

### Structure
```html
<header class="settings-section-header">
  <h3 class="settings-section-header__title">Title</h3>
  <p class="settings-section-header__description">Description</p>
</header>
```

### Form Elements
```html
<div class="form-group">
  <label class="form-label form-label--required">Name</label>
  <input type="text" />
  <span class="form-description">Helper text</span>
</div>
```

### Dividers
```html
<div class="settings-divider"></div>
<div class="settings-divider-strong"></div>
```

### Footer
```html
<div class="settings-footer">
  <div class="settings-footer__status settings-footer__status--success">
    Saved!
  </div>
  <div class="settings-footer__actions">
    <Button>Reset</Button>
    <Button variant="primary">Save</Button>
  </div>
</div>
```

### Spacing
```html
<div class="settings-spacing-md">Content</div>
<!-- Options: -sm (12px), -md (16px), -lg (24px), -xl (32px) -->
```

---

## Design Tokens

### Typography
```css
--font-size-0: 12px;  /* Helper text */
--font-size-1: 14px;  /* Body text */
--font-size-2: 16px;  /* Emphasized */
--font-size-3: 18px;  /* H3 headings */
--font-size-4: 22px;  /* H2 headings */
--font-size-5: 28px;  /* Page titles */
```

### Spacing
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

### Colors
```css
--text         /* Primary text */
--muted        /* Secondary text */
--primary      /* Brand color */
--ok           /* Success green */
--warn         /* Warning yellow */
--err          /* Error red */
--info         /* Info blue */
--line         /* Border color */
```

### Transitions
```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-medium: 250ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);
```

---

## Common Patterns

### Settings Page Layout
```svelte
<SettingsFormSection title="Section 1" variant="card">
  <div class="form-group">
    <label class="form-label">Field</label>
    <Input />
  </div>
</SettingsFormSection>

<div class="settings-divider"></div>

<SettingsFormSection title="Section 2">
  <!-- content -->
</SettingsFormSection>

<div class="settings-footer">
  <div class="settings-footer__status settings-footer__status--success">
    Changes saved
  </div>
  <div class="settings-footer__actions">
    <Button variant="ghost">Reset</Button>
    <Button variant="primary">Save</Button>
  </div>
</div>
```

### Metrics Dashboard
```svelte
<div class="metric-grid">
  <MetricCard value={sessionCount} label="Sessions" />
  <MetricCard value={storageUsed} label="Storage" />
  <MetricCard value={activeUsers} label="Users" />
</div>

<InfoBox variant="info">
  Metrics update every 5 minutes.
</InfoBox>
```

### Status Display
```svelte
<div class="flex items-center gap-2">
  <span>Server:</span>
  <StatusBadge variant={status}>
    {status === 'active' ? 'Running' : 'Stopped'}
  </StatusBadge>
</div>
```

### Empty State with Action
```svelte
{#if items.length === 0}
  <EmptyState
    icon="📋"
    title="No Items"
    message="Get started by creating your first item"
  >
    <Button variant="primary" onclick={createItem}>
      Create Item
    </Button>
  </EmptyState>
{:else}
  <!-- item list -->
{/if}
```

---

## Variants Reference

### StatusBadge
- `default` - Gray
- `active` / `enabled` - Green
- `inactive` / `disabled` - Gray
- `error` / `failed` - Red
- `warning` - Yellow
- `success` - Green
- `info` - Blue

### InfoBox
- `info` - Blue accent
- `warning` - Yellow accent
- `error` - Red accent
- `success` - Green accent

### SettingsFormSection
- `default` - Standard surface
- `elevated` - Darker background
- `card` - Primary glow border

---

## Migration Checklist

### Replacing Old Patterns

**Before:**
```svelte
<style>
  .section-title {
    font-family: var(--font-mono);
    text-transform: uppercase;
    /* ... */
  }
</style>

<h2 class="section-title">Title</h2>
```

**After:**
```svelte
<h2 class="settings-section-title">Title</h2>
```

---

**Before:**
```svelte
<style>
  .status {
    display: inline-flex;
    padding: 4px 12px;
    /* ... */
  }
</style>

<span class="status">Active</span>
```

**After:**
```svelte
<StatusBadge variant="active">Active</StatusBadge>
```

---

## 📚 Full Documentation

See `/src/lib/client/shared/components/SETTINGS-COMPONENTS.md` for:
- Complete API reference
- Advanced usage examples
- Migration guide
- Testing strategies
- Future roadmap

---

## ⚡ Tips

1. **Use CSS classes** for simple markup, **components** for complex patterns
2. **Always use design tokens** - no hardcoded colors or sizes
3. **Prefer metric-grid** over custom flexbox for metric layouts
4. **Use SettingsFormSection** to group related settings
5. **InfoBox for guidance**, not errors (use validation for errors)
