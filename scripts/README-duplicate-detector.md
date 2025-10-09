# CSS Duplicate Detector

A comprehensive analysis tool that detects duplicate and near-duplicate CSS patterns across your codebase, helping identify refactoring opportunities and reduce code duplication.

## Features

- 🔍 **Exact Duplicate Detection** - Identifies identical CSS rule blocks across files
- 📊 **Near-Duplicate Detection** - Finds rules with configurable similarity (default 80%+)
- 🎯 **Pattern Extraction** - Identifies common patterns (flexbox center, card layouts, etc.)
- 📈 **Duplication Scoring** - Calculates percentage of duplicate code in your CSS
- 💡 **Actionable Suggestions** - Recommends utility classes and refactoring strategies
- 📝 **Detailed Markdown Reports** - Generates comprehensive, readable reports
- 🎨 **Supports CSS & Svelte** - Analyzes both standalone CSS files and `<style>` blocks in Svelte components

## Usage

### Quick Commands

```bash
# Run duplicate detection with default settings (80% similarity threshold)
npm run css:duplicates

# Strict mode - only show near-duplicates with 95%+ similarity
npm run css:duplicates:strict
```

### Direct Script Usage

```bash
# Basic usage
node scripts/detect-duplicate-css.js

# Custom similarity threshold (percentage)
node scripts/detect-duplicate-css.js --threshold 70

# Verbose output
node scripts/detect-duplicate-css.js --verbose

# Output to console instead of file
node scripts/detect-duplicate-css.js --console

# Custom output file
node scripts/detect-duplicate-css.js --output MY_REPORT.md

# Custom directories
node scripts/detect-duplicate-css.js --css-dir src/styles --svelte-dir src/lib
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output <path>` | Output file path | `CSS_DUPLICATES_REPORT.md` |
| `--threshold <number>` | Similarity threshold % for near-duplicates | `80` |
| `--css-dir <path>` | CSS directory to scan | `src/lib/client/shared/styles` |
| `--svelte-dir <path>` | Svelte directory to scan | `src` |
| `--verbose` | Show detailed progress output | `false` |
| `--console` | Output to console instead of file | `false` |

## Report Sections

The generated report includes:

### 1. Summary Statistics

- Total CSS rules analyzed
- Total lines of CSS
- Duplicate lines count
- Duplication percentage
- Number of exact duplicate groups
- Number of near-duplicate pairs

### 2. Exact Duplicates

Groups of identical CSS rule blocks with:
- File locations and line numbers
- Selector names
- Complete CSS code
- Suggested refactoring with utility class names

Example:
```css
/* Found in 5 locations */
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 3. Near Duplicates

Pairs of similar CSS rules showing:
- Similarity percentage
- Both rule locations
- Common declarations
- Unique declarations in each rule

Helps identify patterns that could be consolidated with minor adjustments.

### 4. Common Patterns

Frequently occurring patterns with occurrence counts:
- Flexbox Center
- Flex Column/Row
- Absolute/Fixed Positioning
- Card Layouts
- Text Truncation
- Transitions & Transforms
- Grid Layouts

### 5. Recommendations

Actionable suggestions including:
- Quick wins (exact duplicates to extract)
- Near-duplicate review priorities
- Utility class recommendations
- Best practices for CSS organization

## Understanding Results

### Duplication Percentage

- **0-5%**: Excellent - minimal duplication
- **5-10%**: Good - some optimization opportunities
- **10-20%**: Moderate - consider refactoring
- **20%+**: High - significant refactoring recommended

### Similarity Threshold

- **95%+**: Nearly identical (strict mode)
- **80-95%**: High similarity (default)
- **70-80%**: Moderate similarity
- **Below 70%**: Low similarity (may produce many false positives)

## Workflow

1. **Run the analysis**:
   ```bash
   npm run css:duplicates
   ```

2. **Review the report**: Open `CSS_DUPLICATES_REPORT.md`

3. **Prioritize refactoring**:
   - Start with exact duplicates (highest impact)
   - Review high-similarity near-duplicates (90%+)
   - Consider extracting common patterns

4. **Create utility classes**:
   - Extract frequent patterns to `utilities.css`
   - Use semantic names (`flex-center`, `card-base`, etc.)
   - Update components to use new utilities

5. **Re-run analysis** to verify improvements

## Example Use Cases

### Find All Flexbox Center Patterns

```bash
# Run analysis
npm run css:duplicates

# Check "Common Patterns" section for "Flexbox Center"
# See all locations using this pattern
```

### Identify Component Style Duplication

```bash
# Use verbose mode to see what's being scanned
npm run css:duplicates -- --verbose

# Review exact duplicates between components
# Consider extracting to shared component styles
```

### Strict Similarity Checking

```bash
# Only show near-duplicates that are 95%+ similar
npm run css:duplicates:strict

# Focus on the most obvious consolidation opportunities
```

### Quick Console Summary

```bash
# Get a quick summary without generating a file
node scripts/detect-duplicate-css.js --console
```

## Integration with Other CSS Tools

This tool works well with other CSS analysis tools:

1. **CSS Variables Mapper** (`npm run css:vars`)
   - Find duplicate values that should use CSS variables

2. **CSS Usage Mapper** (`npm run css:map`)
   - Identify which components use duplicated styles

3. **CSS Cleaner** (`npm run css:clean`)
   - Remove unused rules after consolidating duplicates

## Tips for Reducing Duplication

### 1. Create Utility Classes

Extract common patterns into a utility file:

```css
/* utilities.css */
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.flex-column {
  display: flex;
  flex-direction: column;
}

.card-base {
  border-radius: var(--radius-md);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: var(--space-4);
}
```

### 2. Use CSS Custom Properties

Replace duplicate values with variables:

```css
/* Before */
.component-a { color: #3b82f6; }
.component-b { color: #3b82f6; }

/* After */
:root {
  --color-primary: #3b82f6;
}
.component-a { color: var(--color-primary); }
.component-b { color: var(--color-primary); }
```

### 3. Component-Scoped Styles

Keep component-specific styles in component files, but extract shared patterns:

```svelte
<style>
  /* Component-specific */
  .unique-layout {
    /* ... */
  }

  /* Use utility classes for common patterns */
  .content {
    /* Apply .flex-column utility instead of duplicating */
  }
</style>
```

### 4. Composition Over Duplication

Instead of duplicating styles, compose from utilities:

```html
<!-- Before -->
<div class="custom-card"></div>
<style>
  .custom-card {
    display: flex;
    align-items: center;
    border-radius: 8px;
    padding: 16px;
    /* ... lots of duplicate code ... */
  }
</style>

<!-- After -->
<div class="card-base flex-center"></div>
```

## Troubleshooting

### "No duplicates found"

- Check that `--css-dir` and `--svelte-dir` point to correct locations
- Ensure CSS files have `.css` extension
- Verify Svelte files have `<style>` blocks

### "Too many near-duplicates"

- Increase `--threshold` to be more strict (e.g., `--threshold 90`)
- Focus on exact duplicates first
- Review top 10-20 pairs, ignore the rest

### "Report is too large"

- The report shows only the first 20 near-duplicate pairs
- Focus on exact duplicates and common patterns sections
- Use higher threshold to reduce near-duplicate matches

## Performance

- Scans 1000+ rules in under 5 seconds
- Handles large codebases efficiently
- Memory usage scales linearly with rule count

## Contributing

Found a bug or have a feature request? Check the project's contribution guidelines.

## Related Documentation

- [CSS Cleaner](./README-css-cleaner.md) - Remove unused CSS
- [Project CLAUDE.md](../CLAUDE.md) - Full project documentation
