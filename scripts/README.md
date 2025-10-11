# CSS Analysis Scripts

This directory contains CSS analysis and refactoring tools for the Dispatch project.

## Quick Start

```bash
# Find unnecessary CSS and hardcoded values
node scripts/find-unnecessary-css.js

# Detect duplicate CSS patterns
node scripts/detect-duplicate-css.js

# Audit hardcoded tokens
node scripts/audit-css-tokens.js

# Analyze component styles
node scripts/analyze-component-styles.js
```

## Documentation

See [docs/reference/css-tools.md](../docs/reference/css-tools.md) for complete documentation of all CSS analysis tools.

## New Tool: Unnecessary CSS Finder

The `find-unnecessary-css.js` tool identifies:

- **Hardcoded values** that match CSS variable definitions (e.g., `8px` instead of `var(--space-2)`)
- **Unnecessary HTML element overrides** that duplicate global theme defaults
- **Components** with low inheritance scores that could rely more on global styles

### Current Codebase Metrics

Latest run results:

- **Inheritance Score:** 96% ✅ Excellent
- **Files Analyzed:** 102
- **Unnecessary Declarations:** 239 out of 6,130 total
- **Potential CSS Reduction:** 4%

### Quick Wins Identified

1. Replace `8px` with `var(--space-2)` - **41 occurrences**
2. Replace `2px` with `var(--space-0)` - **27 occurrences**
3. Replace `32px` with `var(--space-6)` - **26 occurrences**

These simple find-and-replace operations can eliminate ~94 hardcoded values!

### Usage

```bash
# Standard analysis
node scripts/find-unnecessary-css.js

# Verbose mode
node scripts/find-unnecessary-css.js --verbose

# Console output (no file)
node scripts/find-unnecessary-css.js --console

# Custom files
node scripts/find-unnecessary-css.js \
  --theme-file src/lib/client/shared/styles/retro.css \
  --vars-file src/lib/client/shared/styles/variables.css
```

### Output

Generates `UNNECESSARY_CSS_REPORT.md` with:

- Summary statistics and inheritance score
- Hardcoded values grouped by variable (sorted by frequency)
- Unnecessary HTML element overrides
- Components with low inheritance scores
- Actionable recommendations
- Before/after examples

## All Available Tools

1. **CSS Usage Mapper** (`map-css-usage.js`) - Map CSS files to components
2. **CSS Variables Mapper** (`map-css-variables.js`) - Track CSS variable usage
3. **Component Style Analyzer** (`analyze-component-styles.js`) - Analyze style approaches
4. **CSS Complexity Analyzer** (`analyze-css-complexity.js`) - Measure CSS complexity
5. **Duplicate CSS Detector** (`detect-duplicate-css.js`) - Find duplicate patterns
6. **Color & Token Audit** (`audit-css-tokens.js`) - Find hardcoded values
7. **Unnecessary CSS Finder** (`find-unnecessary-css.js`) - Find redundant styles ⭐ NEW
8. **CSS Cleaner** (`remove-unused-css.js`) - Remove unused rules
9. **Style Migration Helper** (`migrate-to-component-styles.js`) - Migrate to scoped styles

## Contributing

When creating a new CSS analysis tool:

1. Follow the existing patterns:
   - Accept common CLI flags (`--output`, `--verbose`, `--console`)
   - Generate markdown reports
   - Use colored console output
   - Provide actionable recommendations

2. Add documentation to `docs/reference/css-tools.md`

3. Make the script executable: `chmod +x scripts/your-script.js`

4. Update this README with a brief description
