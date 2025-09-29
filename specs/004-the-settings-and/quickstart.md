# Quickstart: Settings and Configuration Normalization (Simplified)

## Overview

This quickstart guide validates the simplified settings system for single-user development environments. Focus on essential functionality without complex audit trails or multi-user features.

## Prerequisites

- Dispatch application running locally
- Valid `TERMINAL_KEY` configured
- Access to settings interface

## Test Scenarios

### 1. Database Recreation and Initialization

**Objective**: Verify clean database recreation process

**Steps**:

```bash
# 1. Stop the application
npm run stop

# 2. Backup existing database (optional)
cp dispatch.db dispatch.db.backup

# 3. Delete existing database
rm dispatch.db

# 4. Start the application
npm run dev

# 5. Verify new database created with normalized structure
```

**Expected Results**:

- Application starts successfully
- New database file created
- Settings page accessible
- Default categories visible: Authentication, Workspace, Network, UI

### 2. Authentication Settings UI

**Objective**: Verify authentication settings are accessible and functional

**Steps**:

1. Navigate to `/settings`
2. Locate "Authentication" section
3. Verify presence of:
   - Terminal Key field (masked input)
   - OAuth Client ID field
   - OAuth Client Secret field (masked input)
   - OAuth Redirect URI field

**Expected Results**:

- All authentication fields visible in UI
- Sensitive fields are masked (show dots/asterisks)
- Current values populated from environment variables (if any)
- Field descriptions provide clear guidance

**API Test**:

```bash
# Get authentication configuration
curl -X GET "http://localhost:3030/api/auth/config?authKey=testkey12345"

# Expected response:
{
  "terminal_key_set": true,
  "oauth_configured": false,
  "oauth_client_id": null,
  "oauth_redirect_uri": null
}
```

### 3. Settings Priority Hierarchy

**Objective**: Verify UI settings override environment variables

**Steps**:

1. Set environment variable: `WORKSPACES_ROOT=/env/workspace`
2. In UI, set Workspace Root to `/ui/workspace`
3. Save settings
4. Restart application
5. Verify UI setting takes precedence

**Expected Results**:

- UI setting displays as `/ui/workspace`
- Application uses `/ui/workspace` despite environment variable
- Environment variable still visible as fallback in UI

**API Test**:

```bash
# Update workspace settings
curl -X PUT "http://localhost:3030/api/settings/workspace" \
  -H "Content-Type: application/json" \
  -d '{
    "authKey": "testkey12345",
    "settings": {
      "workspaces_root": "/ui/workspace"
    }
  }'

# Verify settings
curl -X GET "http://localhost:3030/api/settings?authKey=testkey12345&category=workspace"
```

### 4. Basic Settings Validation

**Objective**: Verify essential validation works

**Steps**:

1. Attempt to set invalid terminal key (less than 8 characters)
2. Try to save empty required fields
3. Verify validation messages

**Expected Results**:

- Invalid values rejected with clear error messages
- Previous valid values retained
- Simple, clear validation feedback

### 5. Authentication Changes

**Objective**: Verify authentication settings can be changed

**Steps**:

1. Change terminal key in settings
2. Save changes
3. Verify new key works for access

**Expected Results**:

- Settings save successfully
- New terminal key required for access
- Environment variable fallback preserved

### 6. Settings Categories and Organization

**Objective**: Verify no duplicate settings and proper organization

**Steps**:

1. Navigate through all settings categories
2. Verify each setting appears only once
3. Check for deprecated/non-functional settings
4. Test all setting modifications

**Expected Results**:

- Each setting appears in exactly one location
- All categories have logical groupings
- No deprecated or dummy settings present
- All settings affect application behavior

**Verification Script**:

```bash
# Check for duplicate settings
curl -X GET "http://localhost:3030/api/settings?authKey=testkey12345" | \
  jq '.settings | group_by(.key) | map(select(length > 1))'

# Should return empty array (no duplicates)
```

### 7. Error Handling and Recovery

**Objective**: Verify graceful error handling

**Steps**:

1. Test invalid authentication key
2. Attempt unauthorized access
3. Test malformed requests
4. Verify error responses

**Expected Results**:

- Clear error messages for all failure scenarios
- No sensitive information leaked in errors
- Application remains stable
- Proper HTTP status codes returned

## Performance Validation

### Response Time Tests

```bash
# Test settings load performance
time curl -X GET "http://localhost:3030/api/settings?authKey=testkey12345"

# Expected: < 100ms response time

# Test settings update performance
time curl -X PUT "http://localhost:3030/api/settings/ui" \
  -H "Content-Type: application/json" \
  -d '{
    "authKey": "testkey12345",
    "settings": {
      "theme": "dark"
    }
  }'

# Expected: < 100ms response time
```

## Database Verification

### Simple Schema Check

```sql
-- Verify essential tables exist
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%settings%';

-- Expected tables:
-- settings_categories
-- configuration_settings
```

### Basic Data Integrity

```sql
-- Verify all settings have valid categories
SELECT COUNT(*) FROM configuration_settings cs
LEFT JOIN settings_categories sc ON cs.category_id = sc.id
WHERE sc.id IS NULL;

-- Should return 0 (no orphaned settings)
```

## Rollback Testing

### Manual Database Recovery

**Steps**:

1. Stop application
2. Restore from backup: `cp dispatch.db.backup dispatch.db`
3. Start application
4. Verify settings restored

**Expected Results**:

- Previous settings configuration restored
- Application functions normally
- No data loss occurred

## Integration Testing

### Environment Variable Fallback

**Test Cases**:

1. Delete UI setting, verify fallback to environment variable
2. Clear environment variable, verify fallback to default
3. Test with missing configuration files

### Authentication Integration

**Test Cases**:

1. OAuth flow with new settings
2. Terminal key authentication
3. Session management across restarts

## Success Criteria

The implementation is successful when:

- ✅ Essential API endpoints respond correctly
- ✅ UI displays settings without duplicates
- ✅ Authentication settings accessible in UI
- ✅ Basic validation prevents invalid configurations
- ✅ Database recreation process works smoothly
- ✅ Performance targets met (<50ms operations)
- ✅ Error handling is clear and helpful
- ✅ Environment variable fallback functions
- ✅ Single-user development workflow supported

## Troubleshooting

### Common Issues

1. **Database permission errors**: Ensure write permissions for SQLite file
2. **Migration failures**: Verify backup process completed successfully
3. **Authentication errors**: Check terminal key format and length
4. **UI not loading**: Verify all required dependencies installed
5. **Performance issues**: Check database indexes and query optimization

### Debug Commands

```bash
# Check application logs
DEBUG=* npm run dev

# Database inspection
sqlite3 dispatch.db ".tables"
sqlite3 dispatch.db "SELECT * FROM configuration_settings;"

# API debugging
curl -v -X GET "http://localhost:3030/api/settings?authKey=testkey12345"
```

This quickstart provides comprehensive validation of the settings normalization feature across all critical user scenarios and technical requirements.
