/**
 * Claude Session Type - Client-side implementation
 * 
 * Provides client-side Claude session type definition without server-side dependencies.
 * This is imported by browser code, while the full implementation is used on server.
 */

import { BaseSessionType } from '../shared/BaseSessionType.js';

export class ClaudeSessionType extends BaseSessionType {
  constructor() {
    super({
      id: 'claude',
      name: 'Claude Code Session',
      description: 'AI-assisted development session with Claude integration',
      category: 'ai-assistant',
      namespace: '/claude',
      requiresProject: true,
      supportsAttachment: true,
      defaultOptions: {
        cols: 120,
        rows: 30,
        env: {
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        },
        claudeConfig: {
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 4096,
          temperature: 0.1
        }
      }
    });
  }

  /**
   * Basic client-side validation
   */
  validate(options) {
    const errors = [];
    
    // Basic validation
    if (!options.projectId) {
      errors.push('Project ID is required for Claude sessions');
    }

    if (options.customOptions?.claudeConfig) {
      const config = options.customOptions.claudeConfig;
      if (typeof config !== 'object') {
        errors.push('Claude config must be an object');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get supported capabilities
   */
  supportsCapability(capability) {
    const claudeCapabilities = ['create', 'attach', 'destroy', 'resize', 'input', 'chat', 'ai-assistance'];
    return claudeCapabilities.includes(capability);
  }
}

// Create and export singleton instance for client use
export const claudeSessionType = new ClaudeSessionType();