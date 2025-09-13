// Resolve the Claude Code projects root (default to ~/.claude/projects)
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
export function projectsRoot() {
	const env = process.env.CLAUDE_PROJECTS_DIR;
	const base = env && env.trim() ? env : join(homedir(), '.claude', 'projects');

	// Ensure the directory exists
	if (!base) throw new Error('Could not determine projects root directory');
	if (!existsSync(base)) mkdirSync(base, { recursive: true });

	return resolve(base);
}
