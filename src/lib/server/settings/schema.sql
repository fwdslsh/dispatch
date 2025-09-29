-- Settings and Configuration Schema
-- Clean recreation approach for single-user development environment

-- Drop existing tables if they exist
DROP TABLE IF EXISTS configuration_settings;
DROP TABLE IF EXISTS settings_categories;

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

-- Insert default categories
INSERT INTO settings_categories (id, name, description, display_order) VALUES
  ('authentication', 'Authentication', 'Terminal key and OAuth configuration', 1),
  ('workspace', 'Workspace', 'Workspace paths and environment settings', 2),
  ('network', 'Network', 'SSL, tunnel, and connectivity settings', 3),
  ('ui', 'UI', 'Theme and display preferences', 4);

-- Insert essential settings
INSERT INTO configuration_settings (
  key, category_id, name, description, type,
  default_value, env_var_name, is_sensitive, is_required, validation_pattern
) VALUES
  -- Authentication category
  ('terminal_key', 'authentication', 'Terminal Key', 'Authentication key for accessing the terminal (minimum 8 characters)', 'string',
   'change-me', 'TERMINAL_KEY', TRUE, TRUE, '.{8,}'),
  ('oauth_client_id', 'authentication', 'OAuth Client ID', 'OAuth client identifier for external authentication', 'string',
   NULL, 'OAUTH_CLIENT_ID', FALSE, FALSE, NULL),
  ('oauth_client_secret', 'authentication', 'OAuth Client Secret', 'OAuth client secret for external authentication', 'string',
   NULL, 'OAUTH_CLIENT_SECRET', TRUE, FALSE, NULL),
  ('oauth_redirect_uri', 'authentication', 'OAuth Redirect URI', 'OAuth redirect URI for authentication callback', 'url',
   NULL, 'OAUTH_REDIRECT_URI', FALSE, FALSE, NULL),

  -- Workspace category
  ('workspaces_root', 'workspace', 'Workspaces Root', 'Root directory for all workspaces', 'path',
   '/workspace', 'WORKSPACES_ROOT', FALSE, TRUE, '^/.*'),

  -- Network category
  ('ssl_enabled', 'network', 'SSL Enabled', 'Enable SSL/HTTPS for connections', 'boolean',
   'false', 'SSL_ENABLED', FALSE, FALSE, NULL),
  ('enable_tunnel', 'network', 'Enable Tunnel', 'Enable LocalTunnel for public access', 'boolean',
   'false', 'ENABLE_TUNNEL', FALSE, FALSE, NULL),

  -- UI category
  ('theme', 'ui', 'Theme', 'UI theme preference', 'string',
   'auto', NULL, FALSE, FALSE, '^(light|dark|auto)$'),
  ('show_workspace_in_title', 'ui', 'Show Workspace in Title', 'Display workspace name in browser title', 'boolean',
   'true', NULL, FALSE, FALSE, NULL);