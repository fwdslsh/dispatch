#!/usr/bin/env node
/**
 * Performance Benchmark Script for Workspace Refactoring
 *
 * Measures current implementation performance to compare against refactored version
 */

import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

/**
 * Analyze current workspace implementation
 */
async function analyzeCurrentImplementation() {
	console.log('🔍 Analyzing Current Workspace Implementation\n');

	const workspacePage = path.join(projectRoot, 'src/routes/workspace/+page.svelte');

	// File size analysis
	const stats = await fs.stat(workspacePage);
	const content = await fs.readFile(workspacePage, 'utf8');

	const lines = content.split('\n');
	const scriptSection = extractSection(content, '<script>', '</script>');
	const styleSection = extractSection(content, '<style>', '</style>');
	const markupSection = content.replace(scriptSection, '').replace(styleSection, '');

	console.log('📊 File Size Metrics:');
	console.log(`   Total file size: ${(stats.size / 1024).toFixed(2)} KB`);
	console.log(`   Total lines: ${lines.length}`);
	console.log(`   Script lines: ${scriptSection.split('\n').length}`);
	console.log(`   Style lines: ${styleSection.split('\n').length}`);
	console.log(`   Markup lines: ${markupSection.split('\n').length}`);

	// Complexity analysis
	const imports = (scriptSection.match(/import .* from/g) || []).length;
	const stateVariables = (scriptSection.match(/let .* = \$state/g) || []).length;
	const derivedVariables = (scriptSection.match(/let .* = \$derived/g) || []).length;
	const functions = (scriptSection.match(/function \w+/g) || []).length;
	const eventHandlers = (scriptSection.match(/on:\w+/g) || []).length;

	console.log('\n🧩 Complexity Metrics:');
	console.log(`   Import statements: ${imports}`);
	console.log(`   State variables: ${stateVariables}`);
	console.log(`   Derived variables: ${derivedVariables}`);
	console.log(`   Functions: ${functions}`);
	console.log(`   Event handlers: ${eventHandlers}`);

	return {
		fileSize: stats.size,
		totalLines: lines.length,
		scriptLines: scriptSection.split('\n').length,
		imports,
		stateVariables,
		derivedVariables,
		functions,
		eventHandlers
	};
}

/**
 * Extract content between tags
 */
function extractSection(content, startTag, endTag) {
	const startIndex = content.indexOf(startTag);
	if (startIndex === -1) return '';

	const endIndex = content.indexOf(endTag, startIndex + startTag.length);
	if (endIndex === -1) return '';

	return content.substring(startIndex, endIndex + endTag.length);
}

/**
 * Measure build performance
 */
async function measureBuildPerformance() {
	console.log('\n⚡ Build Performance Benchmarks:\n');

	// Cold build
	console.log('Running cold build...');
	const coldStart = performance.now();

	try {
		const { execSync } = await import('child_process');
		execSync('npm run build', {
			cwd: projectRoot,
			stdio: 'pipe',
			timeout: 120000 // 2 minutes timeout
		});
		const coldEnd = performance.now();
		console.log(`   Cold build time: ${((coldEnd - coldStart) / 1000).toFixed(2)}s`);

		// Incremental build (touch a file and rebuild)
		const testFile = path.join(projectRoot, 'src/routes/workspace/+page.svelte');
		const originalContent = await fs.readFile(testFile, 'utf8');

		// Add a comment to trigger rebuild
		await fs.writeFile(testFile, originalContent + '\n<!-- benchmark test -->\n');

		const incrementalStart = performance.now();
		execSync('npm run build', {
			cwd: projectRoot,
			stdio: 'pipe',
			timeout: 60000 // 1 minute timeout
		});
		const incrementalEnd = performance.now();

		// Restore original file
		await fs.writeFile(testFile, originalContent);

		console.log(
			`   Incremental build time: ${((incrementalEnd - incrementalStart) / 1000).toFixed(2)}s`
		);

		return {
			coldBuildTime: (coldEnd - coldStart) / 1000,
			incrementalBuildTime: (incrementalEnd - incrementalStart) / 1000
		};
	} catch (error) {
		console.log(`   ❌ Build failed: ${error.message}`);
		return {
			coldBuildTime: null,
			incrementalBuildTime: null,
			error: error.message
		};
	}
}

/**
 * Analyze bundle size
 */
async function analyzeBundleSize() {
	console.log('\n📦 Bundle Size Analysis:\n');

	try {
		const buildDir = path.join(projectRoot, 'build');
		const clientDir = path.join(buildDir, '_app', 'immutable');

		// Check if build directory exists
		try {
			await fs.access(buildDir);
		} catch {
			console.log('   ⚠️  Build directory not found. Run npm run build first.');
			return null;
		}

		// Analyze client bundles
		const entries = await fs.readdir(clientDir, { withFileTypes: true, recursive: true });

		let totalSize = 0;
		let jsSize = 0;
		let cssSize = 0;
		let fileCount = 0;

		for (const entry of entries) {
			if (entry.isFile()) {
				const filePath = path.join(entry.path, entry.name);
				const stats = await fs.stat(filePath);
				totalSize += stats.size;
				fileCount++;

				if (entry.name.endsWith('.js')) {
					jsSize += stats.size;
				} else if (entry.name.endsWith('.css')) {
					cssSize += stats.size;
				}
			}
		}

		console.log(`   Total bundle size: ${(totalSize / 1024).toFixed(2)} KB`);
		console.log(`   JavaScript size: ${(jsSize / 1024).toFixed(2)} KB`);
		console.log(`   CSS size: ${(cssSize / 1024).toFixed(2)} KB`);
		console.log(`   Total files: ${fileCount}`);

		return {
			totalSize,
			jsSize,
			cssSize,
			fileCount
		};
	} catch (error) {
		console.log(`   ❌ Bundle analysis failed: ${error.message}`);
		return null;
	}
}

/**
 * Memory usage estimation (static analysis)
 */
async function estimateMemoryUsage() {
	console.log('\n🧠 Memory Usage Estimation:\n');

	const workspacePage = path.join(projectRoot, 'src/routes/workspace/+page.svelte');
	const content = await fs.readFile(workspacePage, 'utf8');

	// Estimate reactive state memory usage
	const stateMatches = content.match(/let .* = \$state\([^)]*\)/g) || [];
	const derivedMatches = content.match(/let .* = \$derived\([^)]*\)/g) || [];

	// Rough estimation based on state complexity
	const estimatedStateMemory = stateMatches.length * 100; // 100 bytes per state variable (rough estimate)
	const estimatedDerivedMemory = derivedMatches.length * 50; // 50 bytes per derived (rough estimate)

	console.log(`   Estimated state memory: ~${estimatedStateMemory} bytes`);
	console.log(`   Estimated derived memory: ~${estimatedDerivedMemory} bytes`);
	console.log(
		`   Total estimated reactive memory: ~${estimatedStateMemory + estimatedDerivedMemory} bytes`
	);

	return {
		stateVariables: stateMatches.length,
		derivedVariables: derivedMatches.length,
		estimatedStateMemory,
		estimatedDerivedMemory
	};
}

/**
 * Main benchmark runner
 */
async function runBenchmarks() {
	console.log('🚀 Workspace Refactoring Performance Benchmark');
	console.log('================================================\n');

	const timestamp = new Date().toISOString();
	const results = {
		timestamp,
		version: 'pre-refactor',
		implementation: await analyzeCurrentImplementation(),
		build: await measureBuildPerformance(),
		bundle: await analyzeBundleSize(),
		memory: await estimateMemoryUsage()
	};

	// Save results for comparison
	const resultsFile = path.join(projectRoot, 'performance-results.json');
	await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));

	console.log('\n✅ Benchmark Complete!');
	console.log(`Results saved to: ${resultsFile}`);
	console.log('\nUse this data to compare against post-refactor performance.');

	return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runBenchmarks().catch(console.error);
}

export { runBenchmarks };
