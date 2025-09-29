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

### Workspaces Directory (`WORKSPACES_ROOT`)

**Default**: `/workspace` (in Docker) or `~/.dispatch-home/workspaces` (locally)

This directory contains all user workspaces (projects). The location can be overridden using Docker volume mounts or the `WORKSPACES_ROOT` environment variable. By default, this directory is kept separate from the configuration directory to allow for:

- Independent backup strategies
- Different volume mount points in containers
- Separation of configuration from data
- Compliance with XDG Base Directory specification

### Workspace Directory Structure

Each workspace is a directory under `WORKSPACES_ROOT` and serves as an isolated environment for user projects. All metadata (name, status, session info, etc.) is stored in the central SQLite database, not in per-workspace JSON files.

```
/workspace/
├── example-project/      # User workspace directory (project)
│   ├── ...user files...
│   └── ...
├── another-project/
│   └── ...
└── ...
```

**Key Characteristics**:

- Each workspace is a top-level directory under `WORKSPACES_ROOT`
- All workspace/project/session metadata is managed in the SQLite database (`workspaces`, `sessions`, `session_events` tables)
- No `.dispatch/`, `project.json`, `sessions.json`, or `metadata.json` files are created per workspace
- Workspace names are derived from directory names and validated for safety

### Session Management

Sessions are tracked and managed in the SQLite database. Each session is associated with a workspace path and has its own metadata (status, type, timestamps, etc.). There are no per-session directories or files by default; all session state is event-sourced in the database.

**Purpose**:

- Track and manage parallel terminal, Claude, and file-editor sessions per workspace
- Store session metadata, status, and event history centrally
- Enable session discovery, filtering, and replay via database queries

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

### Workspace Metadata

All workspace/project metadata is stored in the `workspaces` table in the SQLite database. Example fields:

```
{
  "path": "/workspace/example-project",
  "name": "Example Project",
  "created_at": 1693555200000,
  "updated_at": 1693558800000,
  "last_active": 1693562400000,
  "status": "active"
}
```

### Session Metadata

Sessions are tracked in the `sessions` and `session_events` tables in the SQLite database. Example session fields:

```
{
  "run_id": "session-uuid",
  "kind": "pty" | "claude" | "file-editor",
  "status": "running" | "stopped" | "error",
  "created_at": 1693555200000,
  "updated_at": 1693558800000,
  "meta_json": {
    "workspacePath": "/workspace/example-project",
    "shell": "/bin/bash",
    ...
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

| Variable              | Description                  | Default                                                |
| --------------------- | ---------------------------- | ------------------------------------------------------ |
| `DISPATCH_CONFIG_DIR` | Root configuration directory | `~/.config/dispatch` or `/etc/dispatch`                |
| `WORKSPACES_ROOT`     | Workspaces/projects root dir | `/workspace` (Docker) or `~/.dispatch-home/workspaces` |

## Implementation Examples

### Creating a New Workspace

```javascript
// Validate workspace path (must be absolute, under WORKSPACES_ROOT, no traversal)
const workspaceRoot = process.env.WORKSPACES_ROOT || '/workspace';
const workspacePath = path.join(workspaceRoot, 'example-project');
if (!workspacePath.startsWith(workspaceRoot)) {
	throw new Error('Workspace path must be within WORKSPACES_ROOT');
}
// Create workspace directory
await fs.mkdir(workspacePath, { recursive: true });
// Register workspace in database
await database.createWorkspace(workspacePath, 'Example Project');
```

### Creating a New Session

```javascript
// Create a new session for a workspace (database-driven)
const runId = uuidv4();
const workspacePath = '/workspace/example-project';
const meta = { workspacePath, shell: '/bin/bash' };
await database.createRunSession(runId, 'pty', meta);
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

**Workspace Not Found**

- Verify `WORKSPACES_ROOT` is correctly set
- Check if workspace directory exists and is registered in the database
- Validate workspace path and name

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
