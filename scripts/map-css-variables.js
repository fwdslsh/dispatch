#!/usr/bin/env node

/**
 * Map CSS Variables (Custom Properties)
 *
 * Creates a comprehensive map showing where CSS variables are defined and used.
 * Shows which files define custom properties and which files reference them.
 *
 * Usage:
 *   node scripts/map-css-variables.js [options]
 *
 * Options:
 *   --output <path>   Output file path (default: CSS_VARIABLES_MAP.md)
 *   --css-dir <path>  CSS directory to scan (default: src/lib/client/shared/styles)
 *   --svelte-dir <path> Svelte directory to scan (default: src)
 *   --verbose         Show detailed output
 *   --console         Output to console instead of file
 *   --unused-only     Show only unused variables
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
	output: getArgValue('--output') || 'CSS_VARIABLES_MAP.md',
	cssDir: getArgValue('--css-dir') || 'src/lib/client/shared/styles',
	svelteDir: getArgValue('--svelte-dir') || 'src',
	verbose: args.includes('--verbose'),
	console: args.includes('--console'),
	unusedOnly: args.includes('--unused-only')
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
 * Extract CSS variable definitions from content
 * Returns map of variable name -> value
 */
function extractVariableDefinitions(content) {
	const variables = new Map();

	// Match --variable-name: value; (including in :root, *, classes, etc.)
	const varDefRegex = /--([\w-]+)\s*:\s*([^;]+);/g;

	let match;
	while ((match = varDefRegex.exec(content)) !== null) {
		const varName = match[1];
		const value = match[2].trim();
		variables.set(varName, value);
	}

	return variables;
}

/**
 * Extract CSS variable usages from content
 * Returns array of variable names used
 */
function extractVariableUsages(content) {
	const usages = new Set();

	// Match var(--variable-name) or var(--variable-name, fallback)
	const varUseRegex = /var\(--([\w-]+)(?:\s*,\s*[^)]+)?\)/g;

	let match;
	while ((match = varUseRegex.exec(content)) !== null) {
		usages.add(match[1]);
	}

	return Array.from(usages);
}

/**
 * Find which files use a specific variable
 */
function findVariableUsage(varName, allFiles) {
	const usedIn = [];

	for (const file of allFiles) {
		const content = fs.readFileSync(file, 'utf-8');
		const usages = extractVariableUsages(content);

		if (usages.includes(varName)) {
			usedIn.push(file);
		}
	}

	return usedIn;
}

/**
 * Build variable map for a file
 */
function buildVariableMap(file, allFiles) {
	const content = fs.readFileSync(file, 'utf-8');
	const definitions = extractVariableDefinitions(content);

	logVerbose(`  Found ${definitions.size} variable definitions...`, 'gray');

	const variableMap = new Map();

	for (const [varName, value] of definitions.entries()) {
		const usedIn = findVariableUsage(varName, allFiles);

		variableMap.set(varName, {
			value,
			usedIn: usedIn.sort()
		});
	}

	return {
		file,
		definitions,
		variableMap,
		totalVars: definitions.size,
		usedVars: Array.from(variableMap.values()).filter((v) => v.usedIn.length > 0).length,
		unusedVars: Array.from(variableMap.values()).filter((v) => v.usedIn.length === 0).length
	};
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(variableMaps, allVarNames) {
	let markdown = '# CSS Variables Map\n\n';
	markdown += `Generated on ${new Date().toLocaleString()}\n\n`;
	markdown +=
		'> This document shows where CSS variables (custom properties) are defined and used throughout the codebase.\n\n';

	// Summary statistics
	const totalFiles = variableMaps.length;
	const totalVars = variableMaps.reduce((sum, map) => sum + map.totalVars, 0);
	const totalUsedVars = variableMaps.reduce((sum, map) => sum + map.usedVars, 0);
	const totalUnusedVars = variableMaps.reduce((sum, map) => sum + map.unusedVars, 0);

	markdown += '## Summary\n\n';
	markdown += `- **Total Files Defining Variables:** ${totalFiles}\n`;
	markdown += `- **Total CSS Variables:** ${totalVars}\n`;
	markdown += `- **Used Variables:** ${totalUsedVars} (${((totalUsedVars / totalVars) * 100).toFixed(1)}%)\n`;
	markdown += `- **Unused Variables:** ${totalUnusedVars} (${((totalUnusedVars / totalVars) * 100).toFixed(1)}%)\n\n`;

	markdown += '---\n\n';

	// Sort files by number of variables defined (most first)
	const sortedMaps = [...variableMaps].sort((a, b) => b.totalVars - a.totalVars);

	for (const map of sortedMaps) {
		const relativePath = path.relative(PROJECT_ROOT, map.file);

		// Skip if unused-only mode and this file has no unused vars
		if (options.unusedOnly && map.unusedVars === 0) {
			continue;
		}

		markdown += `## ${relativePath}\n\n`;
		markdown += `**Variables:** ${map.totalVars} total, ${map.usedVars} used, ${map.unusedVars} unused\n\n`;

		if (map.totalVars === 0) {
			markdown += '⚠️ **No variables defined**\n\n';
			markdown += '---\n\n';
			continue;
		}

		// Group variables by usage status
		const usedVars = [];
		const unusedVars = [];

		for (const [varName, data] of map.variableMap.entries()) {
			if (data.usedIn.length > 0) {
				usedVars.push({ name: varName, ...data });
			} else {
				unusedVars.push({ name: varName, ...data });
			}
		}

		// Show unused variables first (more important)
		if (unusedVars.length > 0) {
			markdown += '### ⚠️ Unused Variables\n\n';

			for (const varData of unusedVars) {
				markdown += `- **\`--${varData.name}\`**: \`${varData.value}\`\n`;
			}

			markdown += '\n';
		}

		// Show used variables
		if (usedVars.length > 0 && !options.unusedOnly) {
			markdown += '### Used Variables\n\n';

			// Sort by usage count (most used first)
			usedVars.sort((a, b) => b.usedIn.length - a.usedIn.length);

			for (const varData of usedVars) {
				markdown += `- **\`--${varData.name}\`**: \`${varData.value}\` — used in ${varData.usedIn.length} file(s)\n`;

				if (options.verbose) {
					markdown += '  <details>\n';
					markdown += '  <summary>Show usage locations</summary>\n\n';

					for (const file of varData.usedIn) {
						const relativeFile = path.relative(PROJECT_ROOT, file);
						markdown += `  - \`${relativeFile}\`\n`;
					}

					markdown += '\n  </details>\n';
				}
			}

			markdown += '\n';
		}

		markdown += '---\n\n';
	}

	// Add index of all variables
	if (!options.unusedOnly) {
		markdown += '## Variable Index\n\n';
		markdown += 'Alphabetical list of all CSS variables:\n\n';

		const sortedVarNames = Array.from(allVarNames).sort();

		for (const varName of sortedVarNames) {
			markdown += `- \`--${varName}\`\n`;
		}

		markdown += '\n';
	}

	return markdown;
}

/**
 * Main execution
 */
async function main() {
	log('\n🎨 Mapping CSS variables across the codebase...\n', 'cyan');

	// Find all CSS and Svelte files
	const cssDir = path.join(PROJECT_ROOT, options.cssDir);
	const cssFiles = findFiles(cssDir, '.css', ['node_modules', '.svelte-kit']);

	const svelteDir = path.join(PROJECT_ROOT, options.svelteDir);
	const svelteFiles = findFiles(svelteDir, '.svelte', ['node_modules', '.svelte-kit']);

	const allFiles = [...cssFiles, ...svelteFiles];

	log(`Found ${cssFiles.length} CSS files in ${options.cssDir}`, 'blue');
	log(`Found ${svelteFiles.length} Svelte files in ${options.svelteDir}`, 'blue');
	log(`Scanning ${allFiles.length} total files for variable usage`, 'blue');
	log('');

	// Find all files that define variables
	const filesWithVariables = [];
	const allVarNames = new Set();

	log('📊 Finding variable definitions...', 'cyan');

	for (const file of cssFiles) {
		const content = fs.readFileSync(file, 'utf-8');
		const definitions = extractVariableDefinitions(content);

		if (definitions.size > 0) {
			filesWithVariables.push(file);
			definitions.forEach((value, name) => allVarNames.add(name));

			const relativePath = path.relative(PROJECT_ROOT, file);
			logVerbose(`  ${relativePath} - ${definitions.size} variables`, 'gray');
		}
	}

	log(`Found ${filesWithVariables.length} files defining variables`, 'green');
	log(`Found ${allVarNames.size} unique variables`, 'green');
	log('');

	// Build variable maps
	log('📊 Analyzing variable usage...', 'cyan');
	const variableMaps = [];

	for (const file of filesWithVariables) {
		const relativePath = path.relative(PROJECT_ROOT, file);
		log(`  ${relativePath}`, 'gray');

		const map = buildVariableMap(file, allFiles);
		variableMaps.push(map);

		logVerbose(
			`    ${map.usedVars} used, ${map.unusedVars} unused`,
			map.unusedVars > 0 ? 'yellow' : 'green'
		);
	}

	log('');

	// Generate report
	log('📝 Generating report...', 'cyan');
	const markdown = generateMarkdownReport(variableMaps, allVarNames);

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

	const totalVars = variableMaps.reduce((sum, map) => sum + map.totalVars, 0);
	const totalUsed = variableMaps.reduce((sum, map) => sum + map.usedVars, 0);
	const totalUnused = variableMaps.reduce((sum, map) => sum + map.unusedVars, 0);

	log(`Files with variables: ${filesWithVariables.length}`, 'blue');
	log(`Total variables: ${totalVars}`, 'blue');
	log(`Used variables: ${totalUsed}`, 'green');
	log(`Unused variables: ${totalUnused}`, totalUnused > 0 ? 'yellow' : 'green');

	if (totalUnused > 0) {
		log(`\n💡 ${totalUnused} variables are not used anywhere and can be removed`, 'yellow');
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
