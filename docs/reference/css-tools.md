# CSS Refactoring Tools

A comprehensive suite of tools for analyzing, maintaining, and refactoring CSS in the Dispatch SvelteKit application.

## Overview

The CSS refactoring toolkit provides **8 specialized tools** that help you understand, analyze, and improve the CSS architecture. These tools work together to identify issues, suggest improvements, and guide refactoring efforts.

### Tool Categories

**Analysis Tools** - Understand current state:
1. CSS Usage Mapper
2. CSS Variables Mapper
3. Component Style Analyzer
4. CSS Complexity Analyzer
5. Duplicate CSS Detector
6. Color & Token Audit

**Maintenance Tools** - Clean up and refactor:
7. CSS Cleaner
8. Style Migration Helper

---

## Tool Reference

### 1. CSS Usage Mapper

**Purpose:** Map CSS files to the Svelte components that use them.

**What it does:**
- Scans all CSS files and identifies which components use classes from each file
- Shows usage statistics (how many components use each CSS file)
- Identifies unused CSS files
- Groups components by CSS file

**Usage:**
```bash
# Generate full usage map
npm run css:map

# Include detailed class-level breakdown
npm run css:map:verbose
```

**Output:** `CSS_USAGE_MAP.md`

**When to use:**
- Understanding CSS dependencies before refactoring
- Identifying which components will be affected by CSS changes
- Finding unused CSS files
- Planning component-specific CSS extraction

**Example output:**
```markdown
## src/lib/client/shared/styles/components/buttons.css

**Classes:** 12 total, 12 used, 0 unused

**Used by 80 file(s):**
- src/lib/client/claude/ClaudeHeader.svelte
- src/lib/client/settings/GlobalSettings.svelte
- ...
```

---

### 2. CSS Variables Mapper

**Purpose:** Track CSS custom property (variable) definitions and usage.

**What it does:**
- Finds all CSS variable definitions (`--variable-name`)
- Identifies which files use each variable
- Calculates usage statistics
- Highlights unused variables

**Usage:**
```bash
# Generate full variable map
npm run css:vars

# Include usage location details
npm run css:vars:verbose

# Show only unused variables
npm run css:vars:unused
```

**Output:** `CSS_VARIABLES_MAP.md`

**When to use:**
- Before removing or renaming CSS variables
- Finding unused variables to clean up
- Understanding variable dependencies
- Planning design token consolidation

**Example output:**
```markdown
### ⚠️ Unused Variables

- `--font-weight-bold`: 700
- `--primary-gradient`: linear-gradient(135deg, #2ee66b, #4eff82)

### Used Variables

- `--space-2`: 8px — used in 52 file(s)
- `--primary`: #2ee66b — used in 46 file(s)
```

**Key metrics:**
- **Current codebase:** 122 variables, 98 used (80.3%), 24 unused (19.7%)

---

### 3. Component Style Analyzer

**Purpose:** Analyze how components use styles (scoped vs external CSS).

**What it does:**
- Categorizes components by style approach:
  - Scoped-only (using `<style>` blocks)
  - External-only (using CSS files)
  - Mixed (using both - architectural inconsistency)
  - No styles
- Identifies single-component CSS files (candidates for migration)
- Calculates architecture percentages

**Usage:**
```bash
# Standard analysis
npm run css:analyze-components

# Detailed breakdown
npm run css:analyze-components:verbose
```

**Output:** `COMPONENT_STYLES_REPORT.md`

**When to use:**
- Planning component style architecture
- Identifying architectural inconsistencies
- Finding components that should be refactored
- Understanding overall styling patterns

**Example output:**
```markdown
## Architecture Overview

- Total Components: 185
- Using Scoped Styles: 142 (76.8%)
- Using External CSS Only: 28 (15.1%)
- Mixed (Both): 15 (8.1%) ⚠️

## Mixed Approach Components (Should Be Refactored)

### ClaudePane.svelte
- Has scoped styles: 45 lines
- Also uses external CSS: claude.css
- **Recommendation:** Choose one approach
```

**Key metrics:**
- **Current codebase:** 40.5% mixed approach (needs standardization)

---

### 4. CSS Complexity Analyzer

**Purpose:** Measure CSS complexity and identify problem areas.

**What it does:**
- Calculates CSS specificity scores (a,b,c format)
- Measures selector nesting depth
- Generates overall complexity score (1-10 scale)
- Identifies performance issues:
  - Universal selectors
  - High specificity selectors
  - Deep nesting (>4 levels)
  - Qualified class selectors

**Usage:**
```bash
# Standard threshold (7/10)
npm run css:complexity

# Strict threshold (5/10)
npm run css:complexity:strict
```

**Output:** `CSS_COMPLEXITY_REPORT.md`

**When to use:**
- Prioritizing which CSS files to refactor
- Identifying overly complex selectors
- Finding performance bottlenecks
- Setting refactoring goals

**Example output:**
```markdown
## High Complexity Files

### buttons.css
- **Complexity Score:** 7.5/10 (HIGH) ⚠️
- **Average Specificity:** 0,2,3
- **Max Nesting Depth:** 5 levels

**Problem Selectors:**
- `.btn-icon-only:hover:not(:disabled)` (specificity: 0,3,1)

**Recommendations:**
1. Reduce nesting depth
2. Use BEM naming to lower specificity
```

**Complexity formula:**
```
(avg_specificity / 10 * 2) + (max_nesting / 4 * 1.5) + (problem_selectors / total * 10 * 0.5)
```

**Key metrics:**
- **Current codebase:** Average 3.16/10 (Good!), 2 high-complexity files

---

### 5. Duplicate CSS Detector

**Purpose:** Find duplicate and near-duplicate CSS patterns.

**What it does:**
- Detects exact duplicate CSS rule blocks
- Finds near-duplicates (configurable similarity threshold)
- Identifies common patterns (flexbox, positioning, transitions)
- Calculates duplication percentage
- Suggests utility classes or shared patterns

**Usage:**
```bash
# Standard analysis (80% similarity)
npm run css:duplicates

# Strict mode (95% similarity)
npm run css:duplicates:strict

# Custom threshold
node scripts/detect-duplicate-css.js --threshold 70
```

**Output:** `CSS_DUPLICATES_REPORT.md`

**When to use:**
- Finding opportunities to consolidate CSS
- Creating utility classes
- Reducing codebase size
- Improving consistency

**Example output:**
```markdown
## Exact Duplicates

### Pattern: Flexbox Center (48 occurrences)
```css
display: flex;
align-items: center;
justify-content: center;
```

**Found in:**
- buttons.css (lines 45-47)
- modal.css (lines 23-25)

**Suggestion:** Create utility class `.flex-center`

## Duplication Score: 16.6%
```

**Key metrics:**
- **Current codebase:** 16.6% duplication, 234 duplicate groups, 652 instances

---

### 6. Color & Token Audit

**Purpose:** Find hardcoded values that should use CSS variables.

**What it does:**
- Detects hardcoded colors (hex, rgb, hsl, named)
- Detects hardcoded spacing values (px, rem, em)
- Detects hardcoded sizes
- Maps values to existing CSS variables
- Calculates tokenization score
- Generates auto-migration sed snippets

**Usage:**
```bash
# Standard audit
npm run css:tokens

# Detailed locations
npm run css:tokens:verbose
```

**Output:** `CSS_TOKENS_REPORT.md`

**When to use:**
- Improving design system consistency
- Finding values to convert to variables
- Planning design token migration
- Measuring design system adoption

**Example output:**
```markdown
## Tokenization Score: 55.2% (Fair)

### Hardcoded Colors (578 instances)

#### #2ee66b (Found 12 times)
**Should use:** `var(--primary)`

**Locations:**
- ClaudePane.svelte:45
  ```css
  border-color: #2ee66b; /* Should be: var(--primary) */
  ```

### Auto-Migration Script
```bash
# Replace #2ee66b with var(--primary)
find src -name "*.svelte" -o -name "*.css" | \
  xargs sed -i 's/#2ee66b/var(--primary)/g'
```
```

**Tokenization score formula:**
```
(var() usages / total value usages) * 100
```

**Key metrics:**
- **Current codebase:** 55.2% tokenization, 1,859 hardcoded values

---

### 7. CSS Cleaner

**Purpose:** Remove unused CSS rules from the codebase.

**What it does:**
- Scans all CSS files for class selectors
- Searches all Svelte files for class usage
- Identifies unused CSS rules
- Removes unused rules (with backup option)

**Usage:**
```bash
# Preview what will be removed (recommended first)
npm run css:clean:dry-run

# Remove with backups (.backup files)
npm run css:clean:backup

# Remove without backups (use with caution)
npm run css:clean

# Custom directories
node scripts/remove-unused-css.js --css-dir src/styles --svelte-dir src/lib
```

**Output:** Modified CSS files, summary report

**When to use:**
- After major refactoring
- Regular codebase cleanup
- Before releases
- Reducing bundle size

**Example output:**
```
📄 utilities.css
   Kept: 88 rules
   Removed: 74 rules

📊 Summary
Total rules kept: 474
Total rules removed: 128
Files modified: 5
```

**Safety features:**
- Dry-run mode (preview changes)
- Backup mode (creates .backup files)
- Verbose mode (shows all removed selectors)

**Key metrics:**
- **Current codebase:** Can remove 128 unused rules (21% reduction)

---

### 8. Style Migration Helper

**Purpose:** Assist with moving external CSS into Svelte component styles.

**What it does:**
- Identifies external CSS used by single components
- Generates ready-to-paste `<style>` blocks
- Creates migration plan organized by complexity
- Provides step-by-step instructions
- Includes testing checklists

**Usage:**
```bash
# Generate full migration plan
npm run css:migrate

# Generate plan for specific component
npm run css:migrate:component WorkspaceStatusBar
```

**Output:** `STYLE_MIGRATION_PLAN.md`

**When to use:**
- Migrating to component-scoped styles
- Improving component encapsulation
- Planning large-scale CSS refactoring
- Understanding migration impact

**Example output:**
```markdown
## Phase 1: Easy Wins (Single-Component CSS)

### StatusBar.svelte
**Current:** Uses status-bar.css

**Generated Scoped Styles:**
```svelte
<style>
  .status-bar {
    display: flex;
    align-items: center;
    padding: var(--space-2);
  }
</style>
```

**Testing:**
- [ ] Visual regression test
- [ ] Verify responsive layout
```

**Migration phases:**
- Phase 1: Single-component CSS (easiest)
- Phase 2: 2-5 components (moderate)
- Phase 3: 6+ components (complex)

---

## Recommended Workflows

### Workflow 1: Initial Analysis (New to the codebase)

**Goal:** Understand current CSS architecture

```bash
# 1. See component-CSS relationships
npm run css:map

# 2. Understand styling architecture
npm run css:analyze-components

# 3. Check complexity
npm run css:complexity

# 4. Review variable usage
npm run css:vars
```

**Review the generated reports to understand:**
- Which CSS files are most widely used
- Which components use scoped vs external styles
- Which files are most complex
- How CSS variables are used

---

### Workflow 2: Regular Maintenance (Monthly/Quarterly)

**Goal:** Keep CSS clean and maintainable

```bash
# 1. Check for unused rules
npm run css:clean:dry-run

# 2. If safe, remove unused CSS
npm run css:clean:backup

# 3. Check for unused variables
npm run css:vars:unused

# 4. Manually remove unused variables from variables.css and retro.css
```

**Benefits:**
- Smaller bundle size
- Faster builds
- Easier to navigate CSS
- Reduced maintenance burden

---

### Workflow 3: Design System Improvement

**Goal:** Improve consistency with design tokens

```bash
# 1. Audit current tokenization
npm run css:tokens

# 2. Review hardcoded values in CSS_TOKENS_REPORT.md

# 3. Replace common values with variables
# Use the auto-migration snippets from the report

# 4. Re-run to measure improvement
npm run css:tokens
```

**Target:** 95%+ tokenization score

**Example migration:**
```bash
# Before: 55.2% tokenization
npm run css:tokens

# Replace hardcoded values using report suggestions
# (manually or using sed snippets)

# After: Check improvement
npm run css:tokens
# Goal: 95%+ tokenization
```

---

### Workflow 4: Reducing Duplication

**Goal:** Consolidate duplicate CSS patterns

```bash
# 1. Find duplicates
npm run css:duplicates

# 2. Review CSS_DUPLICATES_REPORT.md
# Focus on "exact duplicates" section

# 3. Create utility classes for common patterns
# Example: .flex-center, .card-base, .text-truncate

# 4. Replace duplicates with utility classes

# 5. Re-run to measure improvement
npm run css:duplicates
```

**Target:** <10% duplication

**Common patterns to extract:**
- Flexbox layouts (`.flex-center`, `.flex-column`, `.flex-row`)
- Positioning (`.absolute-center`, `.fixed-top`)
- Text utilities (`.text-truncate`, `.text-wrap`)
- Card patterns (`.card-elevated`, `.card-flat`)

---

### Workflow 5: Component Style Migration

**Goal:** Move external CSS to component scoped styles

```bash
# 1. Analyze current architecture
npm run css:analyze-components

# 2. Generate migration plan
npm run css:migrate

# 3. Start with Phase 1 (single-component CSS)
# Follow the step-by-step instructions in STYLE_MIGRATION_PLAN.md

# 4. For specific component
npm run css:migrate:component ComponentName

# 5. Verify no unused CSS after migration
npm run css:clean:dry-run
```

**When to use:**
- Moving to component-based architecture
- Improving encapsulation
- Making components more portable

**Best practices:**
- Start with single-component CSS (lowest risk)
- Test thoroughly after each migration
- Use git branches for safety
- Run `css:map` to verify changes

---

### Workflow 6: Complexity Reduction

**Goal:** Simplify complex CSS files

```bash
# 1. Identify complex files
npm run css:complexity

# 2. Review CSS_COMPLEXITY_REPORT.md
# Focus on files with score >7

# 3. For each high-complexity file:
#    - Reduce nesting depth
#    - Lower specificity
#    - Split into smaller files
#    - Use BEM naming

# 4. Re-run to verify improvement
npm run css:complexity
```

**Target:** All files <7/10 complexity

**Refactoring techniques:**
- Replace descendant selectors with BEM classes
- Reduce nesting (max 3-4 levels)
- Split large files into focused modules
- Avoid ID selectors
- Use composition over specificity

---

### Workflow 7: Complete CSS Audit

**Goal:** Comprehensive codebase analysis

```bash
# Run all analysis tools
npm run css:map
npm run css:vars
npm run css:analyze-components
npm run css:complexity
npm run css:duplicates
npm run css:tokens

# Review all 6 reports to understand:
# - Architecture (css:analyze-components)
# - Quality (css:complexity, css:duplicates)
# - Consistency (css:tokens, css:vars)
# - Dependencies (css:map)
```

**When to use:**
- Before major refactoring
- Planning architecture changes
- Quarterly health checks
- Onboarding new developers

**Deliverables:**
- 6 comprehensive markdown reports
- Clear picture of CSS health
- Prioritized improvement areas

---

## Best Practices

### 1. Run Analysis Before Refactoring

**Always understand the current state before making changes:**

```bash
# Before refactoring buttons.css
npm run css:map              # See which components use it
npm run css:complexity       # Check its complexity score
npm run css:duplicates       # Find duplicate patterns
```

### 2. Use Dry-Run Mode First

**Preview changes before applying them:**

```bash
# ALWAYS run dry-run first
npm run css:clean:dry-run

# Review the output, then:
npm run css:clean:backup    # Safer with backups
```

### 3. Commit Before Major Changes

**Always have a rollback point:**

```bash
git add .
git commit -m "Before CSS refactoring"

# Now safe to run cleanup/migration
npm run css:clean:backup
```

### 4. Test After Changes

**Verify nothing broke:**

```bash
# After CSS changes
npm run build              # Check for errors
npm run dev                # Visual verification
npm run test:unit          # Run tests
```

### 5. Incremental Improvements

**Don't try to fix everything at once:**

```bash
# Bad: Try to fix all issues in one go
# Good: Focus on one improvement area

# Week 1: Remove unused CSS
npm run css:clean:backup

# Week 2: Consolidate duplicates
npm run css:duplicates

# Week 3: Improve tokenization
npm run css:tokens
```

### 6. Use Git Branches

**Isolate risky changes:**

```bash
git checkout -b refactor/reduce-css-duplication
npm run css:duplicates
# Make changes based on report
git commit -m "Reduce CSS duplication from 16% to 8%"
```

### 7. Regular Maintenance

**Make it part of your workflow:**

```bash
# Add to pre-release checklist:
- [ ] npm run css:clean:dry-run (remove unused)
- [ ] npm run css:duplicates (check duplication %)
- [ ] npm run css:complexity (verify no high scores)
```

---

## Common Scenarios

### Scenario 1: "Our CSS bundle is too large"

**Solution:**

```bash
# 1. Find unused CSS
npm run css:clean:dry-run
# Result: Can remove 128 rules (21%)

# 2. Find duplicates
npm run css:duplicates
# Result: 16.6% duplication, consolidate patterns

# 3. Clean up
npm run css:clean:backup

# 4. Measure improvement
# Check bundle size before/after
```

---

### Scenario 2: "I don't know where a CSS class is used"

**Solution:**

```bash
# Find all usages
npm run css:map:verbose

# Search in CSS_USAGE_MAP.md for your class name
# See which components use it
```

---

### Scenario 3: "Can I safely remove this CSS variable?"

**Solution:**

```bash
# Check variable usage
npm run css:vars:verbose

# Search in CSS_VARIABLES_MAP.md for variable name
# If "0 uses", safe to remove
```

---

### Scenario 4: "This CSS file is hard to maintain"

**Solution:**

```bash
# Check complexity
npm run css:complexity

# If score >7:
# - Reduce nesting
# - Lower specificity
# - Split into focused files
# - Use BEM naming

# Re-run to verify improvement
npm run css:complexity
```

---

### Scenario 5: "Should I use scoped styles or external CSS?"

**Solution:**

```bash
# See current architecture
npm run css:analyze-components

# Review COMPONENT_STYLES_REPORT.md

# Decision guide:
# - Component-specific? → Scoped styles
# - Shared utilities? → External CSS
# - Mixed? → Choose one approach
```

---

### Scenario 6: "I want to migrate to scoped styles"

**Solution:**

```bash
# Generate migration plan
npm run css:migrate

# Review STYLE_MIGRATION_PLAN.md
# Start with Phase 1 (easy wins)

# For specific component:
npm run css:migrate:component StatusBar
```

---

## Interpreting Reports

### CSS_USAGE_MAP.md

**Key sections:**
- **Summary** - Overview statistics
- **Per-file sections** - Components using each CSS file
- **Unused files** - CSS files not used anywhere

**What to look for:**
- CSS files used by many components (shared)
- CSS files used by one component (migration candidates)
- Unused CSS files (can be deleted)

---

### CSS_VARIABLES_MAP.md

**Key sections:**
- **Summary** - Usage statistics
- **Unused Variables** - Can be removed
- **Used Variables** - Sorted by usage count

**What to look for:**
- Variables with 0 uses (remove)
- Variables used only once (might not need to be variable)
- Most-used variables (core design tokens)

---

### COMPONENT_STYLES_REPORT.md

**Key sections:**
- **Architecture Overview** - Percentages by approach
- **Mixed Approach Components** - Architectural inconsistencies

**What to look for:**
- High % mixed approach (needs standardization)
- Single-component CSS files (migration candidates)
- Components without styles (expected for icon/layout components)

---

### CSS_COMPLEXITY_REPORT.md

**Key sections:**
- **Summary Table** - Compare all files
- **High Complexity Files** - Score >7
- **Problem Selectors** - Specific issues

**What to look for:**
- Files with score >7 (priority refactoring)
- High specificity selectors (simplify)
- Deep nesting >4 levels (flatten)

---

### CSS_DUPLICATES_REPORT.md

**Key sections:**
- **Summary** - Duplication percentage
- **Exact Duplicates** - Grouped patterns
- **Near Duplicates** - Similar rules

**What to look for:**
- Patterns appearing 10+ times (extract to utility)
- Near-duplicates (standardize)
- Duplication % >10% (consolidation needed)

---

### CSS_TOKENS_REPORT.md

**Key sections:**
- **Summary** - Tokenization score
- **Hardcoded Colors** - Grouped by value
- **Hardcoded Spacing** - Grouped by value
- **Auto-Migration Scripts** - sed snippets

**What to look for:**
- Tokenization score <80% (room for improvement)
- Common hardcoded values (convert to variables)
- Migration snippets (automate fixes)

---

## Metrics & Goals

### Target Metrics

| Metric | Current | Target | Tool |
|--------|---------|--------|------|
| **Duplication** | 16.6% | <10% | `css:duplicates` |
| **Tokenization** | 55.2% | >95% | `css:tokens` |
| **Complexity** | 3.16/10 avg | <5/10 all files | `css:complexity` |
| **Unused Variables** | 24 (19.7%) | 0 (0%) | `css:vars:unused` |
| **Mixed Architecture** | 40.5% | <10% | `css:analyze-components` |
| **Unused Rules** | 128 rules | 0 rules | `css:clean` |

### Measuring Progress

**Track improvements over time:**

```bash
# Baseline (run all tools, save reports)
npm run css:duplicates > baseline/duplicates.txt
npm run css:complexity > baseline/complexity.txt
npm run css:tokens > baseline/tokens.txt

# After refactoring
npm run css:duplicates > after/duplicates.txt
npm run css:complexity > after/complexity.txt
npm run css:tokens > after/tokens.txt

# Compare
diff baseline/duplicates.txt after/duplicates.txt
```

---

## Troubleshooting

### "Tool reports false positives"

**CSS Cleaner says class is unused but it's used:**

Likely cause: Dynamic class construction

```javascript
// Tool can't detect this:
const className = 'btn-' + type;  // btn-primary, btn-secondary

// Solution: Use explicit classes
<div class="btn-primary">  // Tool will detect this
```

---

### "Migration helper suggests wrong approach"

**Tool suggests migration but CSS should stay external:**

Review the migration plan but make your own decision based on:
- Is CSS truly component-specific?
- Is it shared across components?
- Does it belong in design system?

---

### "Complexity score seems wrong"

**File flagged as complex but seems fine:**

Check the specific issues:
- High specificity can inflate score even with low nesting
- Many small issues can accumulate to high score
- Review problem selectors for actual issues

---

### "Duplicate detector finds acceptable duplicates"

**Some duplication is intentional:**

Not all duplicates need fixing:
- Different contexts may need slightly different styles
- Use `--threshold` to adjust sensitivity
- Focus on exact duplicates first

---

## Integration with Development Workflow

### Pre-Commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
npm run css:clean:dry-run
# If sees removals, remind developer
```

### CI/CD Pipeline

Add to GitHub Actions:

```yaml
- name: CSS Quality Check
  run: |
    npm run css:complexity
    npm run css:duplicates
    # Fail if duplication >20% or complexity >8
```

### Code Review Checklist

When reviewing CSS changes:
- [ ] Run `css:map` - Understand impact
- [ ] Run `css:complexity` - Ensure not increasing complexity
- [ ] Run `css:duplicates` - Check if adding duplication
- [ ] Run `css:tokens` - Verify using design tokens

---

## Further Reading

- [Visual Design System](./visual-design-system.md) - Design tokens and theming
- [MVVM Patterns Guide](../architecture/mvvm-patterns.md) - Component architecture
- [Layout Updates](../../.plans/reviews/layout-updates.md) - Layout refactoring guide

---

## Quick Reference

### Most Common Commands

```bash
# Quick health check
npm run css:complexity && npm run css:duplicates

# Before refactoring
npm run css:map && npm run css:analyze-components

# Cleanup
npm run css:clean:dry-run && npm run css:vars:unused

# Full audit
npm run css:map && npm run css:vars && npm run css:analyze-components && \
npm run css:complexity && npm run css:duplicates && npm run css:tokens
```

### All Available Commands

```bash
# Analysis Tools
npm run css:map                        # CSS usage mapping
npm run css:map:verbose               # Detailed usage map
npm run css:vars                      # CSS variables mapping
npm run css:vars:verbose              # Detailed variable map
npm run css:vars:unused               # Show unused variables
npm run css:analyze-components        # Component style analysis
npm run css:analyze-components:verbose # Detailed component analysis
npm run css:complexity                # Complexity analysis
npm run css:complexity:strict         # Strict complexity check
npm run css:duplicates                # Duplicate detection
npm run css:duplicates:strict         # Strict duplicate detection
npm run css:tokens                    # Token audit
npm run css:tokens:verbose            # Detailed token audit

# Maintenance Tools
npm run css:clean                     # Remove unused CSS
npm run css:clean:dry-run            # Preview removals
npm run css:clean:backup             # Remove with backups
npm run css:migrate                   # Generate migration plan
npm run css:migrate:component        # Migrate specific component
```

---

**Last Updated:** 2025-10-07
