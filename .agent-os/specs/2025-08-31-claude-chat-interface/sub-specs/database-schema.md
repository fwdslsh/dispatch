# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-08-31-claude-chat-interface/spec.md

Use a sqlite database of server needs and indexdb for client side

## Schema Changes

### New Tables

#### chat_sessions
Stores chat session metadata and configuration
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL REFERENCES sessions(id),
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(session_id, user_id)
);

CREATE INDEX idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
```

#### chat_messages
Stores all chat messages between users and Claude
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tokens_used INTEGER DEFAULT 0
);

CREATE INDEX idx_chat_messages_session ON chat_messages(chat_session_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at DESC);
```

#### chat_settings
Stores user-specific chat configuration and preferences
```sql
CREATE TABLE chat_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  allowed_tools TEXT[] DEFAULT ARRAY[]::TEXT[],
  permission_mode VARCHAR(20) DEFAULT 'auto' CHECK (permission_mode IN ('auto', 'confirm', 'deny')),
  system_prompt TEXT,
  model VARCHAR(100) DEFAULT 'claude-3-sonnet',
  mcp_servers JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chat_session_id)
);

CREATE INDEX idx_chat_settings_session ON chat_settings(chat_session_id);
```


#### command_usage
Tracks command usage for analytics and quick access
```sql
CREATE TABLE command_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  command VARCHAR(100) NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, command)
);

CREATE INDEX idx_command_usage_user ON command_usage(user_id);
CREATE INDEX idx_command_usage_frequency ON command_usage(usage_count DESC);
```

## Migrations

### Migration 001: Initial Chat Schema
```sql
-- Up Migration
BEGIN;

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(session_id, user_id)
);

-- Create remaining tables...
-- (Include all CREATE TABLE statements from above)

-- Add update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_settings_updated_at BEFORE UPDATE ON chat_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


COMMIT;

-- Down Migration
BEGIN;
DROP TABLE IF EXISTS command_usage CASCADE;
DROP TABLE IF EXISTS chat_settings CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
COMMIT;
```

## Rationale

### Design Decisions

1. **Separate chat_sessions table**: Allows multiple chat contexts per terminal session with different configurations
2. **JSONB for metadata**: Provides flexibility for storing varying response metadata without schema changes
3. **Text array for allowed_tools**: Efficient storage and querying of tool permissions
4. **Soft delete via is_active**: Preserves chat history while allowing session deactivation
5. **UUID primary keys**: Better for distributed systems and prevents ID enumeration

### Performance Considerations

1. **Indexes on foreign keys**: Optimizes JOIN operations between related tables
2. **Timestamp indexes**: Speeds up chronological queries for message history
3. **Composite unique constraints**: Prevents duplicate sessions per user
4. **JSONB columns**: Allows indexed queries on metadata fields

### Data Integrity Rules

1. **Cascading deletes**: Removing a chat session automatically removes related messages and settings
2. **Check constraints**: Ensures valid enum values for role and permission_mode
3. **NOT NULL constraints**: Enforces required fields for data consistency
4. **Unique constraints**: Prevents duplicate authentication tokens per user