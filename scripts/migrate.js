#!/usr/bin/env node

import { dataMigrator } from '../src/lib/server/db/DataMigrator.js';

async function main() {
	console.log('Dispatch Storage Migration');
	console.log('==========================');
	console.log('');
	console.log('This script will migrate existing file-based storage to SQLite.');
	console.log('The database will be created at ~/.dispatch/data');
	console.log('');

	try {
		await dataMigrator.migrate();
		console.log('');
		console.log('✅ Migration completed successfully!');
		console.log('');
		console.log('The SQLite database is now ready at ~/.dispatch/data');
		console.log('All server components will now use SQLite for storage.');
	} catch (error) {
		console.error('');
		console.error('❌ Migration failed:', error.message);
		console.error('');
		console.error('Please check the error details above and try again.');
		process.exit(1);
	}
}

if (process.argv[1].endsWith('migrate.js')) {
	main().catch((error) => {
		console.error('Unexpected error:', error);
		process.exit(1);
	});
}
