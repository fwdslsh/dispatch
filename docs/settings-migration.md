# Settings System Migration Guide

**Feature**: Settings and Configuration Normalization
**Target Audience**: Developers working on Dispatch codebase
**Last Updated**: September 2025

## Overview

This document explains the new normalized settings system implemented in Dispatch, replacing the previous fragmented approach. The system provides:

- **Centralized Configuration**: All settings managed through SQLite database
- **Priority Hierarchy**: UI > Environment Variables > Defaults
- **Type Safety**: Validated setting types with runtime checks
- **Real-time Updates**: Socket.IO events for instant synchronization
- **MVVM Architecture**: Clean separation of concerns in frontend

## Architecture

### Database Schema

The system uses two core tables:

```sql
-- Categories for organizing settings
CREATE TABLE settings_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- Individual settings with metadata
CREATE TABLE configuration_settings (
  key TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('string', 'number', 'boolean', 'url', 'path')),
  current_value TEXT,           -- User-configured value (UI)
  default_value TEXT,            -- System default
  env_var_name TEXT,             -- Environment variable fallback
  is_sensitive BOOLEAN DEFAULT FALSE,
  is_required BOOLEAN DEFAULT FALSE,
  validation_pattern TEXT,
  FOREIGN KEY (category_id) REFERENCES settings_categories(id)
);

-- Performance index
CREATE INDEX idx_settings_category ON configuration_settings(category_id);
```

### Backend Components

#### SettingsManager (`src/lib/server/settings/SettingsManager.js`)

Central service for all settings operations:

```javascript
class SettingsManager {
  // Retrieve all settings organized by category
  async getSettingsByCategory()

  // Get settings for specific category
  async getSettings(categoryId)

  // Get single setting by key
  async getSetting(key)

  // Update multiple settings in a category
  async updateCategorySettings(categoryId, settings)

  // Get authentication configuration
  async getAuthConfig()

  // Cache management
  invalidateCache()
}
```

**Usage Example**:
```javascript
const settingsManager = new SettingsManager('./dispatch.db');
await settingsManager.initialize();

// Get authentication settings
const authSettings = await settingsManager.getSettings('authentication');

// Update terminal key
await settingsManager.updateCategorySettings('authentication', {
  terminal_key: 'new-secure-key-12345'
});
```

#### ValueResolver (`src/lib/server/settings/ValueResolver.js`)

Implements the priority hierarchy (UI > Env > Default):

```javascript
class ValueResolver {
  // Resolve setting value following priority hierarchy
  resolveValue(setting)

  // Resolve by key
  async resolveSettingValue(key)

  // Detect conflicts between sources
  async checkValueConflicts(categoryId)

  // Get recommendations for resolving conflicts
  async getResolutionRecommendations(categoryId)
}
```

**Priority Logic**:
1. If `current_value` exists, use it (UI configuration)
2. Else if environment variable exists, use it
3. Else use `default_value`

#### SettingsValidator (`src/lib/server/settings/SettingsValidator.js`)

Validates setting values:

```javascript
class SettingsValidator {
  // Validate a single setting
  validateSetting(setting, value)

  // Validate batch of settings
  validateBatch(settings, values)

  // Check authentication strength
  validateTerminalKey(key)
}
```

#### SettingsEventBroadcaster (`src/lib/server/settings/SettingsEventBroadcaster.js`)

Real-time event notification:

```javascript
class SettingsEventBroadcaster {
  // Notify all clients of settings update
  broadcastSettingsUpdate(categoryId, updatedSettings, metadata)

  // Notify authentication changes
  broadcastAuthInvalidation(reason, affectedSettings)

  // Trigger full reload
  broadcastFullReload(reason)
}
```

### Frontend Components

#### SettingsViewModel (`src/lib/client/settings/SettingsViewModel.svelte.js`)

Reactive state management using Svelte 5 runes:

```javascript
class SettingsViewModel {
  // $state runes for reactivity
  settingsByCategory = $state([]);
  pendingChanges = $state({});
  validationErrors = $state({});
  saving = $state(false);

  // $derived computed properties
  hasValidationErrors = $derived.by(() =>
    Object.keys(this.validationErrors).length > 0
  );

  // Methods
  async loadSettings()
  updateSetting(key, value)
  async saveCategory(categoryId)
  discardSetting(key)
  categoryHasChanges(categoryId)
}
```

**Usage in Components**:
```svelte
<script>
  import { SettingsViewModel } from './SettingsViewModel.svelte.js';

  let { settingsViewModel } = $props();

  // Reactive values
  let terminalKey = $derived(
    settingsViewModel.getCurrentValue('terminal_key')
  );

  let hasChanges = $derived(
    settingsViewModel.categoryHasChanges('authentication')
  );
</script>

<input
  bind:value={terminalKey}
  on:input={(e) => settingsViewModel.updateSetting('terminal_key', e.target.value)}
/>

{#if hasChanges}
  <button on:click={() => settingsViewModel.saveCategory('authentication')}>
    Save Changes
  </button>
{/if}
```

#### SettingsService (`src/lib/client/shared/services/SettingsService.svelte.js`)

API client with real-time updates:

```javascript
export function createSettingsService(authKey, baseUrl = '', socketService = null) {
  return {
    // API methods
    async getAllSettings()
    async getCategorySettings(categoryId)
    async updateCategorySettings(categoryId, settings)
    async getAuthConfig()

    // Real-time event handling
    setupRealTimeUpdates()
    teardownRealTimeUpdates()
  };
}
```

### API Endpoints

#### GET /api/settings

Retrieve all settings organized by category:

```bash
curl "http://localhost:3030/api/settings?authKey=YOUR_KEY"
```

Response:
```json
{
  "categories": [
    {
      "id": "authentication",
      "name": "Authentication",
      "settings": [
        {
          "key": "terminal_key",
          "name": "Terminal Key",
          "type": "string",
          "current_value": "***",
          "default_value": "change-me",
          "env_var_name": "TERMINAL_KEY",
          "is_sensitive": true,
          "is_required": true
        }
      ]
    }
  ]
}
```

#### PUT /api/settings/{category}

Update settings in a category:

```bash
curl -X PUT "http://localhost:3030/api/settings/authentication" \
  -H "Content-Type: application/json" \
  -d '{
    "authKey": "YOUR_KEY",
    "settings": {
      "terminal_key": "new-secure-key-12345"
    }
  }'
```

Response:
```json
{
  "success": true,
  "updated_count": 1,
  "session_invalidated": true
}
```

#### GET /api/auth/config

Get authentication configuration status:

```bash
curl "http://localhost:3030/api/auth/config?authKey=YOUR_KEY"
```

Response:
```json
{
  "terminal_key_set": true,
  "oauth_configured": false,
  "authentication_methods": ["terminal_key"]
}
```

## Migration Steps

### For Developers Adding New Settings

1. **Add setting to schema** (`src/lib/server/settings/schema.sql`):
```sql
INSERT INTO configuration_settings (
  key, category_id, name, description, type,
  default_value, env_var_name, is_sensitive, is_required, validation_pattern
) VALUES
  ('my_new_setting', 'workspace', 'My New Setting', 'Description here', 'string',
   'default_value', 'MY_NEW_SETTING', FALSE, FALSE, NULL);
```

2. **Add validation if needed** (`SettingsValidator.js`):
```javascript
this.customValidators.set('my_new_setting', (value) => {
  if (!value || value.length < 5) {
    return ['Setting must be at least 5 characters'];
  }
  return [];
});
```

3. **Add to ViewModel if needed** (`SettingsViewModel.svelte.js`):
```javascript
myNewSetting = $derived.by(() => {
  return this.settingsByCategory
    .find(cat => cat.id === 'workspace')
    ?.settings.find(s => s.key === 'my_new_setting');
});
```

4. **Update UI components** as needed

5. **Write tests**:
   - Unit test in `tests/unit/server/settings/`
   - Component test in `tests/unit/client/settings/`
   - Integration test in `tests/integration/`

### Accessing Settings in Code

#### Server-side

```javascript
// In API routes or server code
import { SettingsManager } from '$lib/server/settings/SettingsManager.js';

const settingsManager = new SettingsManager('./dispatch.db');
await settingsManager.initialize();

// Get specific setting
const workspacesRoot = await settingsManager.getSetting('workspaces_root');
const resolvedValue = workspacesRoot.getResolvedValue();

// Get category settings
const authSettings = await settingsManager.getSettings('authentication');
```

#### Client-side

```svelte
<script>
  import { getContext } from 'svelte';

  const serviceContainer = getContext('services');

  let settingsService = $state(null);

  $effect(async () => {
    settingsService = await serviceContainer.get('settingsService');
    await settingsService.loadAllSettings();
  });

  // Use settings
  let currentValue = $derived(
    settingsService?.getCurrentValue('my_setting')
  );
</script>
```

## Real-Time Updates

Settings changes are automatically broadcast to all connected clients via Socket.IO:

### Events

1. **`settings.updated`**: General notification that settings changed
2. **`settings.category.updated`**: Specific category updated with new data
3. **`settings.auth.invalidated`**: Authentication settings changed, sessions invalidated

### Client Handling

```javascript
// Automatic handling in SettingsService
settingsService.setupRealTimeUpdates();

// Custom handling
socket.on('settings.category.updated', async (data) => {
  console.log('Settings updated:', data.categoryId);
  await settingsViewModel.loadSettings();
});

socket.on('settings.auth.invalidated', (data) => {
  console.warn('Re-authentication required:', data.reason);
  // Handle session invalidation
});
```

## Performance Considerations

### Caching

- **SettingsManager**: 5-minute TTL cache for settings queries
- **ValueResolver**: 1-minute TTL cache for value resolution
- Cache invalidation on updates

### Database Optimization

Run periodic optimization:

```bash
sqlite3 dispatch.db < src/lib/server/settings/optimize-database.sql
```

This script:
- Enables WAL mode for better concurrency
- Runs ANALYZE for query optimization
- Verifies foreign key integrity
- Shows index usage statistics

### Performance Targets

- GET /api/settings: **<25ms** average
- PUT /api/settings/{category}: **<50ms** average
- UI state updates: **<10ms** average
- Value resolution: **<5ms** with caching

## Testing

### Running Tests

```bash
# All settings tests
npm test -- tests/unit/server/settings/
npm test -- tests/unit/client/settings/
npm test -- tests/integration/quickstart-validation.test.js

# Performance validation
npm test -- tests/performance/settings-performance.test.js
```

### Test Coverage

- **Unit tests**: SettingsValidator, ValueResolver, ConfigurationSetting
- **Component tests**: AuthenticationSettings, GlobalSettings
- **Integration tests**: Full quickstart scenarios
- **Performance tests**: API response times, concurrent operations

## Troubleshooting

### Common Issues

**Settings not updating in UI:**
- Check browser console for Socket.IO connection errors
- Verify `realTimeUpdates` is enabled in SettingsService
- Check Network tab for failed API requests

**Environment variable not taking effect:**
- Verify priority hierarchy (UI > Env > Default)
- Check if `current_value` is set (overrides env var)
- Use ValueResolver to check actual resolution

**Performance degradation:**
- Run database optimization script
- Check cache effectiveness in logs
- Verify indexes are being used (EXPLAIN QUERY PLAN)

### Debug Mode

Enable debug logging:

```bash
DEBUG=settings:* npm run dev
```

## Security Considerations

### Sensitive Values

- Marked with `is_sensitive: true` in database
- Masked in API responses as `***`
- Never logged to console or files
- Password input type in UI

### Authentication

- All endpoints require `authKey` parameter
- Terminal key minimum 8 characters (validated)
- OAuth credentials never exposed in API responses
- Session invalidation on authentication changes

### Input Validation

- Type checking for all setting values
- Regex pattern validation where specified
- Custom validators for complex rules
- Server-side validation cannot be bypassed

## Future Enhancements

Potential improvements for future development:

1. **Settings History**: Track changes with timestamps and user info
2. **Role-Based Access**: Different permission levels for settings categories
3. **Settings Templates**: Predefined configurations for common scenarios
4. **Import/Export**: Backup and restore settings configurations
5. **Settings Search**: Quick search across all settings
6. **Validation Plugins**: Extensible validation system for complex rules

## References

- **Specification**: `specs/004-the-settings-and/spec.md`
- **Tasks**: `specs/004-the-settings-and/tasks.md`
- **Quickstart**: `specs/004-the-settings-and/quickstart.md`
- **Database Schema**: `src/lib/server/settings/schema.sql`
- **API Contracts**: `specs/004-the-settings-and/contracts/settings-api.json`

## Support

For questions or issues with the settings system:

1. Check this documentation first
2. Review quickstart scenarios for examples
3. Examine existing tests for patterns
4. Consult the spec documents for design rationale