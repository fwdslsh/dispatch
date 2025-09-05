/**
 * Shell Session Type - Client-side implementation
 * 
 * Provides client-side shell session type definition without server-side dependencies.
 * This is imported by browser code, while the full implementation is used on server.
 */

import { BaseSessionType } from '../shared/BaseSessionType.js';
import { generateSessionId, createSessionMetadata, mergeSessionOptions } from '../shared/SessionTypeUtils.js';

export class ShellSessionType extends BaseSessionType {
  constructor() {
    super({
      id: 'shell',
      name: 'Shell Terminal',
      description: 'Standard shell terminal session with PTY support',
      category: 'terminal',
      namespace: '/shell',
      requiresProject: false,
      supportsAttachment: true,
      defaultOptions: {
        shell: '/bin/bash',
        cols: 80,
        rows: 24,
        env: {
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      }
    });
  }
  
  /**
   * Basic client-side validation (no filesystem checks)
   */
  validate(options) {
    const errors = [];
    
    // Basic validation without filesystem checks
    if (options.customOptions?.shell) {
      const shell = options.customOptions.shell;
      if (typeof shell !== 'string' || shell.length === 0) {
        errors.push('Shell must be a valid path string');
      }
    }

    if (options.customOptions?.env) {
      const env = options.customOptions.env;
      if (typeof env !== 'object' || Array.isArray(env)) {
        errors.push('Environment variables must be an object');
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
    const shellCapabilities = ['create', 'attach', 'destroy', 'resize', 'input'];
    return shellCapabilities.includes(capability);
  }
}

// Create and export singleton instance for client use
export const shellSessionType = new ShellSessionType();