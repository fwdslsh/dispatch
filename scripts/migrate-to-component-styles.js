#!/usr/bin/env node

/**
 * Style Migration Helper
 *
 * Helps migrate external CSS into Svelte component scoped styles.
 * Identifies single-component CSS files (easy wins) and generates ready-to-use migration plans.
 *
 * Usage:
 *   node scripts/migrate-to-component-styles.js [options]
 *
 * Options:
 *   --output <path>       Output file path (default: STYLE_MIGRATION_PLAN.md)
 *   --css-dir <path>      CSS directory to scan (default: src/lib/client/shared/styles)
 *   --svelte-dir <path>   Svelte directory to scan (default: src)
 *   --component <name>    Generate plan for specific component only
 *   --verbose             Show detailed output
 *   --console             Output to console instead of file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
	output: getArgValue('--output') || 'STYLE_MIGRATION_PLAN.md',
	cssDir: getArgValue('--css-dir') || 'src/lib/client/shared/styles',
	svelteDir: getArgValue('--svelte-dir') || 'src',
	component: getArgValue('--component'),
	verbose: args.includes('--verbose'),
	console: args.includes('--console')
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

function _logVerbose(message, color = 'gray') {
	if (options.verbose) {
		log(message, color);
	}
}

// Note: _logVerbose is defined but currently unused in this script
// It's kept for potential future verbose logging functionality

/**
 * Recursively find files matching a pattern
 */
function findFiles(dir, pattern, ignore = []) {
	const results = [];

	function walk(currentPath) {
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

/**
 * Extract CSS class selectors from CSS content
 */
function extractCSSClasses(cssContent) {
	const classes = new Set();
	const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;

	let match;
	while ((match = classRegex.exec(cssContent)) !== null) {
		classes.add(match[1]);
	}

	return Array.from(classes);
}

/**
 * Find which Svelte files use a specific class
 */
function findClassUsage(className, svelteFiles) {
	const usedIn = [];

	for (const file of svelteFiles) {
		const content = fs.readFileSync(file, 'utf-8');

		const patterns = [
			new RegExp(`class\\s*=\\s*["'][^"']*\\b${className}\\b[^"']*["']`, 'g'),
			new RegExp(`class:${className}`, 'g'),
			new RegExp(`className\\s*=\\s*["'][^"']*\\b${className}\\b[^"']*["']`, 'g'),
			new RegExp(`classList\\.(add|remove|toggle)\\s*\\(\\s*["']${className}["']\\s*\\)`, 'g'),
			new RegExp(`\\b${className}\\b`, 'g')
		];

		for (const pattern of patterns) {
			if (pattern.test(content)) {
				usedIn.push(file);
				break;
			}
		}
	}

	return usedIn;
}

/**
 * Build CSS usage map
 */
function buildCSSUsageMap(cssFiles, svelteFiles) {
	const usageMap = [];

	for (const cssFile of cssFiles) {
		const cssContent = fs.readFileSync(cssFile, 'utf-8');
		const classes = extractCSSClasses(cssContent);

		const usedByFiles = new Set();
		const classUsageMap = new Map();

		for (const className of classes) {
			const usedIn = findClassUsage(className, svelteFiles);

			if (usedIn.length > 0) {
				classUsageMap.set(className, usedIn);
				usedIn.forEach((file) => usedByFiles.add(file));
			}
		}

		usageMap.push({
			cssFile,
			cssContent,
			totalClasses: classes.length,
			usedClasses: classUsageMap.size,
			unusedClasses: classes.length - classUsageMap.size,
			usedByFiles: Array.from(usedByFiles).sort(),
			classUsageMap
		});
	}

	return usageMap;
}

/**
 * Categorize CSS files by migration difficulty
 */
function categorizeMigrations(usageMap) {
	const phase1 = []; // Single component - easy wins
	const phase2 = []; // Few components (2-5) - moderate
	const phase3 = []; // Many components (6+) - complex
	const skip = []; // No usage or global styles

	for (const map of usageMap) {
		const fileCount = map.usedByFiles.length;
		const fileName = path.basename(map.cssFile);

		// Skip global/foundation styles
		if (
			fileName.includes('variables') ||
			fileName.includes('retro') ||
			fileName.includes('utilities') ||
			fileName === 'index.css'
		) {
			skip.push(map);
		} else if (fileCount === 0) {
			skip.push(map);
		} else if (fileCount === 1) {
			phase1.push(map);
		} else if (fileCount >= 2 && fileCount <= 5) {
			phase2.push(map);
		} else {
			phase3.push(map);
		}
	}

	return { phase1, phase2, phase3, skip };
}

/**
 * Generate migration instructions for a single component
 */
function generateComponentMigration(cssMap, componentFile) {
	const relativeCSSPath = path.relative(PROJECT_ROOT, cssMap.cssFile);
	const relativeComponentPath = path.relative(PROJECT_ROOT, componentFile);
	const componentName = path.basename(componentFile, '.svelte');

	// Read the component file to check if it has a <style> block
	const componentContent = fs.readFileSync(componentFile, 'utf-8');
	const hasStyleBlock = /<style[^>]*>/.test(componentContent);
	const hasScriptBlock = /<script[^>]*>/.test(componentContent);

	// Generate the scoped style block
	const scopedStyles = `<style>\n${cssMap.cssContent}\n</style>`;

	// Determine where to place the style block
	let placement = 'at the end of the file';
	if (hasScriptBlock) {
		placement = 'after the <script> block and before the markup';
	}

	return {
		componentName,
		componentFile: relativeComponentPath,
		cssFile: relativeCSSPath,
		hasStyleBlock,
		placement,
		scopedStyles,
		classCount: cssMap.totalClasses,
		usedClassCount: cssMap.usedClasses
	};
}

/**
 * Generate markdown migration plan
 */
function generateMigrationPlan(categories, _usageMap) {
	let markdown = '# Style Migration Plan\n\n';
	markdown += `Generated on ${new Date().toLocaleString()}\n\n`;
	markdown +=
		'> This document provides a step-by-step plan for migrating external CSS into Svelte component scoped styles.\n\n';

	// Overview
	markdown += '## Overview\n\n';
	markdown += `This migration plan organizes CSS files into phases based on complexity:\n\n`;
	markdown += `- **Phase 1 (Easy Wins):** ${categories.phase1.length} CSS files used by single components\n`;
	markdown += `- **Phase 2 (Moderate):** ${categories.phase2.length} CSS files shared by 2-5 components\n`;
	markdown += `- **Phase 3 (Complex):** ${categories.phase3.length} CSS files used by 6+ components\n`;
	markdown += `- **Skipped:** ${categories.skip.length} global/foundation styles or unused files\n\n`;

	// Progress tracker
	markdown += '## Migration Progress\n\n';
	markdown += '- [ ] Phase 1: Easy Wins\n';
	markdown += '- [ ] Phase 2: Moderate Complexity\n';
	markdown += '- [ ] Phase 3: Complex Migrations\n\n';

	markdown += '---\n\n';

	// Phase 1: Easy Wins
	markdown += '## Phase 1: Easy Wins (Single Component CSS)\n\n';
	markdown += '**Priority:** Start here for quick wins and minimal risk.\n\n';

	if (categories.phase1.length === 0) {
		markdown += '_No single-component CSS files found._\n\n';
	} else {
		for (const cssMap of categories.phase1) {
			const componentFile = cssMap.usedByFiles[0];
			const migration = generateComponentMigration(cssMap, componentFile);

			markdown += `### ${migration.componentName}\n\n`;
			markdown += `**CSS File:** \`${migration.cssFile}\`  \n`;
			markdown += `**Component:** \`${migration.componentFile}\`  \n`;
			markdown += `**Classes:** ${migration.classCount} total, ${migration.usedClassCount} used\n\n`;

			markdown += '**Current State:**\n';
			markdown += `- External CSS file with ${migration.classCount} classes\n`;
			markdown += `- Used only by ${migration.componentName}\n`;
			markdown += `- ${migration.hasStyleBlock ? 'Component has existing <style> block' : 'Component has no <style> block'}\n\n`;

			markdown += '**Migration Steps:**\n\n';
			markdown += `1. Open \`${migration.componentFile}\`\n`;
			markdown += `2. ${migration.hasStyleBlock ? 'Update the existing <style> block' : `Add a <style> block ${migration.placement}`}\n`;
			markdown += `3. Copy the CSS below into the <style> block\n`;
			markdown += `4. Remove the CSS import if present\n`;
			markdown += `5. Delete \`${migration.cssFile}\`\n`;
			markdown += `6. Test the component visually\n`;
			markdown += `7. Run \`npm test\` to ensure nothing broke\n\n`;

			markdown += '**Scoped Styles (Ready to Paste):**\n\n';
			markdown += '```css\n';
			markdown += migration.scopedStyles;
			markdown += '\n```\n\n';

			markdown += '**Testing Checklist:**\n\n';
			markdown += `- [ ] Visual appearance unchanged\n`;
			markdown += `- [ ] All variants/states work correctly\n`;
			markdown += `- [ ] Responsive behavior maintained\n`;
			markdown += `- [ ] No console errors\n`;
			markdown += `- [ ] Tests pass\n\n`;

			markdown += '---\n\n';
		}
	}

	// Phase 2: Moderate Complexity
	markdown += '## Phase 2: Moderate Complexity (2-5 Components)\n\n';
	markdown +=
		'**Priority:** Handle after Phase 1. May need to split styles or create shared components.\n\n';

	if (categories.phase2.length === 0) {
		markdown += '_No moderately shared CSS files found._\n\n';
	} else {
		for (const cssMap of categories.phase2) {
			const relativeCSSPath = path.relative(PROJECT_ROOT, cssMap.cssFile);
			const fileName = path.basename(cssMap.cssFile, '.css');

			markdown += `### ${fileName}\n\n`;
			markdown += `**CSS File:** \`${relativeCSSPath}\`  \n`;
			markdown += `**Used by ${cssMap.usedByFiles.length} components:**\n\n`;

			for (const file of cssMap.usedByFiles) {
				const relativeFile = path.relative(PROJECT_ROOT, file);
				markdown += `- \`${relativeFile}\`\n`;
			}

			markdown += '\n**Migration Strategy:**\n\n';
			markdown += `1. **Option A (Duplicate):** Copy styles into each component's <style> block\n`;
			markdown += `2. **Option B (Extract):** Create a shared component with these styles\n`;
			markdown += `3. **Option C (Keep):** Keep as external CSS if truly shared presentation logic\n\n`;

			markdown += '**Recommended Approach:**\n';
			markdown += `- If styles are identical across components: Choose Option A\n`;
			markdown += `- If styles represent a reusable pattern: Choose Option B\n`;
			markdown += `- If styles are foundational/global: Choose Option C\n\n`;

			markdown += '**Scoped Styles (Reference):**\n\n';
			markdown += '```css\n';
			markdown += cssMap.cssContent;
			markdown += '\n```\n\n';

			markdown += '---\n\n';
		}
	}

	// Phase 3: Complex Migrations
	markdown += '## Phase 3: Complex Migrations (6+ Components)\n\n';
	markdown +=
		'**Priority:** Handle last. These are likely shared design tokens or component libraries.\n\n';

	if (categories.phase3.length === 0) {
		markdown += '_No complex shared CSS files found._\n\n';
	} else {
		for (const cssMap of categories.phase3) {
			const relativeCSSPath = path.relative(PROJECT_ROOT, cssMap.cssFile);
			const fileName = path.basename(cssMap.cssFile, '.css');

			markdown += `### ${fileName}\n\n`;
			markdown += `**CSS File:** \`${relativeCSSPath}\`  \n`;
			markdown += `**Used by ${cssMap.usedByFiles.length} components**\n\n`;

			markdown += '**Migration Strategy:**\n\n';
			markdown += `- This CSS is widely used across the codebase\n`;
			markdown += `- Consider keeping as external CSS or refactoring into design tokens\n`;
			markdown += `- If migrating, create a comprehensive testing plan\n\n`;

			markdown += `**Components using this CSS:** _(first 10 shown)_\n\n`;
			for (const file of cssMap.usedByFiles.slice(0, 10)) {
				const relativeFile = path.relative(PROJECT_ROOT, file);
				markdown += `- \`${relativeFile}\`\n`;
			}

			if (cssMap.usedByFiles.length > 10) {
				markdown += `- ... and ${cssMap.usedByFiles.length - 10} more\n`;
			}

			markdown += '\n---\n\n';
		}
	}

	// Skipped files
	markdown += '## Skipped Files\n\n';
	markdown += '**These files were not included in the migration plan:**\n\n';

	if (categories.skip.length === 0) {
		markdown += '_No files skipped._\n\n';
	} else {
		for (const cssMap of categories.skip) {
			const relativeCSSPath = path.relative(PROJECT_ROOT, cssMap.cssFile);
			const _fileName = path.basename(cssMap.cssFile);
			const reason =
				cssMap.usedByFiles.length === 0
					? 'Not used by any components'
					: 'Global/foundation styles (retro.css, utilities.css, variables.css, etc.)';

			markdown += `- \`${relativeCSSPath}\` - ${reason}\n`;
		}

		markdown += '\n';
	}

	// Summary
	markdown += '---\n\n';
	markdown += '## Migration Tips\n\n';
	markdown += '1. **Start with Phase 1** - These are low-risk, high-value migrations\n';
	markdown += '2. **Test thoroughly** - Visual regression is the primary risk\n';
	markdown += '3. **Use git** - Commit each migration separately for easy rollback\n';
	markdown += '4. **Run `npm test`** after each migration\n';
	markdown += '5. **Check responsive behavior** - Ensure mobile/desktop views still work\n';
	markdown += '6. **Review dark/light themes** - If applicable, test both theme variants\n\n';

	return markdown;
}

/**
 * Generate migration plan for a specific component
 */
function generateSingleComponentPlan(componentName, usageMap, allSvelteFiles) {
	// Find the component file
	const componentFiles = allSvelteFiles.filter(
		(file) =>
			path.basename(file, '.svelte').toLowerCase() === componentName.toLowerCase() ||
			file.toLowerCase().includes(componentName.toLowerCase())
	);

	if (componentFiles.length === 0) {
		throw new Error(`Component "${componentName}" not found`);
	}

	if (componentFiles.length > 1) {
		log('Multiple components found:', 'yellow');
		componentFiles.forEach((file) => {
			log(`  - ${path.relative(PROJECT_ROOT, file)}`, 'yellow');
		});
		throw new Error('Please be more specific with the component name');
	}

	const componentFile = componentFiles[0];

	// Find CSS files that use this component
	const relevantCSSMaps = usageMap.filter((cssMap) => cssMap.usedByFiles.includes(componentFile));

	if (relevantCSSMaps.length === 0) {
		throw new Error(`No CSS files found for component "${componentName}"`);
	}

	let markdown = `# Style Migration Plan: ${path.basename(componentFile, '.svelte')}\n\n`;
	markdown += `Generated on ${new Date().toLocaleString()}\n\n`;
	markdown += `**Component:** \`${path.relative(PROJECT_ROOT, componentFile)}\`\n\n`;

	markdown += `## CSS Files Used\n\n`;

	for (const cssMap of relevantCSSMaps) {
		const relativeCSSPath = path.relative(PROJECT_ROOT, cssMap.cssFile);
		markdown += `### ${path.basename(cssMap.cssFile)}\n\n`;
		markdown += `**File:** \`${relativeCSSPath}\`  \n`;
		markdown += `**Classes:** ${cssMap.totalClasses} total\n`;
		markdown += `**Also used by:** ${cssMap.usedByFiles.length - 1} other component(s)\n\n`;

		markdown += '**CSS Content:**\n\n';
		markdown += '```css\n';
		markdown += cssMap.cssContent;
		markdown += '\n```\n\n';
	}

	markdown += `## Migration Steps\n\n`;
	markdown += `1. Open \`${path.relative(PROJECT_ROOT, componentFile)}\`\n`;
	markdown += `2. Add/update the <style> block with the CSS above\n`;
	markdown += `3. Remove CSS imports if present\n`;
	markdown += `4. Test the component\n`;
	markdown += `5. If the CSS is used by only this component, delete the CSS file\n\n`;

	return markdown;
}

/**
 * Main execution
 */
async function main() {
	log('\n🎨 Style Migration Helper\n', 'cyan');

	// Find all CSS files
	const cssDir = path.join(PROJECT_ROOT, options.cssDir);
	const cssFiles = findFiles(cssDir, '.css', ['node_modules', '.svelte-kit']);

	log(`Found ${cssFiles.length} CSS files in ${options.cssDir}`, 'blue');

	// Find all Svelte files
	const svelteDir = path.join(PROJECT_ROOT, options.svelteDir);
	const svelteFiles = findFiles(svelteDir, '.svelte', ['node_modules', '.svelte-kit']);

	log(`Found ${svelteFiles.length} Svelte files in ${options.svelteDir}`, 'blue');
	log('');

	// Build usage map
	log('📊 Analyzing CSS usage...', 'cyan');
	const usageMap = buildCSSUsageMap(cssFiles, svelteFiles);

	log('');

	// Generate migration plan
	let markdown;

	if (options.component) {
		log(`📝 Generating migration plan for component: ${options.component}`, 'cyan');
		markdown = generateSingleComponentPlan(options.component, usageMap, svelteFiles);
	} else {
		log('📝 Generating full migration plan...', 'cyan');
		const categories = categorizeMigrations(usageMap);
		markdown = generateMigrationPlan(categories, usageMap);

		log('');
		log('='.repeat(60), 'cyan');
		log('📊 Migration Summary', 'cyan');
		log('='.repeat(60), 'cyan');
		log(`Phase 1 (Easy Wins): ${categories.phase1.length} files`, 'green');
		log(`Phase 2 (Moderate): ${categories.phase2.length} files`, 'yellow');
		log(`Phase 3 (Complex): ${categories.phase3.length} files`, 'red');
		log(`Skipped: ${categories.skip.length} files`, 'gray');
	}

	// Output
	if (options.console) {
		console.log('\n' + markdown);
	} else {
		const outputPath = path.join(PROJECT_ROOT, options.output);
		fs.writeFileSync(outputPath, markdown, 'utf-8');
		log(`\n✅ Migration plan saved to: ${options.output}`, 'green');
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
