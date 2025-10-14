#!/usr/bin/env node

/**
 * Remove Unused CSS Rules
 *
 * Scans all CSS files and Svelte components to identify and remove unused CSS rules.
 *
 * Usage:
 *   node scripts/remove-unused-css.js [options]
 *
 * Options:
 *   --dry-run         Show what would be removed without making changes
 *   --backup          Create .backup files before modifying CSS
 *   --verbose         Show detailed output
 *   --css-dir <path>  CSS directory to scan (default: src/lib/client/shared/styles)
 *   --svelte-dir <path> Svelte directory to scan (default: src)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Recursively find files matching a pattern
 */
function findFiles(dir, pattern, ignore = []) {
	const results = [];

	function walk(currentPath) {
		// Skip ignored directories
		const relativePath = path.relative(PROJECT_ROOT, currentPath);
		for (const ignorePattern of ignore) {
			if (relativePath.includes(ignorePattern.replace(/\*\*/g, '').replace(/\*/g, ''))) {
				return;
			}
		}

		try {
			const entries = fs.readdirSync(currentPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(currentPath, entry.name);

				if (entry.isDirectory()) {
					walk(fullPath);
				} else if (entry.isFile() && entry.name.endsWith(pattern)) {
					results.push(fullPath);
				}
			}
		} catch (_err) {
			// Skip directories we can't read
		}
	}

	walk(dir);
	return results;
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
	dryRun: args.includes('--dry-run'),
	backup: args.includes('--backup'),
	verbose: args.includes('--verbose'),
	cssDir: getArgValue('--css-dir') || 'src/lib/client/shared/styles',
	svelteDir: getArgValue('--svelte-dir') || 'src'
};

function getArgValue(flag) {
	const index = args.indexOf(flag);
	return index >= 0 && args[index + 1] ? args[index + 1] : null;
}

// ANSI color codes
const colors = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	gray: '\x1b[90m'
};

function log(message, color = 'reset') {
	console.log(`${colors[color]}${message}${colors.reset}`);
}

function logVerbose(message, color = 'gray') {
	if (options.verbose) {
		log(message, color);
	}
}

/**
 * Extract CSS class selectors from CSS content
 * Note: This function is currently unused but kept for potential future use
 */
function _extractCSSClasses(cssContent) {
	const classes = new Set();

	// Match class selectors (.classname)
	// This regex captures classes in various contexts:
	// - .class-name
	// - .class-name:hover
	// - .class-name::before
	// - .class-name.another-class
	// - div.class-name
	// - .class-name > .child
	const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;

	let match;
	while ((match = classRegex.exec(cssContent)) !== null) {
		classes.add(match[1]);
	}

	return classes;
}

/**
 * Extract CSS rules with their selectors
 */
function extractCSSRules(cssContent) {
	const rules = [];

	// Match CSS rules (selector { ... })
	// This handles multi-line rules, media queries, and nested selectors
	const ruleRegex = /([^{}]+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;

	let match;
	while ((match = ruleRegex.exec(cssContent)) !== null) {
		const selector = match[1].trim();
		const content = match[2].trim();

		// Extract classes from this selector
		const classes = new Set();
		const classMatches = selector.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g);
		for (const classMatch of classMatches) {
			classes.add(classMatch[1]);
		}

		rules.push({
			selector,
			content,
			classes: Array.from(classes),
			fullRule: match[0]
		});
	}

	return rules;
}

/**
 * Search for class usage in Svelte files
 */
function findUsedClasses(svelteFiles) {
	const usedClasses = new Set();

	for (const file of svelteFiles) {
		const content = fs.readFileSync(file, 'utf-8');

		// Find classes in various patterns:
		// 1. class="class-name"
		// 2. class:class-name={condition}
		// 3. className="class-name" (for custom components)
		// 4. classList.add('class-name')
		// 5. Dynamic classes in template literals

		// Pattern 1: class="..." or class='...'
		const classAttrRegex = /class\s*=\s*["']([^"']+)["']/g;
		let match;
		while ((match = classAttrRegex.exec(content)) !== null) {
			const classNames = match[1].split(/\s+/).filter(Boolean);
			classNames.forEach((cls) => usedClasses.add(cls));
		}

		// Pattern 2: class:class-name={...}
		const classDirectiveRegex = /class:([a-zA-Z_-][a-zA-Z0-9_-]*)/g;
		while ((match = classDirectiveRegex.exec(content)) !== null) {
			usedClasses.add(match[1]);
		}

		// Pattern 3: className prop
		const classNameRegex = /className\s*=\s*["']([^"']+)["']/g;
		while ((match = classNameRegex.exec(content)) !== null) {
			const classNames = match[1].split(/\s+/).filter(Boolean);
			classNames.forEach((cls) => usedClasses.add(cls));
		}

		// Pattern 4: classList.add/remove/toggle
		const classListRegex = /classList\.(add|remove|toggle)\s*\(\s*["']([^"']+)["']\s*\)/g;
		while ((match = classListRegex.exec(content)) !== null) {
			usedClasses.add(match[2]);
		}

		// Pattern 5: Template literals with classes
		const templateRegex = /class\s*=\s*{`([^`]+)`}/g;
		while ((match = templateRegex.exec(content)) !== null) {
			// Extract potential class names from template literal
			const potentialClasses = match[1].match(/\b[a-zA-Z_-][a-zA-Z0-9_-]*\b/g);
			if (potentialClasses) {
				potentialClasses.forEach((cls) => usedClasses.add(cls));
			}
		}
	}

	return usedClasses;
}

/**
 * Check if a CSS rule should be kept
 */
function shouldKeepRule(rule, usedClasses) {
	// If the rule has no classes (e.g., element selectors, :root, @media), keep it
	if (rule.classes.length === 0) {
		return true;
	}

	// If ANY of the rule's classes are used, keep the rule
	return rule.classes.some((cls) => usedClasses.has(cls));
}

/**
 * Remove unused rules from CSS content
 */
function removeUnusedRules(cssContent, usedClasses) {
	const rules = extractCSSRules(cssContent);
	const keptRules = [];
	const removedRules = [];

	for (const rule of rules) {
		if (shouldKeepRule(rule, usedClasses)) {
			keptRules.push(rule);
		} else {
			removedRules.push(rule);
		}
	}

	// Reconstruct CSS with only kept rules
	let newContent = cssContent;

	// Remove rules in reverse order to maintain string positions
	removedRules
		.sort((a, b) => cssContent.lastIndexOf(b.fullRule) - cssContent.lastIndexOf(a.fullRule))
		.forEach((rule) => {
			newContent = newContent.replace(rule.fullRule, '');
		});

	// Clean up excessive whitespace
	newContent = newContent
		.replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
		.trim();

	return {
		newContent,
		keptCount: keptRules.length,
		removedCount: removedRules.length,
		removedRules
	};
}

/**
 * Main execution
 */
async function main() {
	log('\n🔍 Scanning for unused CSS rules...\n', 'cyan');

	if (options.dryRun) {
		log('⚠️  DRY RUN MODE - No files will be modified\n', 'yellow');
	}

	// Find all CSS files
	const cssDir = path.join(PROJECT_ROOT, options.cssDir);
	const cssFiles = findFiles(cssDir, '.css', ['node_modules', '.svelte-kit']);

	log(`Found ${cssFiles.length} CSS files in ${options.cssDir}`, 'blue');

	// Find all Svelte files
	const svelteDir = path.join(PROJECT_ROOT, options.svelteDir);
	const svelteFiles = findFiles(svelteDir, '.svelte', ['node_modules', '.svelte-kit']);

	log(`Found ${svelteFiles.length} Svelte files in ${options.svelteDir}`, 'blue');

	// Find all used classes
	log('\n📊 Analyzing class usage...', 'cyan');
	const usedClasses = findUsedClasses(svelteFiles);
	log(`Found ${usedClasses.size} unique classes used in Svelte files\n`, 'green');

	// Process each CSS file
	let totalRemoved = 0;
	let totalKept = 0;
	const filesModified = [];

	for (const cssFile of cssFiles) {
		const relativePath = path.relative(PROJECT_ROOT, cssFile);
		const cssContent = fs.readFileSync(cssFile, 'utf-8');

		const result = removeUnusedRules(cssContent, usedClasses);

		if (result.removedCount > 0) {
			log(`\n📄 ${relativePath}`, 'magenta');
			log(`   Kept: ${result.keptCount} rules`, 'green');
			log(`   Removed: ${result.removedCount} rules`, 'red');

			if (options.verbose) {
				result.removedRules.forEach((rule) => {
					logVerbose(`   - ${rule.selector}`, 'gray');
				});
			}

			totalRemoved += result.removedCount;
			totalKept += result.keptCount;

			if (!options.dryRun) {
				// Create backup if requested
				if (options.backup) {
					const backupFile = `${cssFile}.backup`;
					fs.writeFileSync(backupFile, cssContent, 'utf-8');
					logVerbose(`   Created backup: ${backupFile}`, 'gray');
				}

				// Write updated CSS
				fs.writeFileSync(cssFile, result.newContent, 'utf-8');
				filesModified.push(relativePath);
			}
		} else {
			logVerbose(`\n✓ ${relativePath} - No unused rules`, 'gray');
			totalKept += result.keptCount;
		}
	}

	// Summary
	log('\n' + '='.repeat(60), 'cyan');
	log('📊 Summary', 'cyan');
	log('='.repeat(60), 'cyan');
	log(`Total rules kept: ${totalKept}`, 'green');
	log(`Total rules removed: ${totalRemoved}`, 'red');
	log(`Files modified: ${filesModified.length}`, 'blue');

	if (options.dryRun && totalRemoved > 0) {
		log('\n💡 Run without --dry-run to apply changes', 'yellow');
	}

	if (!options.dryRun && filesModified.length > 0) {
		log('\n✅ CSS files have been updated!', 'green');
		if (!options.backup) {
			log('💡 Consider using --backup next time to create backups', 'yellow');
		}
	}

	log('');
}

// Run the script
main().catch((error) => {
	log(`\n❌ Error: ${error.message}`, 'red');
	if (options.verbose) {
		console.error(error);
	}
	process.exit(1);
});
