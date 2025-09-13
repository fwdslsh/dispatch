import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { databaseManager } from './DatabaseManager.js';

/**
 * Data migration utility to convert existing file-based storage to SQLite
 */
export class DataMigrator {
	constructor() {
		this.homeDir = process.env.HOME || homedir();
		this.dispatchDir = join(this.homeDir, '.dispatch');
		this.historyDir = join(this.dispatchDir, 'history');
	}

	/**
	 * Run all migrations
	 */
	async migrate() {
		console.log('[MIGRATION] Starting data migration to SQLite...');

		// Initialize database first
		await databaseManager.init();

		try {
			await this.migrateHistoryFiles();
			await this.migrateWorkspaceIndex();
			await this.migrateTerminalHistory();
			console.log('[MIGRATION] Migration completed successfully');
		} catch (error) {
			console.error('[MIGRATION] Migration failed:', error);
			throw error;
		}
	}

	/**
	 * Migrate history files from ~/.dispatch/history/*.json
	 */
	async migrateHistoryFiles() {
		console.log('[MIGRATION] Migrating history files...');

		try {
			const files = await fs.readdir(this.historyDir);
			let migratedCount = 0;

			for (const file of files) {
				if (file.endsWith('.json')) {
					const socketId = file.replace('.json', '');
					const filePath = join(this.historyDir, file);

					try {
						const content = await fs.readFile(filePath, 'utf-8');
						if (!content.trim()) continue;

						const historyData = JSON.parse(content);

						// Create session record
						await databaseManager.createSession(socketId, socketId, historyData.metadata || {});

						// Migrate events
						if (historyData.events && Array.isArray(historyData.events)) {
							for (const event of historyData.events) {
								await databaseManager.addSessionEvent(
									socketId,
									socketId,
									event.type,
									event.direction || 'unknown',
									event.data
								);
							}
						}

						migratedCount++;
						console.log(
							`[MIGRATION] Migrated history for socket ${socketId} (${historyData.events?.length || 0} events)`
						);
					} catch (error) {
						console.warn(`[MIGRATION] Failed to migrate history file ${file}:`, error.message);
					}
				}
			}

			console.log(`[MIGRATION] Migrated ${migratedCount} history files`);
		} catch (error) {
			if (error.code === 'ENOENT') {
				console.log('[MIGRATION] No history directory found, skipping history migration');
			} else {
				throw error;
			}
		}
	}

	/**
	 * Migrate workspace index files - scan for common locations
	 */
	async migrateWorkspaceIndex() {
		console.log('[MIGRATION] Migrating workspace data...');

		const candidatePaths = [
			join(this.dispatchDir, 'workspaces.json'),
			join(this.dispatchDir, 'index.json'),
			join(process.cwd(), '.dispatch-home', 'workspaces.json'),
			join(process.cwd(), '.dispatch-home', 'index.json')
		];

		let migratedCount = 0;

		for (const indexPath of candidatePaths) {
			try {
				const content = await fs.readFile(indexPath, 'utf-8');
				if (!content.trim()) continue;

				const workspaceData = JSON.parse(content);

				if (workspaceData.workspaces && typeof workspaceData.workspaces === 'object') {
					for (const [workspacePath, workspace] of Object.entries(workspaceData.workspaces)) {
						// Create workspace record
						await databaseManager.createWorkspace(workspacePath);

						// Update activity time if available
						if (workspace.lastActive) {
							await databaseManager.updateWorkspaceActivity(workspacePath);
						}

						// Migrate sessions
						if (workspace.sessions && Array.isArray(workspace.sessions)) {
							for (const session of workspace.sessions) {
								if (session.id) {
									// Determine session type and type-specific ID
									let sessionType = 'unknown';
									let typeSpecificId = session.id;

									if (session.id.startsWith('claude_')) {
										sessionType = 'claude';
										typeSpecificId = session.id.replace(/^claude_/, '');
									} else if (session.id.startsWith('pty_')) {
										sessionType = 'pty';
									}

									await databaseManager.addWorkspaceSession(
										session.id,
										workspacePath,
										sessionType,
										typeSpecificId,
										session.title || session.name || 'Untitled Session'
									);
								}
							}
						}
					}

					migratedCount++;
					console.log(
						`[MIGRATION] Migrated workspace data from ${indexPath} (${Object.keys(workspaceData.workspaces).length} workspaces)`
					);
					break; // Only migrate the first found index file
				}
			} catch (error) {
				if (error.code !== 'ENOENT') {
					console.warn(
						`[MIGRATION] Failed to migrate workspace index from ${indexPath}:`,
						error.message
					);
				}
			}
		}

		if (migratedCount === 0) {
			console.log('[MIGRATION] No workspace index files found, skipping workspace migration');
		}
	}

	/**
	 * Migrate terminal history files
	 */
	async migrateTerminalHistory() {
		console.log('[MIGRATION] Migrating terminal history...');

		const terminalHistoryDirs = [
			process.env.TERMINAL_HISTORY_DIR,
			join(process.env.TMPDIR || '/tmp', 'dispatch-terminal-history'),
			join(this.dispatchDir, 'terminal-history')
		].filter(Boolean);

		let migratedCount = 0;

		for (const historyDir of terminalHistoryDirs) {
			try {
				const files = await fs.readdir(historyDir);

				for (const file of files) {
					if (file.endsWith('.log')) {
						const terminalId = file.replace('.log', '');
						const filePath = join(historyDir, file);

						try {
							const content = await fs.readFile(filePath, 'utf-8');
							if (content.trim()) {
								// Store the entire log content as a single entry
								await databaseManager.addTerminalHistory(terminalId, content);
								migratedCount++;
								console.log(
									`[MIGRATION] Migrated terminal history for ${terminalId} (${content.length} bytes)`
								);
							}
						} catch (error) {
							console.warn(
								`[MIGRATION] Failed to migrate terminal history ${file}:`,
								error.message
							);
						}
					}
				}

				if (migratedCount > 0) {
					break; // Only migrate from the first found directory
				}
			} catch (error) {
				if (error.code !== 'ENOENT') {
					console.warn(
						`[MIGRATION] Failed to access terminal history directory ${historyDir}:`,
						error.message
					);
				}
			}
		}

		if (migratedCount === 0) {
			console.log(
				'[MIGRATION] No terminal history files found, skipping terminal history migration'
			);
		} else {
			console.log(`[MIGRATION] Migrated ${migratedCount} terminal history files`);
		}
	}

	/**
	 * Backup existing files before migration
	 */
	async backupExistingData() {
		const backupDir = join(this.dispatchDir, 'backup-' + Date.now());
		await fs.mkdir(backupDir, { recursive: true });

		const filesToBackup = [
			this.historyDir,
			join(this.dispatchDir, 'workspaces.json'),
			join(this.dispatchDir, 'index.json')
		];

		for (const filePath of filesToBackup) {
			try {
				const stat = await fs.stat(filePath);
				if (stat.isDirectory()) {
					await fs.cp(filePath, join(backupDir, 'history'), { recursive: true });
				} else {
					await fs.copyFile(filePath, join(backupDir, basename(filePath)));
				}
				console.log(`[MIGRATION] Backed up ${filePath} to ${backupDir}`);
			} catch (error) {
				// File doesn't exist, ignore
			}
		}

		return backupDir;
	}
}

export const dataMigrator = new DataMigrator();
