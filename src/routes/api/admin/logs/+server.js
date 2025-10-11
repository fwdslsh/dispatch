import { json } from '@sveltejs/kit';

export async function GET({ url, locals }) {
	// NOTE: Database-persisted logging was removed during architecture refactoring.
	// The application now uses console-based logging via logger utility.
	// This endpoint returns an empty array to maintain API contract compatibility
	// with the admin console UI at /console.
	//
	// Query params preserved for potential future implementation:
	// - limit: Max number of logs (default 100, max 1000)
	// - level: Filter by log level
	// - component: Filter by component name

	return json({ logs: [] });
}
