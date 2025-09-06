/**
 * Claude Session Type Configuration
 * Centralized configuration for Claude AI-assisted development sessions
 */

export const CLAUDE_CONFIG = {
	// Claude API and model settings
	DEFAULT_MODEL: 'claude-3.5-sonnet',
	SUPPORTED_MODELS: [
		'claude-3.5-sonnet',
		'claude-3-opus',
		'claude-3-sonnet',
		'claude-3-haiku'
	],
	DEFAULT_MAX_TOKENS: 8192,
	DEFAULT_TEMPERATURE: 0.7,
	
	// Token limits and constraints
	MAX_TOKENS_LIMIT: 100000,
	MIN_TEMPERATURE: 0.0,
	MAX_TEMPERATURE: 1.0,
		
	// Conversation and history limits
	MAX_CONVERSATION_HISTORY: 100,
	CONVERSATION_TRIM_SIZE: 50,
	MAX_MESSAGE_LENGTH: 32000,
	
	// Authentication and security
	AUTH_EXPIRY_HOURS: 24,
	API_KEY_PATTERN: /^sk-ant-api03-[A-Za-z0-9_-]+$/,
	
	// Session lifecycle and timing
	SESSION_TIMEOUT_MS: 30000,
	ATTACH_TIMEOUT_MS: 10000,
	CLEANUP_DELAY_MS: 1000,
	
	// Capabilities and features
	DEFAULT_CAPABILITIES: {
		enableCodeExecution: true,
		enableFileAccess: true,
		enableWebSearch: false,
		enableImageGeneration: false
	},
	
	// Claude command validation
	ALLOWED_COMMANDS: [
		'/help', '/model', '/temperature', '/tokens', '/clear', '/history',
		'/save', '/load', '/export', '/settings'
	],
	DANGEROUS_COMMAND_PATTERNS: [
		'/exec', '/system', '/token', '/key', '/auth', '/admin'
	],
	
	// Error handling and retry settings
	MAX_RETRY_ATTEMPTS: 3,
	RETRY_DELAY_MS: 1000,
	BACKOFF_MULTIPLIER: 2,
	
	// Storage and caching
	MAX_AUTH_STORAGE_SIZE: 1000,
	MAX_METADATA_STORAGE_SIZE: 1000,
	CLEANUP_INTERVAL_MS: 300000, // 5 minutes
	
	// Default system prompt
	DEFAULT_SYSTEM_PROMPT: 'You are Claude, an AI assistant created by Anthropic. You are helping with software development.',
	

};