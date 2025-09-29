# Git Worktree Support

Dispatch includes comprehensive git worktree support with automatic project initialization detection and management.

## Overview

Git worktrees allow you to have multiple working directories for a single git repository, each checked out to different branches. This is especially useful for:

- Working on multiple features simultaneously
- Running CI/CD tests on different branches
- Reviewing pull requests without switching branches in your main workspace

## Features

### Automatic Project Detection

When creating a new worktree, Dispatch automatically detects your project type and suggests appropriate initialization commands:

- **Node.js**: `npm install`, `yarn install`, `pnpm install`
- **Python**: `pip install -r requirements.txt`, `pipenv install`, `pip install -e .`
- **Rust**: `cargo build`
- **Go**: `go mod download`
- **Ruby**: `bundle install`
- **PHP**: `composer install`
- **General**: `make install`

### Initialization Script Management

- Automatically detects existing `.dispatchrc` files in the repository root
- When a `.dispatchrc` script exists, executes it directly with the original repository path as the first parameter
- This enables commands like `cp $1/.env .` to copy files from the main repository to the new worktree
- If no `.dispatchrc` exists, falls back to executing individual detected commands
- Allows you to review and edit initialization commands before execution
- Option to save initialization commands as `.dispatchrc` for future worktrees

## Using Git Worktrees in Dispatch

### Accessing Worktree Management

1. Navigate to a git repository in the file browser
2. The git operations toolbar will appear at the bottom
3. Click the worktree icon (📁) to open worktree management

### Creating a New Worktree

1. Click "Add Worktree" button
2. **Set Worktree Path**: Specify where the new working directory should be created
3. **Choose Branch Strategy**:
   - **Existing Branch**: Select from dropdown of existing branches
   - **New Branch**: Check "Create new branch" and enter a name
4. **Initialization Options**:
   - Dispatch will auto-detect your project type and suggest commands
   - Review and edit the suggested initialization commands
   - Choose whether to run initialization during worktree creation
   - Optionally save commands as `.dispatchrc` for future worktrees

### .dispatchrc Script Execution

When you have a `.dispatchrc` file in your repository root, Dispatch will execute it directly instead of running individual commands. The script receives the original repository path as its first parameter (`$1`), enabling operations like:

```bash
#!/bin/bash
# .dispatchrc - worktree initialization script
set -e

# Copy environment file from main repo
cp $1/.env .

# Copy configuration files
cp $1/config/local.json config/

# Install dependencies
npm install

# Run any project-specific setup
npm run setup
```

This approach allows for more sophisticated initialization logic while maintaining access to files from the original repository.

### Managing Existing Worktrees

- **View All Worktrees**: See list of all worktrees with their paths and branches
- **Remove Worktrees**: Click the ❌ button to remove a worktree (with confirmation)

## API Endpoints

### List Worktrees

```
GET /api/git/worktree/list?path=/path/to/repo
```

Response:

```json
{
	"worktrees": [
		{
			"path": "/home/user/project",
			"branch": "main",
			"head": "abc123"
		},
		{
			"path": "/home/user/project-feature",
			"branch": "feature-branch",
			"head": "def456"
		}
	]
}
```

### Add Worktree

```
POST /api/git/worktree/add
Content-Type: application/json

{
  "path": "/path/to/repo",
  "worktreePath": "/path/to/new/worktree",
  "branch": "existing-branch",     // OR
  "newBranch": "new-branch-name",  // create new branch
  "runInit": true,
  "initCommands": ["npm install", "npm run build"]
}
```

### Remove Worktree

```
POST /api/git/worktree/remove
Content-Type: application/json

{
  "path": "/path/to/repo",
  "worktreePath": "/path/to/worktree",
  "force": false
}
```

### Detect Initialization

```
GET /api/git/worktree/init-detect?path=/path/to/repo
```

Response:

```json
{
	"detected": [
		{
			"description": "Node.js project detected",
			"commands": ["npm install"],
			"matched": ["package.json"]
		}
	],
	"suggestedCommands": ["npm install"],
	"hasDispatchrc": false,
	"existingScript": null
}
```

### Save .dispatchrc Script

```
POST /api/git/worktree/init-detect
Content-Type: application/json

{
  "path": "/path/to/repo",
  "commands": ["npm install", "npm run build"]
}
```

## Supported Project Types

| Project Type  | Files Detected     | Default Commands                  |
| ------------- | ------------------ | --------------------------------- |
| Node.js       | `package.json`     | `npm install`                     |
| Yarn          | `yarn.lock`        | `yarn install`                    |
| PNPM          | `pnpm-lock.yaml`   | `pnpm install`                    |
| Python pip    | `requirements.txt` | `pip install -r requirements.txt` |
| Python Pipenv | `Pipfile`          | `pipenv install`                  |
| Python Poetry | `pyproject.toml`   | `pip install -e .`                |
| Ruby          | `Gemfile`          | `bundle install`                  |
| Rust          | `Cargo.toml`       | `cargo build`                     |
| Go            | `go.mod`           | `go mod download`                 |
| Make          | `Makefile`         | `make install`                    |
| PHP           | `composer.json`    | `composer install`                |

## Extension

To add support for additional project types, extend the `INIT_PATTERNS` array in `/src/routes/api/git/worktree/init-detect/+server.js`:

```javascript
{
  files: ['project-file.ext'],
  commands: ['setup-command'],
  description: 'Project type detected'
}
```

## Best Practices

1. **Use Descriptive Paths**: Name worktree directories clearly (e.g., `project-feature-auth`, `project-bugfix-123`)
2. **Clean Up**: Remove worktrees when done to avoid clutter
3. **Review Commands**: Always review auto-detected initialization commands before running
4. **Save .dispatchrc**: For projects with complex setup, save initialization commands as .dispatchrc for consistency
5. **Branch Strategy**: Use meaningful branch names that match your worktree directories

## Troubleshooting

### Worktree Creation Fails

- Ensure the target directory doesn't already exist
- Check that you have write permissions to the target location
- Verify the git repository is accessible and valid

### Initialization Commands Fail

- Review command syntax and dependencies
- Check that required tools are installed (npm, pip, etc.)
- Verify working directory permissions

### Missing Project Detection

- Ensure project files (package.json, etc.) are in the repository root
- Add custom detection patterns if using non-standard project structure

## Security Notes

- Initialization commands run with the same permissions as the Dispatch server
- Always review auto-detected commands before execution
- Be cautious with initialization scripts from untrusted sources
- Consider running Dispatch in a containerized environment for additional security
