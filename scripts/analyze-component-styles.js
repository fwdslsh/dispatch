#!/usr/bin/env node

/**
 * Component Style Analyzer
 *
 * Analyzes how components use styles (scoped vs external CSS).
 * Identifies components using scoped <style> blocks vs external CSS files.
 * Detects mixed approaches and single-component CSS files.
 *
 * Usage:
 *   node scripts/analyze-component-styles.js [options]
 *
 * Options:
 *   --output <path>   Output file path (default: COMPONENT_STYLES_REPORT.md)
 *   --css-dir <path>  CSS directory to scan (default: src/lib/client/shared/styles)
 *   --svelte-dir <path> Svelte directory to scan (default: src)
 *   --verbose         Show detailed output
 *   --console         Output to console instead of file
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
	output: getArgValue('--output') || 'COMPONENT_STYLES_REPORT.md',
	cssDir: getArgValue('--css-dir') || 'src/lib/client/shared/styles',
	svelteDir: getArgValue('--svelte-dir') || 'src',
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

function logVerbose(message, color = 'gray') {
	if (options.verbose) {
		log(message, color);
	}
}

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

/**
 * Detect if a Svelte file has scoped styles
 */
function hasScopedStyles(content) {
	// Match <style> or <style lang="scss"> blocks
	const styleRegex = /<style(?:\s+lang=["'][^"']*["'])?\s*>([\s\S]*?)<\/style>/gi;
	const matches = content.match(styleRegex);

	if (!matches) return { hasScoped: false, isEmpty: false };

	// Check if the style block has any actual content (not just comments/whitespace)
	for (const match of matches) {
		const styleContent = match
			.replace(/<style(?:\s+lang=["'][^"']*["'])?\s*>|<\/style>/gi, '')
			.trim();

		// Remove comments
		const withoutComments = styleContent
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/\/\/.*/g, '')
			.trim();

		if (withoutComments.length > 0) {
			return { hasScoped: true, isEmpty: false };
		}
	}

	// Has style block but it's empty
	return { hasScoped: false, isEmpty: true };
}

/**
 * Extract CSS class selectors from CSS content
 */
function extractCSSClasses(cssContent) {
	const classes = new Set();

	// Match class selectors (.classname)
	const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;

	let match;
	while ((match = classRegex.exec(cssContent)) !== null) {
		classes.add(match[1]);
	}

	return Array.from(classes);
}

/**
 * Find which CSS files a component uses
 */
function findExternalCSSUsage(svelteContent, cssFiles) {
	const usedCSSFiles = [];

	for (const cssFile of cssFiles) {
		const cssContent = fs.readFileSync(cssFile, 'utf-8');
		const classes = extractCSSClasses(cssContent);

		// Check if any of the CSS classes are used in the Svelte file
		for (const className of classes) {
			const patterns = [
				new RegExp(`class\\s*=\\s*["'][^"']*\\b${className}\\b[^"']*["']`, 'g'),
				new RegExp(`class:${className}`, 'g'),
				new RegExp(`className\\s*=\\s*["'][^"']*\\b${className}\\b[^"']*["']`, 'g'),
				new RegExp(`classList\\.(add|remove|toggle)\\s*\\(\\s*["']${className}["']\\s*\\)`, 'g')
			];

			for (const pattern of patterns) {
				if (pattern.test(svelteContent)) {
					usedCSSFiles.push(cssFile);
					// Don't check more classes from this CSS file
					break;
				}
			}

			// Break if we already found this CSS file is used
			if (usedCSSFiles.includes(cssFile)) break;
		}
	}

	return usedCSSFiles;
}

/**
 * Analyze a single Svelte component
 */
function analyzeComponent(svelteFile, cssFiles) {
	const content = fs.readFileSync(svelteFile, 'utf-8');
	const { hasScoped, isEmpty } = hasScopedStyles(content);
	const externalCSS = findExternalCSSUsage(content, cssFiles);

	const category =
		hasScoped && externalCSS.length > 0
			? 'mixed'
			: hasScoped
				? 'scoped-only'
				: externalCSS.length > 0
					? 'external-only'
					: 'no-styles';

	return {
		file: svelteFile,
		hasScoped,
		hasScopedEmpty: isEmpty,
		externalCSS,
		category
	};
}

/**
 * Build map of CSS files to components that use them
 */
function buildCSSToComponentMap(componentAnalyses) {
	const cssMap = new Map();

	for (const analysis of componentAnalyses) {
		for (const cssFile of analysis.externalCSS) {
			if (!cssMap.has(cssFile)) {
				cssMap.set(cssFile, []);
			}
			cssMap.get(cssFile).push(analysis.file);
		}
	}

	return cssMap;
}

/**
 * Find CSS files used by only one component
 */
function findSingleComponentCSS(cssToComponentMap) {
	const singleComponentCSS = [];

	for (const [cssFile, components] of cssToComponentMap.entries()) {
		if (components.length === 1) {
			singleComponentCSS.push({
				cssFile,
				component: components[0]
			});
		}
	}

	return singleComponentCSS;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(componentAnalyses, cssToComponentMap, singleComponentCSS) {
	let markdown = '# Component Styles Analysis Report\n\n';
	markdown += `Generated on ${new Date().toLocaleString()}\n\n`;
	markdown +=
		'> This document analyzes how Svelte components use styles (scoped vs external CSS).\n\n';

	// Calculate statistics
	const total = componentAnalyses.length;
	const scopedOnly = componentAnalyses.filter((a) => a.category === 'scoped-only').length;
	const externalOnly = componentAnalyses.filter((a) => a.category === 'external-only').length;
	const mixed = componentAnalyses.filter((a) => a.category === 'mixed').length;
	const noStyles = componentAnalyses.filter((a) => a.category === 'no-styles').length;

	// Architecture Overview
	markdown += '## Architecture Overview\n\n';
	markdown += `**Total Components:** ${total}\n\n`;
	markdown += '| Style Approach | Count | Percentage |\n';
	markdown += '|----------------|-------|------------|\n';
	markdown += `| Scoped Only | ${scopedOnly} | ${((scopedOnly / total) * 100).toFixed(1)}% |\n`;
	markdown += `| External Only | ${externalOnly} | ${((externalOnly / total) * 100).toFixed(1)}% |\n`;
	markdown += `| Mixed | ${mixed} | ${((mixed / total) * 100).toFixed(1)}% |\n`;
	markdown += `| No Styles | ${noStyles} | ${((noStyles / total) * 100).toFixed(1)}% |\n\n`;

	markdown += '---\n\n';

	// Scoped-Only Components
	markdown += '## Scoped-Only Components\n\n';
	markdown += `Components using only scoped \`<style>\` blocks: **${scopedOnly}**\n\n`;

	if (scopedOnly > 0) {
		const scopedComponents = componentAnalyses
			.filter((a) => a.category === 'scoped-only')
			.map((a) => path.relative(PROJECT_ROOT, a.file))
			.sort();

		for (const comp of scopedComponents) {
			markdown += `- \`${comp}\`\n`;
		}
	} else {
		markdown += '*No components use scoped-only styles.*\n';
	}

	markdown += '\n---\n\n';

	// External-Only Components
	markdown += '## External-Only Components\n\n';
	markdown += `Components using only external CSS files: **${externalOnly}**\n\n`;

	if (externalOnly > 0) {
		const externalComponents = componentAnalyses
			.filter((a) => a.category === 'external-only')
			.map((a) => ({
				file: path.relative(PROJECT_ROOT, a.file),
				cssFiles: a.externalCSS.map((css) => path.relative(PROJECT_ROOT, css))
			}))
			.sort((a, b) => a.file.localeCompare(b.file));

		for (const comp of externalComponents) {
			markdown += `- \`${comp.file}\`\n`;
			if (options.verbose) {
				markdown += '  - External CSS:\n';
				for (const css of comp.cssFiles) {
					markdown += `    - \`${css}\`\n`;
				}
			}
		}
	} else {
		markdown += '*No components use external-only styles.*\n';
	}

	markdown += '\n---\n\n';

	// Mixed Approach Components (should be refactored)
	markdown += '## Mixed Approach Components\n\n';
	markdown +=
		'**Warning:** These components use both scoped styles and external CSS. Consider consolidating.\n\n';
	markdown += `Components using mixed approach: **${mixed}**\n\n`;

	if (mixed > 0) {
		const mixedComponents = componentAnalyses
			.filter((a) => a.category === 'mixed')
			.map((a) => ({
				file: path.relative(PROJECT_ROOT, a.file),
				cssFiles: a.externalCSS.map((css) => path.relative(PROJECT_ROOT, css))
			}))
			.sort((a, b) => a.file.localeCompare(b.file));

		for (const comp of mixedComponents) {
			markdown += `- \`${comp.file}\`\n`;
			markdown += '  - External CSS:\n';
			for (const css of comp.cssFiles) {
				markdown += `    - \`${css}\`\n`;
			}
		}
	} else {
		markdown += '*No components use mixed approach. Good!*\n';
	}

	markdown += '\n---\n\n';

	// Single-Component CSS Files
	markdown += '## Single-Component CSS Files\n\n';
	markdown +=
		'CSS files used by only one component. **Candidates for migration to scoped styles.**\n\n';
	markdown += `Single-component CSS files: **${singleComponentCSS.length}**\n\n`;

	if (singleComponentCSS.length > 0) {
		const sortedSingleCSS = [...singleComponentCSS].sort((a, b) =>
			path.relative(PROJECT_ROOT, a.cssFile).localeCompare(path.relative(PROJECT_ROOT, b.cssFile))
		);

		for (const item of sortedSingleCSS) {
			const cssPath = path.relative(PROJECT_ROOT, item.cssFile);
			const compPath = path.relative(PROJECT_ROOT, item.component);
			markdown += `- \`${cssPath}\`\n`;
			markdown += `  - Used only by: \`${compPath}\`\n`;
			markdown += `  - **Recommendation:** Move styles to component's \`<style>\` block\n`;
		}
	} else {
		markdown += '*No single-component CSS files found.*\n';
	}

	markdown += '\n---\n\n';

	// No Styles Components
	markdown += '## Components Without Styles\n\n';
	markdown += `Components with no styling (neither scoped nor external): **${noStyles}**\n\n`;

	if (noStyles > 0 && options.verbose) {
		const noStyleComponents = componentAnalyses
			.filter((a) => a.category === 'no-styles')
			.map((a) => path.relative(PROJECT_ROOT, a.file))
			.sort();

		markdown += '<details>\n';
		markdown += '<summary>View components without styles</summary>\n\n';

		for (const comp of noStyleComponents) {
			markdown += `- \`${comp}\`\n`;
		}

		markdown += '\n</details>\n';
	}

	markdown += '\n---\n\n';

	// Recommendations
	markdown += '## Recommended Actions\n\n';

	if (mixed > 0) {
		markdown += `### 1. Fix Mixed Approach Components (${mixed})\n\n`;
		markdown +=
			'Components using both scoped and external CSS should consolidate to one approach:\n';
		markdown += '- Move external CSS into scoped `<style>` blocks, OR\n';
		markdown += '- Move scoped styles to external CSS files\n\n';
		markdown += '**Priority:** High - Inconsistent architecture\n\n';
	}

	if (singleComponentCSS.length > 0) {
		markdown += `### ${mixed > 0 ? '2' : '1'}. Migrate Single-Component CSS (${singleComponentCSS.length})\n\n`;
		markdown += 'CSS files used by only one component should be moved to scoped styles:\n';
		markdown += '- Reduces file count\n';
		markdown += '- Improves component encapsulation\n';
		markdown += '- Makes components more portable\n\n';
		markdown += '**Priority:** Medium - Improves maintainability\n\n';
	}

	const scopedPercentage = ((scopedOnly / total) * 100).toFixed(1);
	const externalPercentage = ((externalOnly / total) * 100).toFixed(1);

	if (scopedPercentage < 30 && externalPercentage > 50) {
		markdown += `### ${mixed > 0 || singleComponentCSS.length > 0 ? '3' : '1'}. Consider Increasing Scoped Styles Usage\n\n`;
		markdown += `Currently only ${scopedPercentage}% of components use scoped styles exclusively.\n`;
		markdown += 'Benefits of scoped styles:\n';
		markdown += '- Component encapsulation\n';
		markdown += '- No naming conflicts\n';
		markdown += '- Easier to understand component styling\n';
		markdown += '- Better for component reusability\n\n';
		markdown += '**Priority:** Low - Architectural consideration\n\n';
	}

	if (mixed === 0 && singleComponentCSS.length === 0) {
		markdown += '### All Clear!\n\n';
		markdown += 'No immediate action needed. Your component styles are well-organized.\n';
	}

	return markdown;
}

/**
 * Main execution
 */
async function main() {
	log('\n🎨 Analyzing component styles...\n', 'cyan');

	// Find all CSS files
	const cssDir = path.join(PROJECT_ROOT, options.cssDir);
	const cssFiles = findFiles(cssDir, '.css', ['node_modules', '.svelte-kit']);

	log(`Found ${cssFiles.length} CSS files in ${options.cssDir}`, 'blue');

	// Find all Svelte files
	const svelteDir = path.join(PROJECT_ROOT, options.svelteDir);
	const svelteFiles = findFiles(svelteDir, '.svelte', ['node_modules', '.svelte-kit']);

	log(`Found ${svelteFiles.length} Svelte files in ${options.svelteDir}`, 'blue');
	log('');

	// Analyze components
	log('📊 Analyzing component styles...', 'cyan');
	const componentAnalyses = [];

	for (const svelteFile of svelteFiles) {
		const relativePath = path.relative(PROJECT_ROOT, svelteFile);
		logVerbose(`  ${relativePath}`, 'gray');

		const analysis = analyzeComponent(svelteFile, cssFiles);
		componentAnalyses.push(analysis);

		logVerbose(`    Category: ${analysis.category}`, 'gray');
	}

	log('');

	// Build CSS to component map
	log('🗺️  Building CSS usage map...', 'cyan');
	const cssToComponentMap = buildCSSToComponentMap(componentAnalyses);

	// Find single-component CSS files
	const singleComponentCSS = findSingleComponentCSS(cssToComponentMap);

	log('');

	// Generate report
	log('📝 Generating report...', 'cyan');
	const markdown = generateMarkdownReport(componentAnalyses, cssToComponentMap, singleComponentCSS);

	// Output
	if (options.console) {
		console.log('\n' + markdown);
	} else {
		const outputPath = path.join(PROJECT_ROOT, options.output);
		fs.writeFileSync(outputPath, markdown, 'utf-8');
		log(`✅ Report saved to: ${options.output}`, 'green');
	}

	// Summary
	log('\n' + '='.repeat(60), 'cyan');
	log('📊 Summary', 'cyan');
	log('='.repeat(60), 'cyan');

	const scopedOnly = componentAnalyses.filter((a) => a.category === 'scoped-only').length;
	const externalOnly = componentAnalyses.filter((a) => a.category === 'external-only').length;
	const mixed = componentAnalyses.filter((a) => a.category === 'mixed').length;
	const noStyles = componentAnalyses.filter((a) => a.category === 'no-styles').length;

	log(`Total components: ${componentAnalyses.length}`, 'blue');
	log(`Scoped-only: ${scopedOnly}`, 'green');
	log(`External-only: ${externalOnly}`, 'blue');
	log(`Mixed approach: ${mixed}`, mixed > 0 ? 'yellow' : 'green');
	log(`No styles: ${noStyles}`, 'gray');
	log(
		`Single-component CSS: ${singleComponentCSS.length}`,
		singleComponentCSS.length > 0 ? 'yellow' : 'green'
	);

	if (mixed > 0 || singleComponentCSS.length > 0) {
		log(`\n💡 ${mixed + singleComponentCSS.length} items need attention (see report)`, 'yellow');
	}

	if (!options.console) {
		log(`\nReport: ${options.output}`, 'cyan');
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
