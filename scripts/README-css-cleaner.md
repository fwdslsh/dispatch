# CSS Cleaner Script

A powerful utility script that automatically removes unused CSS rules from your SvelteKit project by analyzing actual class usage in Svelte components.

## Features

- 🔍 **Scans all CSS files** in your styles directory
- 📊 **Analyzes Svelte components** to find actually used classes
- 🗑️ **Removes unused CSS rules** automatically
- 💾 **Backup support** to preserve original files
- 🔬 **Dry-run mode** to preview changes before applying
- 📝 **Detailed reporting** of removed vs. kept rules
- 🎨 **Color-coded output** for easy reading

## Usage

### Quick Commands

```bash
# Dry run - see what would be removed without making changes
npm run css:clean:dry-run

# Clean with backups - safest option
npm run css:clean:backup

# Clean without backups - use with caution
npm run css:clean
```

### Direct Script Usage

```bash
# Basic usage
node scripts/remove-unused-css.js

# Dry run with detailed output
node scripts/remove-unused-css.js --dry-run --verbose

# Create backups before modifying
node scripts/remove-unused-css.js --backup

# Custom directories
node scripts/remove-unused-css.js --css-dir src/styles --svelte-dir src/lib
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Show what would be removed without making changes | false |
| `--backup` | Create .backup files before modifying CSS | false |
| `--verbose` | Show detailed output including removed selectors | false |
| `--css-dir <path>` | CSS directory to scan | `src/lib/client/shared/styles` |
| `--svelte-dir <path>` | Svelte directory to scan | `src` |

## How It Works

### 1. CSS Analysis

The script parses CSS files and extracts all class selectors from rules like:

```css
.button { }                    /* Simple selector */
.card:hover { }               /* Pseudo-class */
.icon::before { }             /* Pseudo-element */
.parent .child { }            /* Descendant selector */
div.component { }             /* Element + class */
```

### 2. Svelte Component Scanning

It searches for class usage in multiple patterns:

```svelte
<!-- Pattern 1: class attribute -->
<div class="button primary"></div>

<!-- Pattern 2: class directive -->
<div class:active={isActive}></div>

<!-- Pattern 3: className prop -->
<Component className="custom-style" />

<!-- Pattern 4: classList API -->
<script>
  element.classList.add('highlight');
</script>

<!-- Pattern 5: Template literals -->
<div class={`container ${theme}`}></div>
```

### 3. Rule Removal

- If **ANY** class in a CSS rule is used, the entire rule is kept
- If **NO** classes in a rule are used, the rule is removed
- Rules without classes (element selectors, :root, @media) are always kept

## Example Output

```
🔍 Scanning for unused CSS rules...

Found 15 CSS files in src/lib/client/shared/styles
Found 127 Svelte files in src

📊 Analyzing class usage...
Found 243 unique classes used in Svelte files

📄 utilities.css
   Kept: 88 rules
   Removed: 74 rules
   - .p-0
   - .py-1
   - .gap-5
   - .is-active
   - .glow-blue
   ...

📄 components/buttons.css
   Kept: 12 rules
   Removed: 3 rules

============================================================
📊 Summary
============================================================
Total rules kept: 156
Total rules removed: 89
Files modified: 5

✅ CSS files have been updated!
```

## Safety Features

### Dry Run Mode

Always test with `--dry-run` first to see what will be removed:

```bash
npm run css:clean:dry-run
```

This shows exactly what would be removed without making any changes.

### Backup Mode

Create backups before modifying:

```bash
npm run css:clean:backup
```

This creates `.backup` files alongside each modified CSS file:
- `utilities.css`
- `utilities.css.backup` ← Safe copy of original

### Verbose Mode

See detailed information about every removed rule:

```bash
node scripts/remove-unused-css.js --dry-run --verbose
```

## Best Practices

### 1. Always Dry Run First

```bash
npm run css:clean:dry-run
```

Review the output to ensure nothing important will be removed.

### 2. Use Backups Initially

```bash
npm run css:clean:backup
```

Keep backups until you've tested the changes.

### 3. Test After Cleaning

After running the script:
1. Run the dev server: `npm run dev`
2. Visually inspect your application
3. Check all routes and components
4. Verify styles are intact

### 4. Commit Before Running

Always commit your work before running the cleaner:

```bash
git add .
git commit -m "Before CSS cleanup"
npm run css:clean:backup
```

This allows easy rollback if needed.

## Limitations

### What It Doesn't Detect

1. **Dynamic class names constructed in JavaScript:**
   ```javascript
   const className = 'btn-' + type; // Won't detect 'btn-primary', 'btn-secondary'
   ```

2. **Classes added by external libraries**

3. **Classes used in CSS-in-JS or styled components**

4. **Classes in .html files** (only scans .svelte files)

### Workarounds

**For dynamic classes**, either:
- Safelist them manually by keeping them in CSS
- Use explicit class names in the code when possible
- Run in dry-run mode and manually review

**For external libraries:**
- Use `--css-dir` to target only your custom CSS
- Exclude library CSS files from the scan

## Integration with Build Pipeline

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
npm run css:clean:dry-run
```

This reminds you to clean CSS before committing.

### CI/CD Pipeline

Add to your CI workflow to catch unused CSS:

```yaml
- name: Check for unused CSS
  run: |
    npm run css:clean:dry-run > css-report.txt
    # Optionally fail if too much unused CSS is detected
```

## Troubleshooting

### Script Reports Classes as Unused But They Are Used

**Cause:** Dynamic class construction
**Solution:** Review the reported classes and manually verify

### Styles Broken After Running

**Cause:** False positive removal
**Solution:**
1. Restore from backup: `cp utilities.css.backup utilities.css`
2. Or restore from git: `git checkout -- src/lib/client/shared/styles/`
3. Review the removed rules and identify which are needed
4. Add those classes explicitly in components

### Script Runs Slow

**Cause:** Large codebase
**Solution:** Narrow the scan directories:

```bash
node scripts/remove-unused-css.js \
  --css-dir src/lib/client/shared/styles/components \
  --svelte-dir src/lib/client
```

## Advanced Usage

### Clean Specific Directories

```bash
# Only clean component CSS
node scripts/remove-unused-css.js \
  --css-dir src/lib/client/shared/styles/components \
  --backup --verbose

# Clean utilities only
node scripts/remove-unused-css.js \
  --css-dir src/lib/client/shared/styles \
  --backup
```

### Combine with Git

```bash
# Show diff after cleaning
npm run css:clean
git diff src/lib/client/shared/styles/

# Commit if changes look good
git add .
git commit -m "Remove unused CSS rules"

# Or rollback if something broke
git checkout -- src/lib/client/shared/styles/
```

## Contributing

To improve the script:

1. Add new pattern detection for class usage
2. Improve CSS parsing for edge cases
3. Add configuration file support (.csscleanrc)
4. Add ignore patterns for specific selectors

## License

Same as parent project (CC-BY-4.0)
