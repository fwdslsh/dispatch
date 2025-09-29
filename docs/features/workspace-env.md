# Workspace Environment Variables

Dispatch now supports workspace-level environment variable management that applies to all session types.

## Overview

Workspace environment variables allow you to define environment variables that will be automatically available in all sessions (PTY, Claude, File Editor) within your workspace. This feature is particularly useful for setting common configuration values like `NODE_ENV`, `API_KEY`, or `DEBUG` flags that should be consistent across all your development sessions.

## Features

- **Universal Application**: Environment variables are applied to all session types
- **Proper Precedence**: Session-specific variables override workspace variables, which override system variables
- **Persistent Storage**: Settings are saved to the database and persist across restarts
- **User-Friendly Interface**: Clean key/value editing interface in the settings modal
- **Validation**: Environment variable names are validated to ensure they're valid identifiers

## Environment Variable Precedence

The system applies environment variables in the following priority order:

1. **Session-specific environment variables** (highest priority)
2. **Workspace environment variables** (medium priority)
3. **System environment variables** (lowest priority)

This means that workspace environment variables can provide defaults, but individual sessions can override them when needed.

## Usage

### Setting Workspace Environment Variables

1. Open the Dispatch workspace
2. Click the settings icon in the bottom toolbar
3. Navigate to the "Environment" tab
4. Add your environment variables using the key/value interface
5. Click "Save Changes"

### Example Variables

Common workspace environment variables include:

- `NODE_ENV=development` - Set the Node.js environment
- `API_KEY=your-api-key` - API keys for development
- `DEBUG=app:*` - Debug logging configuration
- `DATABASE_URL=postgresql://localhost/mydb` - Database connection strings

### Validation

Environment variable names must:

- Start with a letter or underscore
- Contain only letters, numbers, and underscores
- Follow standard environment variable naming conventions

Invalid names (starting with numbers, containing spaces or special characters) will be rejected.

## API

### REST Endpoints

#### Get Workspace Environment Variables

```
GET /api/settings/workspace
```

Returns the current workspace environment variables.

#### Set Workspace Environment Variables

```
POST /api/settings/workspace
Content-Type: application/json

{
  "envVariables": {
    "NODE_ENV": "development",
    "API_KEY": "test-key-123"
  }
}
```

#### Clear Workspace Environment Variables

```
DELETE /api/settings/workspace
```

### Programmatic Usage

```javascript
import { getWorkspaceEnvVariables } from '$lib/server/shared/utils/env.js';

// Get workspace environment variables
const workspaceEnv = await getWorkspaceEnvVariables(database);

// Use in session creation
const sessionOptions = {
	cwd: '/workspace',
	workspaceEnv: workspaceEnv,
	extraEnv: { SESSION_ID: 'abc123' }
};
```

## Implementation Details

### Database Storage

Workspace environment variables are stored in the `settings` table under the `workspace` category:

```sql
INSERT INTO settings (category, settings_json, description)
VALUES (
  'workspace',
  '{"envVariables": {"NODE_ENV": "development"}}',
  'Workspace-level environment variables for all sessions'
);
```

### Session Integration

When creating any session type, the system:

1. Loads workspace environment variables from the database
2. Merges them with system environment variables
3. Applies session-specific overrides
4. Passes the final environment to the session adapter

### Adapters Support

All session adapters support workspace environment variables:

- **PTY Adapter**: Applied to terminal shell environment
- **Claude Adapter**: Applied to Claude Code execution environment
- **File Editor Adapter**: Available for file operations (though not directly used)

## Backward Compatibility

This feature is fully backward compatible. Existing sessions and configurations will continue to work unchanged. Workspace environment variables are only applied when they are explicitly configured.

## Security Considerations

- Environment variables are stored in the local database
- No credentials or sensitive data should be committed to version control
- Use secure storage mechanisms for production API keys and secrets
- Workspace environment variables are visible to all sessions in the workspace

## Troubleshooting

### Environment Variables Not Applied

1. Check that variables are saved successfully (look for success message)
2. Verify variable names follow valid identifier rules
3. Create a new session to see the changes (existing sessions won't be affected)
4. Check browser console for any errors during save

### Validation Errors

Environment variable names must be valid identifiers:

- ✅ `NODE_ENV`, `API_KEY`, `_PRIVATE`
- ❌ `123_VAR` (starts with number), `MY-VAR` (contains hyphen), `MY VAR` (contains space)

### Testing Variables

You can test workspace environment variables by creating a terminal session and running:

```bash
echo "NODE_ENV: $NODE_ENV"
env | grep YOUR_VARIABLE_NAME
```
