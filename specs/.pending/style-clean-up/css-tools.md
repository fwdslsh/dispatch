Here are 5 highly valuable CSS refactoring tools that would complement your existing scripts:

1. Duplicate CSS Detector 🔍

Purpose: Find duplicate or near-duplicate CSS rules across files

What it would do:

- Detect exact duplicates (same properties and values)
- Find near-duplicates (same properties, different values)
- Identify repeated patterns (e.g., same layout patterns in multiple files)
- Suggest where to extract utilities or create shared components
- Calculate duplication percentage across the codebase

Example output:

## Exact Duplicates (12 instances)

### Pattern: Flexbox Center

````css
display: flex;
align-items: center;
justify-content: center;
Found in:
- src/lib/client/shared/styles/components/buttons.css (lines 45-47)
- src/lib/client/shared/styles/components/modal.css (lines 23-25)
- src/lib/client/claude/ClaudePane.svelte (lines 102-104)

Suggestion: Create utility class .flex-center

Near Duplicates (23 instances)

Pattern: Card Container (85% similar)

Variations across 8 files:
- 5 use border-radius: 8px, 3 use border-radius: 12px
- All use same padding pattern
Suggestion: Standardize with --card-radius variable

**Value:** Immediately identifies low-hanging fruit for consolidation

---

## 2. **Component Style Analyzer** 📊
**Purpose:** Analyze Svelte component style architecture

**What it would do:**
- Show which components use **scoped `<style>` blocks** vs **external CSS**
- Identify **single-use CSS rules** that should be in components
- Calculate **percentage of scoped styles** across the app
- Flag components with **mixed approaches** (both scoped + external)
- Find **candidates for migration** to component styles

**Example output:**
```markdown
## Architecture Overview

- Total Components: 185
- Using Scoped Styles: 142 (76.8%)
- Using External CSS Only: 28 (15.1%)
- Mixed (Both): 15 (8.1%) ⚠

## Mixed Approach Components (Should Be Refactored)

### ClaudePane.svelte
- Has scoped styles: 45 lines
- Also uses external CSS: src/lib/client/shared/styles/components/claude.css
- **Recommendation:** Move claude.css rules into component

## Single-Component CSS Files

These CSS files are only used by one component and should be moved:

### src/lib/client/shared/styles/components/status-bar.css
- Only used by: StatusBar.svelte
- 34 lines
- **Action:** Move to `<style>` block in StatusBar.svelte

Value: Guides architectural decisions about where styles should live

---
3. CSS Complexity Analyzer 📈

Purpose: Measure and report CSS complexity metrics

What it would do:
- Calculate specificity scores for all selectors
- Measure nesting depth
- Identify overly complex selectors
- Report file size and rule count metrics
- Flag performance issues (e.g., universal selectors, attribute selectors)
- Score maintainability per file

Example output:
## Complexity Report

### High Complexity Files (Needs Refactoring)

#### src/lib/client/shared/styles/window-manager.css
- **Complexity Score:** 8.5/10 (HIGH) ⚠
- **Average Specificity:** 0,3,4
- **Max Nesting Depth:** 6 levels (recommended: 3)
- **Complex Selectors:** 12
- **File Size:** 450 lines

**Problem Selectors:**
- `.wm-container .wm-pane .wm-tile-group .tile.active > .content` (specificity: 0,5,0)
- `div.panel:not(.collapsed) .header:hover::before` (specificity: 0,4,1)

**Recommendations:**
1. Use BEM naming to reduce nesting
2. Replace descendant selectors with direct classes
3. Split into smaller, focused files

### Comparison

| File | Complexity | Specificity | Nesting | Rules |
|------|-----------|-------------|---------|-------|
| utilities.css | 2.1 (LOW) ✅ | 0,1,0 | 1 | 88 |
| window-manager.css | 8.5 (HIGH) ⚠ | 0,3,4 | 6 | 156 |
| retro.css | 5.2 (MEDIUM) | 0,2,1 | 4 | 203 |

Value: Provides objective metrics to prioritize refactoring efforts

---
4. Color & Token Audit 🎨

Purpose: Find hardcoded values that should use CSS variables

What it would do:
- Find hardcoded colors (hex, rgb, hsl, named)
- Find hardcoded spacing values (px, rem, em)
- Find hardcoded sizes and other magic numbers
- Suggest which CSS variable to use instead
- Calculate tokenization percentage
- Generate migration snippets

Example output:
## Hardcoded Values Report

### Summary
- Hardcoded Colors: 67 instances
- Hardcoded Spacing: 89 instances
- Hardcoded Sizes: 45 instances
- **Tokenization Score: 72.3%** (Target: 95%+)

### Hardcoded Colors (Should Use Variables)

#### #2ee66b (Found 12 times)
**Should use:** `var(--primary)`

**Locations:**
- src/lib/client/claude/ClaudePane.svelte:45
  ```css
  border-color: #2ee66b; /* Should be: var(--primary) */
- src/lib/client/shared/components/Button.svelte:78
background: #2ee66b; /* Should be: var(--primary) */

rgba(46, 230, 107, 0.2) (Found 8 times)

Should use: var(--primary-glow-20)

Hardcoded Spacing

12px (Found 34 times)

Inconsistent with design system!
- Should use: var(--space-3) (24 instances)
- Or use: var(--space-2) if 8px was intended (10 instances seem to be typos)

Quick fix examples:
/* Before */
margin: 12px;
padding: 12px 12px;

/* After */
margin: var(--space-3);
padding: var(--space-3);

Auto-Migration Script

Generated migration commands:
# Replace #2ee66b with var(--primary)
find src -name "*.svelte" -o -name "*.css" | xargs sed -i 's/#2ee66b/var(--primary)/g'

**Value:** Makes it easy to identify and fix design system inconsistencies

---

## 5. **Style Migration Helper** 🚀
**Purpose:** Assist with moving external CSS into Svelte components

**What it would do:**
- Identify **external CSS rules used by only one component**
- Generate **ready-to-use `<style>` blocks** for components
- Create **migration checklist** with file-by-file instructions
- **Validate** that styles work after migration
- Suggest **optimal organization** (scoped vs external)

**Example output:**
```markdown
## Migration Plan

### Phase 1: Easy Wins (Single-Component CSS)

#### StatusBar.svelte
**Current:** Uses src/lib/client/shared/styles/components/status-bar.css

**Action Required:**
1. Add `<style>` block to StatusBar.svelte
2. Copy the generated CSS below
3. Delete status-bar.css
4. Remove import from index.css

**Generated Scoped Styles:**
```svelte
<style>
  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2);
    background: var(--surface);
    border-top: 1px solid var(--surface-border);
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-0);
    color: var(--text-muted);
  }

  /* ... 8 more rules ... */
</style>

Testing:
- Visual regression test
- Verify no unused CSS warnings
- Check mobile layout

---
Phase 2: Shared Components (Multiple Users)

buttons.css (Used by 80 components)

Strategy: Keep as external, but reorganize

Current Issues:
- Mixed component-specific and utility classes
- Some rules only used by 1-2 components

Recommended Split:
✅ Keep in buttons.css (widely used):
- .btn-icon-only (80 uses)
- .spinner (65 uses)

❌ Move to component styles (limited use):
- .clone-btn (2 uses) → Move to GitOperations.svelte
- .cancel-btn (3 uses) → Move to Modal.svelte

---
Migration Checklist

StatusBar.svelte
- Generate scoped styles
- Copy to component
- Remove external CSS file
- Test visually
- Run npm run css:map to verify

TypeCard.svelte
- Generate scoped styles
- Copy to component
- Remove external CSS file
- Test visually
- Run npm run css:map to verify

... 12 more components

**Value:** Provides actionable migration plan with ready-to-paste code

---

## Priority Recommendation:

**Start with these in order:**

1. **Component Style Analyzer** - Understand current architecture
2. **Duplicate CSS Detector** - Find quick wins for consolidation
3. **Color & Token Audit** - Improve design system consistency
4. **CSS Complexity Analyzer** - Identify problem areas
5. **Style Migration Helper** - Execute the refactoring

Each tool builds on insights from the previous ones, creating a comprehensive refactoring workflow.
````
