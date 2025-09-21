# Dispatch Directory Management

## Overview

Dispatch uses a hierarchical directory structure to provide isolated environments for projects and sessions. This architecture ensures clean separation between system configuration, project assets, and temporary session workspaces.

## Directory Hierarchy

### Configuration Directory (`DISPATCH_CONFIG_DIR`)

**Default**: `~/.config/dispatch` or `/etc/dispatch` (in containerized environments)

The root configuration directory contains system-level settings and metadata. This directory can be configured via the `DISPATCH_CONFIG_DIR` environment variable.

**Structure**:

```
${DISPATCH_CONFIG_DIR}/
├── projects.json         # Global project registry
├── config.json          # System configuration
```

### Projects Directory (`DISPATCH_PROJECTS_DIR`)

**Default**: `~/dispatch-projects` or `/var/lib/dispatch/projects` (in containerized environments)

Contains all project directories. This location can be overridden using Docker volume mounts or the `DISPATCH_PROJECTS_DIR` environment variable. By default, this directory is kept separate from the configuration directory to allow for:

- Independent backup strategies
- Different volume mount points in containers
- Separation of configuration from data
- Compliance with XDG Base Directory specification

### Project Directory Structure

Each project directory serves as an isolated environment with the following organization:

```
project-name/
├── .dispatch/           # System metadata (hidden)
│   ├── project.json    # Project configuration
│   ├── sessions.json   # Session registry
│   └── metadata.json   # Project metadata (owner, tags, created, modified)
├── sessions/           # Temporary session workspaces
│   └── YYYY-MM-DD-HHMMSS-SSS/  # Individual session directories
└── workspace/          # Persistent project files
    ├── repositories/   # Git repositories
    ├── documents/      # Project documentation
    └── assets/         # Other project resources
```

**Key Characteristics**:

- Acts as `HOME` directory for all sessions within the project
- Project name is normalized (lowercase, alphanumeric with hyphens)
- Provides complete isolation between projects
- Contains both persistent (`workspace/`) and temporary (`sessions/`) areas

### Session Directory Structure

Sessions provide isolated working directories for parallel work, similar to Git worktrees.

**Naming Format**: `YYYY-MM-DD-HHMMSS-SSS` (with milliseconds to prevent collisions)

**Example**: `2025-09-01-143052-247`

**Purpose**:

- Default working directory for terminal sessions
- Temporary storage for session-specific work
- Parallel development without affecting other sessions
- Clean workspace for each new session

## Directory Management Features

### Directory Cloning

Dispatch supports cloning directories through the DirectoryBrowser component, available across all session types (terminal, Claude, file-editor).

**Features:**
- **Visual Interface**: Clone button integrated into DirectoryBrowser toolbar
- **Auto-Suggestion**: Automatically suggests target path with "-clone" suffix
- **Validation**: Comprehensive validation preventing dangerous operations
- **Overwrite Control**: Optional overwrite flag for existing targets
- **Security**: Prevents copying directories into themselves or subdirectories

**Usage:**
1. Navigate to the desired directory in the DirectoryBrowser
2. Click the clone directory button in the toolbar
3. Review the auto-populated source path
4. Modify the target path as needed
5. Optionally enable overwrite for existing directories
6. Click "Clone Directory" to execute

**API Endpoint:**
```javascript
POST /api/browse/clone
{
  "sourcePath": "/path/to/source",
  "targetPath": "/path/to/target",
  "overwrite": false  // optional
}
```

**Security Measures:**
- Validates source directory exists and is accessible
- Prevents copying into system directories (/proc, /sys, /dev)
- Blocks copying directory into itself or subdirectories
- Requires explicit overwrite permission for existing targets
- Preserves file permissions and directory structure

### Path Validation & Security

All directory operations include comprehensive validation:

- **Sanitization**: Project names are normalized to prevent directory traversal attacks
- **Boundary Validation**: All paths are verified to remain within expected directories
- **Reserved Names**: System reserved names (e.g., `.dispatch`, `CON`, `PRN` on Windows) are blocked
- **Character Restrictions**: Only alphanumeric characters, hyphens, and underscores allowed in project names
- **Path Length Limits**: Maximum path lengths enforced (255 chars for names, 4096 for full paths)

### Project Metadata

Each project maintains metadata in `.dispatch/metadata.json`:

```json
{
	"id": "uuid-v4",
	"name": "project-name",
	"displayName": "Project Name",
	"description": "Project description",
	"owner": "user@example.com",
	"created": "2025-09-01T10:00:00.000Z",
	"modified": "2025-09-01T14:30:00.000Z",
	"tags": ["development", "client-a"],
	"settings": {
		"defaultShell": "/bin/bash",
		"environment": {}
	}
}
```

### Session Metadata

Sessions are tracked in `.dispatch/sessions.json` with the following information:

```json
{
	"id": "session-uuid",
	"directory": "2025-09-01-143052-247",
	"created": "2025-09-01T14:30:52.247Z",
	"lastAccessed": "2025-09-01T15:45:00.000Z",
	"status": "active",
	"pid": 12345,
	"mode": "claude",
	"metadata": {
		"purpose": "Feature development",
		"branch": "feature/new-ui"
	}
}
```

## Search & Discovery

### Project Discovery

Projects can be discovered and filtered using:

- **Tags**: Categorical organization
- **Modified Date**: Recent activity tracking
- **Full-text Search**: Search in project names and descriptions

### Session Discovery

Sessions support:

- **Chronological Listing**: Most recent first
- **Status Filtering**: Active, idle, terminated
- **Date Range Queries**: Find sessions from specific periods
- **Metadata Search**: Search by purpose or custom metadata

## Environment Variables

| Variable                | Description                  | Default                                               |
| ----------------------- | ---------------------------- | ----------------------------------------------------- |
| `DISPATCH_CONFIG_DIR`   | Root configuration directory | `~/.config/dispatch` or `/etc/dispatch`               |
| `DISPATCH_PROJECTS_DIR` | Projects storage directory   | `~/dispatch-projects` or `/var/lib/dispatch/projects` |

## Implementation Examples

### Creating a New Project

```javascript
// Normalize project name
const normalizedName = projectName
	.toLowerCase()
	.replace(/[^a-z0-9-]/g, '-')
	.replace(/-+/g, '-')
	.substring(0, 63);

// Validate against reserved names
if (RESERVED_NAMES.includes(normalizedName)) {
	throw new Error(`Project name "${normalizedName}" is reserved`);
}

// Create project structure
const projectPath = path.join(PROJECTS_DIR, normalizedName);
await fs.mkdir(path.join(projectPath, '.dispatch'), { recursive: true });
await fs.mkdir(path.join(projectPath, 'sessions'), { recursive: true });
await fs.mkdir(path.join(projectPath, 'workspace'), { recursive: true });
```

### Creating a New Session

```javascript
// Generate timestamp with milliseconds
const now = new Date();
const timestamp = now
	.toISOString()
	.replace(/[T:]/g, '-')
	.replace(/\..+/, '')
	.concat(`-${now.getMilliseconds().toString().padStart(3, '0')}`);

// Create session directory
const sessionPath = path.join(projectPath, 'sessions', timestamp);
await fs.mkdir(sessionPath, { recursive: true });

// Register session
const sessionData = {
	id: uuidv4(),
	directory: timestamp,
	created: now.toISOString(),
	status: 'active'
};
```

## Best Practices

1. **Project Naming**: Use descriptive, URL-safe names (e.g., `client-website`, `internal-api`)
2. **Session Cleanup**: Regularly clean old sessions to manage disk space
3. **Workspace Organization**: Keep persistent files in `workspace/`, temporary files in `sessions/`
4. **Metadata Management**: Keep metadata files updated for accurate tracking
5. **Path Validation**: Always validate and sanitize user-provided paths
6. **Isolation Enforcement**: Respect project boundaries in multi-tenant environments

## Troubleshooting

### Common Issues

**Session Creation Fails**

- Check disk space availability
- Verify write permissions on project directory
- Ensure project name is valid and normalized

**Project Not Found**

- Verify `DISPATCH_PROJECTS_DIR` is correctly set
- Check if project directory exists and has proper structure
- Validate project name normalization

**Path Traversal Attempts**

- Review sanitization logic
- Check for proper boundary validation
- Ensure all user inputs are validated

### Debugging

Enable debug logging for directory operations:

```bash
export DISPATCH_LOG_LEVEL=debug
```

Check directory structure integrity:

```bash
find ${DISPATCH_CONFIG_DIR} -type d -name ".dispatch" -exec ls -la {} \;
```
