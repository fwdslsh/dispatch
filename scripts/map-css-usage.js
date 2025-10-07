#!/usr/bin/env node

/**
 * Map CSS Usage
 *
 * Creates a comprehensive map showing where CSS rules are used across the codebase.
 * Groups usage by CSS source file and shows which Svelte files use classes from each CSS file.
 *
 * Usage:
 *   node scripts/map-css-usage.js [options]
 *
 * Options:
 *   --output <path>   Output file path (default: CSS_USAGE_MAP.md)
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
	output: getArgValue('--output') || 'CSS_USAGE_MAP.md',
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
		} catch (err) {
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

	// Match class selectors (.classname)
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

		// Search for the class name in various patterns
		const patterns = [
			new RegExp(`class\\s*=\\s*["'][^"']*\\b${className}\\b[^"']*["']`, 'g'),
			new RegExp(`class:${className}`, 'g'),
			new RegExp(`className\\s*=\\s*["'][^"']*\\b${className}\\b[^"']*["']`, 'g'),
			new RegExp(`classList\\.(add|remove|toggle)\\s*\\(\\s*["']${className}["']\\s*\\)`, 'g'),
			new RegExp(`\\b${className}\\b`, 'g') // Fallback: just check if the word appears
		];

		for (const pattern of patterns) {
			if (pattern.test(content)) {
				usedIn.push(file);
				break; // Don't add the same file multiple times
			}
		}
	}

	return usedIn;
}

/**
 * Build usage map for a CSS file
 */
function buildCSSFileMap(cssFile, svelteFiles) {
	const cssContent = fs.readFileSync(cssFile, 'utf-8');
	const classes = extractCSSClasses(cssContent);

	logVerbose(`  Analyzing ${classes.length} classes...`, 'gray');

	// Track which files use ANY class from this CSS file
	const usedByFiles = new Set();
	const classUsageMap = new Map(); // Map of class -> array of files using it

	for (const className of classes) {
		const usedIn = findClassUsage(className, svelteFiles);

		if (usedIn.length > 0) {
			classUsageMap.set(className, usedIn);
			usedIn.forEach(file => usedByFiles.add(file));
		}
	}

	return {
		cssFile,
		totalClasses: classes.length,
		usedClasses: classUsageMap.size,
		unusedClasses: classes.length - classUsageMap.size,
		usedByFiles: Array.from(usedByFiles).sort(),
		classUsageMap
	};
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(usageMaps) {
	let markdown = '# CSS Usage Map\n\n';
	markdown += `Generated on ${new Date().toLocaleString()}\n\n`;
	markdown += '> This document shows where CSS files are used throughout the codebase.\n';
	markdown += '> Each CSS file lists the Svelte components that use classes defined in that file.\n\n';

	// Summary statistics
	const totalCSSFiles = usageMaps.length;
	const totalClasses = usageMaps.reduce((sum, map) => sum + map.totalClasses, 0);
	const totalUsedClasses = usageMaps.reduce((sum, map) => sum + map.usedClasses, 0);
	const totalUnusedClasses = usageMaps.reduce((sum, map) => sum + map.unusedClasses, 0);

	markdown += '## Summary\n\n';
	markdown += `- **Total CSS Files:** ${totalCSSFiles}\n`;
	markdown += `- **Total CSS Classes:** ${totalClasses}\n`;
	markdown += `- **Used Classes:** ${totalUsedClasses} (${((totalUsedClasses / totalClasses) * 100).toFixed(1)}%)\n`;
	markdown += `- **Unused Classes:** ${totalUnusedClasses} (${((totalUnusedClasses / totalClasses) * 100).toFixed(1)}%)\n\n`;

	markdown += '---\n\n';

	// Sort CSS files by number of files using them (most used first)
	const sortedMaps = [...usageMaps].sort((a, b) => b.usedByFiles.length - a.usedByFiles.length);

	for (const map of sortedMaps) {
		const relativePath = path.relative(PROJECT_ROOT, map.cssFile);

		markdown += `## ${relativePath}\n\n`;
		markdown += `**Classes:** ${map.totalClasses} total, ${map.usedClasses} used, ${map.unusedClasses} unused\n\n`;

		if (map.usedByFiles.length === 0) {
			markdown += '⚠️ **Not used by any Svelte files**\n\n';
		} else {
			markdown += `**Used by ${map.usedByFiles.length} file(s):**\n\n`;

			for (const file of map.usedByFiles) {
				const relativeFile = path.relative(PROJECT_ROOT, file);
				markdown += `- \`${relativeFile}\`\n`;
			}

			markdown += '\n';

			// Add detailed class usage breakdown if verbose
			if (options.verbose) {
				markdown += '<details>\n';
				markdown += '<summary>Detailed class usage</summary>\n\n';

				for (const [className, files] of map.classUsageMap.entries()) {
					markdown += `- **\`.${className}\`** used in:\n`;
					for (const file of files) {
						const relativeFile = path.relative(PROJECT_ROOT, file);
						markdown += `  - \`${relativeFile}\`\n`;
					}
				}

				markdown += '\n</details>\n\n';
			}
		}

		markdown += '---\n\n';
	}

	return markdown;
}

/**
 * Main execution
 */
async function main() {
	log('\n🗺️  Mapping CSS usage across the codebase...\n', 'cyan');

	// Find all CSS files
	const cssDir = path.join(PROJECT_ROOT, options.cssDir);
	const cssFiles = findFiles(cssDir, '.css', ['node_modules', '.svelte-kit']);

	log(`Found ${cssFiles.length} CSS files in ${options.cssDir}`, 'blue');

	// Find all Svelte files
	const svelteDir = path.join(PROJECT_ROOT, options.svelteDir);
	const svelteFiles = findFiles(svelteDir, '.svelte', ['node_modules', '.svelte-kit']);

	log(`Found ${svelteFiles.length} Svelte files in ${options.svelteDir}`, 'blue');
	log('');

	// Build usage maps
	log('📊 Analyzing CSS usage...', 'cyan');
	const usageMaps = [];

	for (const cssFile of cssFiles) {
		const relativePath = path.relative(PROJECT_ROOT, cssFile);
		log(`  ${relativePath}`, 'gray');

		const map = buildCSSFileMap(cssFile, svelteFiles);
		usageMaps.push(map);

		logVerbose(`    Used by ${map.usedByFiles.length} files`, 'green');
	}

	log('');

	// Generate report
	log('📝 Generating report...', 'cyan');
	const markdown = generateMarkdownReport(usageMaps);

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

	const totalUsage = usageMaps.reduce((sum, map) => sum + map.usedByFiles.length, 0);
	const unusedFiles = usageMaps.filter(map => map.usedByFiles.length === 0).length;

	log(`CSS files analyzed: ${usageMaps.length}`, 'blue');
	log(`Total usage connections: ${totalUsage}`, 'green');
	log(`Unused CSS files: ${unusedFiles}`, unusedFiles > 0 ? 'yellow' : 'green');

	if (!options.console) {
		log(`\nReport: ${options.output}`, 'cyan');
	}

	log('');
}

// Run the script
main().catch(error => {
	log(`\n❌ Error: ${error.message}`, 'red');
	if (options.verbose) {
		console.error(error);
	}
	process.exit(1);
});
