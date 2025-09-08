// Resolve the Claude Code projects root (default to ~/.claude/projects)
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
export function projectsRoot() {
  const env = process.env.CLAUDE_PROJECTS_DIR;
  const base = env && env.trim() ? env : join(homedir(), '.claude', 'projects');
  return resolve(base);
}
