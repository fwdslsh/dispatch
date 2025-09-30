# Data Model: Settings and Configuration Normalization (Simplified)

## Overview

The settings system uses a simple normalized structure with categories and key-value pairs. Designed for single-user development environments with focus on reliability and performance.

## Core Entities

### SettingsCategory

Logical grouping of related configuration settings.

```typescript
interface SettingsCategory {
	id: string; // Unique identifier (e.g., "authentication", "workspace")
	name: string; // Display name (e.g., "Authentication", "Workspace")
	description: string; // Category description
	order: number; // Display order in UI
}
```

**Categories**:

1. **authentication** - Terminal key, OAuth configuration
2. **workspace** - Paths, environment variables
3. **network** - SSL, tunnel configuration
4. **ui** - Theme, display preferences

### ConfigurationSetting

Individual configuration parameter with essential metadata.

```typescript
interface ConfigurationSetting {
	key: string; // Setting key (e.g., "terminal_key", "oauth_client_id")
	category_id: string; // Foreign key to SettingsCategory
	name: string; // Display name
	description: string; // User-facing description
	type: SettingType; // Data type (string, number, boolean, url)
	current_value: string | null; // Current value as string
	default_value: string | null; // Default value as string
	env_var_name: string | null; // Environment variable name if applicable
	is_sensitive: boolean; // Whether to mask in UI
	is_required: boolean; // Whether setting is required
	validation_pattern: string | null; // Simple regex pattern for validation
}
```

### SettingType Enum

```typescript
enum SettingType {
	STRING = 'string',
	NUMBER = 'number',
	BOOLEAN = 'boolean',
	URL = 'url',
	PATH = 'path'
}
```

## Database Schema

### SQLite Tables

```sql
-- Settings categories
CREATE TABLE settings_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- Individual configuration settings
CREATE TABLE configuration_settings (
  key TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('string', 'number', 'boolean', 'url', 'path')),
  current_value TEXT,
  default_value TEXT,
  env_var_name TEXT,
  is_sensitive BOOLEAN DEFAULT FALSE,
  is_required BOOLEAN DEFAULT FALSE,
  validation_pattern TEXT,
  FOREIGN KEY (category_id) REFERENCES settings_categories(id)
);

-- Index for performance
CREATE INDEX idx_settings_category ON configuration_settings(category_id);
```

## Value Resolution Hierarchy

Settings values are resolved in the following priority order:

1. **UI Configuration** (`current_value` in database)
2. **Environment Variable** (`process.env[env_var_name]`)
3. **Default Value** (`default_value` in database)

```typescript
function resolveSettingValue(setting: ConfigurationSetting): string | null {
	// 1. Check UI-configured value
	if (setting.current_value) {
		return setting.current_value;
	}

	// 2. Check environment variable
	if (setting.env_var_name && process.env[setting.env_var_name]) {
		return process.env[setting.env_var_name];
	}

	// 3. Use default value
	return setting.default_value || null;
}
```

## Essential Settings

### Authentication Category

- **terminal_key**: Terminal authentication key (TERMINAL_KEY env var)
  - Required, sensitive, minimum 8 characters
- **oauth_client_id**: OAuth client identifier (optional)
- **oauth_client_secret**: OAuth client secret (optional, sensitive)
- **oauth_redirect_uri**: OAuth redirect URI (optional)

### Workspace Category

- **workspaces_root**: Root directory for workspaces (WORKSPACES_ROOT env var)
  - Default: `/workspace`, must be absolute path

### Network Category

- **ssl_enabled**: Enable SSL/HTTPS (SSL_ENABLED env var)
- **enable_tunnel**: Enable LocalTunnel for public access (ENABLE_TUNNEL env var)

### UI Category

- **theme**: UI theme preference (light/dark/auto)
- **show_workspace_in_title**: Display workspace name in browser title

## State Management (Svelte 5)

### SettingsViewModel

```typescript
class SettingsViewModel {
	categories = $state<SettingsCategory[]>([]);
	settings = $state<ConfigurationSetting[]>([]);
	loading = $state<boolean>(false);
	error = $state<string | null>(null);

	// Derived state
	settingsByCategory = $derived.by(() => {
		return this.categories.map((category) => ({
			...category,
			settings: this.settings.filter((s) => s.category_id === category.id)
		}));
	});

	// Methods
	async loadSettings(): Promise<void> {
		/* Load from API */
	}
	async updateSetting(key: string, value: string): Promise<void> {
		/* Update via API */
	}
	getSettingValue(key: string): string | null {
		/* Get resolved value */
	}
}
```

## Simple Validation

### Basic Validation Function

```typescript
function validateSetting(key: string, value: string, pattern?: string): boolean {
	if (!value && isRequired(key)) {
		return false;
	}

	if (pattern && !new RegExp(pattern).test(value)) {
		return false;
	}

	// Special cases
	if (key === 'terminal_key' && value.length < 8) {
		return false;
	}

	return true;
}
```

## Database Initialization

The system will automatically initialize the database on first startup:

1. Create tables if they don't exist
2. Insert default categories (authentication, workspace, network, ui)
3. Insert essential settings with environment variable mappings
4. No migration needed - clean recreation approach

This simplified model provides essential settings management for single-user development environments while maintaining reliability and performance.
