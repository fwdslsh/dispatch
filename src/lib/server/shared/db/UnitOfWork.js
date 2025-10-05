import { logger } from '../utils/logger.js';

export class UnitOfWork {
	constructor(database) {
		this.database = database;
	}

	async withTransaction(work) {
		await this.database.waitForWrites();
		await this.database.run('BEGIN IMMEDIATE');
		try {
			const context = {
				run: (sql, params = []) => this.database.run(sql, params),
				get: (sql, params = []) => this.database.get(sql, params),
				all: (sql, params = []) => this.database.all(sql, params),
				repositories: {
					sessions: this.database.sessions,
					events: this.database.eventStore,
					settings: this.database.settings,
					users: this.database.users
				}
			};
			const result = await work(context);
			await this.database.run('COMMIT');
			return result;
		} catch (error) {
			try {
				await this.database.run('ROLLBACK');
			} catch (rollbackError) {
				logger.error('DATABASE', 'Failed to rollback transaction', rollbackError);
			}
			throw error;
		}
	}
}
