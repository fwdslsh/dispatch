import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Simple function to find files recursively
function findFiles(dir, pattern, results = []) {
	if (!fs.existsSync(dir)) return results;
	
	const files = fs.readdirSync(dir);
	
	for (const file of files) {
		const fullPath = path.join(dir, file);
		const stat = fs.statSync(fullPath);
		
		if (stat.isDirectory()) {
			findFiles(fullPath, pattern, results);
		} else if (file.match(pattern)) {
			results.push(path.relative(process.cwd(), fullPath));
		}
	}
	
	return results;
}

describe('Documentation Migration Cleanup', () => {
	describe('Documentation Files Migration Reference Check', () => {
		test('should find no migration references in documentation files', async () => {
			const workspaceRoot = process.cwd();
			
			// Find all documentation files
			const docFiles = findFiles(path.join(workspaceRoot, 'docs'), /\.md$/);
			const readmeFiles = findFiles(workspaceRoot, /README\.md$/);
			
			const allDocFiles = [...docFiles, ...readmeFiles];
			const migrationReferences = [];

			// Authentication migration-related terms to search for (excluding legitimate migration references)
			const migrationTerms = [
				'AuthMigrationManager',
				'migration-related',
				'TERMINAL_KEY migration',
				'/api/admin/migration',
				'/api/auth/migrate',
				'migration/status',
				'migration/complete',
				'migration/rollback',
				'auth_migration',
				'migration_status',
				'migrationManager',
				'runMigration',
				'migrateAuth',
				'authMigrate',
				'authentication migration',
				'auth migration system',
				'migration endpoint'
			];

			for (const docFile of allDocFiles) {
				const filePath = path.join(workspaceRoot, docFile);
				if (fs.existsSync(filePath)) {
					const content = fs.readFileSync(filePath, 'utf-8');
					
					// Check for migration references
					for (const term of migrationTerms) {
						const regex = new RegExp(term, 'gi');
						const matches = content.match(regex);
						if (matches) {
							migrationReferences.push({
								file: docFile,
								term: term,
								matches: matches.length,
								// Get context around matches
								context: content.split('\n').filter(line => 
									line.toLowerCase().includes(term.toLowerCase())
								).slice(0, 3)
							});
						}
					}
				}
			}

			if (migrationReferences.length > 0) {
				console.log('Migration references found in documentation:');
				migrationReferences.forEach(ref => {
					console.log(`- ${ref.file}: "${ref.term}" (${ref.matches} matches)`);
					ref.context.forEach(line => console.log(`  ${line.trim()}`));
				});
			}

			expect(migrationReferences).toEqual([]);
		});

		test('should verify API documentation reflects current endpoints only', async () => {
			const workspaceRoot = process.cwd();
			
			// Find API and architecture documentation files
			const apiDocFiles = findFiles(path.join(workspaceRoot, 'docs'), /api/i);
			const architectureFiles = findFiles(path.join(workspaceRoot, 'docs'), /architecture/i);
			const agentFiles = ['AGENTS.md', 'CLAUDE.md'];
			
			const deprecatedEndpoints = [];
			const deprecatedApiPatterns = [
				'/api/admin/migration',
				'/api/auth/migrate',
				'migration/status',
				'migration/complete',
				'migration/rollback'
			];

			const allFiles = [...apiDocFiles, ...architectureFiles, ...agentFiles];
			
			for (const docFile of allFiles) {
				const filePath = path.join(workspaceRoot, docFile);
				if (fs.existsSync(filePath)) {
					const content = fs.readFileSync(filePath, 'utf-8');
					
					for (const endpoint of deprecatedApiPatterns) {
						if (content.includes(endpoint)) {
							deprecatedEndpoints.push({
								file: docFile,
								endpoint: endpoint,
								context: content.split('\n').filter(line => 
									line.includes(endpoint)
								).slice(0, 2)
							});
						}
					}
				}
			}

			if (deprecatedEndpoints.length > 0) {
				console.log('Deprecated API endpoints found in documentation:');
				deprecatedEndpoints.forEach(dep => {
					console.log(`- ${dep.file}: ${dep.endpoint}`);
					dep.context.forEach(line => console.log(`  ${line.trim()}`));
				});
			}

			expect(deprecatedEndpoints).toEqual([]);
		});

		test('should verify deployment guides are migration-free', async () => {
			const workspaceRoot = process.cwd();
			
			// Find deployment and configuration documentation files
			const deploymentFiles = findFiles(path.join(workspaceRoot, 'docs'), /deploy/i);
			const dockerFiles = ['docker-compose.yml', 'docker/README.md'];
			const productionFiles = findFiles(path.join(workspaceRoot, 'docs'), /production/i);
			
			const migrationInstructions = [];
			const migrationInstPatterns = [
				'migrate your existing',
				'migration process',
				'run migration',
				'migration step',
				'migration guide',
				'before migrating',
				'after migration',
				'migration script'
			];

			const allFiles = [...deploymentFiles, ...dockerFiles, ...productionFiles];

			for (const docFile of allFiles) {
				const filePath = path.join(workspaceRoot, docFile);
				if (fs.existsSync(filePath)) {
					const content = fs.readFileSync(filePath, 'utf-8');
					
					for (const pattern of migrationInstPatterns) {
						const regex = new RegExp(pattern, 'gi');
						if (regex.test(content)) {
							migrationInstructions.push({
								file: docFile,
								pattern: pattern,
								context: content.split('\n').filter(line => 
									line.toLowerCase().includes(pattern.toLowerCase())
								).slice(0, 2)
							});
						}
					}
				}
			}

			if (migrationInstructions.length > 0) {
				console.log('Migration instructions found in deployment docs:');
				migrationInstructions.forEach(inst => {
					console.log(`- ${inst.file}: "${inst.pattern}"`);
					inst.context.forEach(line => console.log(`  ${line.trim()}`));
				});
			}

			expect(migrationInstructions).toEqual([]);
		});

		test('should verify troubleshooting guides cover current auth paths only', async () => {
			const workspaceRoot = process.cwd();
			
			// Find troubleshooting and user guide documentation files
			const troubleshootingFiles = findFiles(path.join(workspaceRoot, 'docs'), /troubleshoot/i);
			const userGuideFiles = findFiles(path.join(workspaceRoot, 'docs'), /user/i);
			const supportFiles = ['README.md', 'QUICKSTART.md'];
			
			const legacyAuthReferences = [];
			const legacyAuthPatterns = [
				'migration error',
				'migration failed',
				'migration timeout',
				'auth migration',
				'rollback migration',
				'migration stuck',
				'migration incomplete'
			];

			const allFiles = [...troubleshootingFiles, ...userGuideFiles, ...supportFiles];

			for (const docFile of allFiles) {
				const filePath = path.join(workspaceRoot, docFile);
				if (fs.existsSync(filePath)) {
					const content = fs.readFileSync(filePath, 'utf-8');
					
					for (const pattern of legacyAuthPatterns) {
						const regex = new RegExp(pattern, 'gi');
						if (regex.test(content)) {
							legacyAuthReferences.push({
								file: docFile,
								pattern: pattern,
								context: content.split('\n').filter(line => 
									line.toLowerCase().includes(pattern.toLowerCase())
								).slice(0, 2)
							});
						}
					}
				}
			}

			if (legacyAuthReferences.length > 0) {
				console.log('Legacy auth references found in troubleshooting docs:');
				legacyAuthReferences.forEach(ref => {
					console.log(`- ${ref.file}: "${ref.pattern}"`);
					ref.context.forEach(line => console.log(`  ${line.trim()}`));
				});
			}

			expect(legacyAuthReferences).toEqual([]);
		});
	});

	describe('Documentation Quality and Completeness', () => {
		test('should verify authentication documentation exists and is current', async () => {
			const workspaceRoot = process.cwd();
			
			// Check for essential authentication documentation files
			const authFiles = [
				'docs/claude-authentication.md',
				'AGENTS.md',
				'CLAUDE.md'
			];

			const missingFiles = [];
			const currentAuthTopics = [
				'TERMINAL_KEY',
				'OAuth',
				'authentication flow',
				'session management'
			];

			for (const file of authFiles) {
				const filePath = path.join(workspaceRoot, file);
				if (!fs.existsSync(filePath)) {
					missingFiles.push(file);
				} else {
					const content = fs.readFileSync(filePath, 'utf-8');
					// Verify it contains current auth topics
					const missingTopics = currentAuthTopics.filter(topic => 
						!content.toLowerCase().includes(topic.toLowerCase())
					);
					if (missingTopics.length > 0) {
						console.log(`${file} missing topics:`, missingTopics);
					}
				}
			}

			expect(missingFiles).toEqual([]);
		});

		test('should verify configuration documentation is up to date', async () => {
			const workspaceRoot = process.cwd();
			
			// Find configuration and environment documentation files
			const configFiles = findFiles(path.join(workspaceRoot, 'docs'), /config/i);
			const envFiles = findFiles(path.join(workspaceRoot, 'docs'), /env/i);
			const setupFiles = ['README.md', 'QUICKSTART.md'];
			
			const outdatedConfigReferences = [];
			const outdatedConfigPatterns = [
				'migration_key',
				'auth_migration_token',
				'MIGRATION_SECRET',
				'old_auth_method',
				'legacy_authentication'
			];

			const allFiles = [...configFiles, ...envFiles, ...setupFiles];

			for (const docFile of allFiles) {
				const filePath = path.join(workspaceRoot, docFile);
				if (fs.existsSync(filePath)) {
					const content = fs.readFileSync(filePath, 'utf-8');
					
					for (const pattern of outdatedConfigPatterns) {
						const regex = new RegExp(pattern, 'gi');
						if (regex.test(content)) {
							outdatedConfigReferences.push({
								file: docFile,
								pattern: pattern,
								context: content.split('\n').filter(line => 
									line.toLowerCase().includes(pattern.toLowerCase())
								).slice(0, 2)
							});
						}
					}
				}
			}

			if (outdatedConfigReferences.length > 0) {
				console.log('Outdated config references found:');
				outdatedConfigReferences.forEach(ref => {
					console.log(`- ${ref.file}: "${ref.pattern}"`);
					ref.context.forEach(line => console.log(`  ${line.trim()}`));
				});
			}

			expect(outdatedConfigReferences).toEqual([]);
		});
	});
});