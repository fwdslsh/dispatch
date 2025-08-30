// Link Detection Service for xterm.js
// No external dependencies - uses xterm.js's built-in link provider API

export class LinkDetector {
  constructor() {
    // Regex patterns for different types of links
    this.patterns = {
      // HTTP(S) URLs
      url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
      
      // File paths (Unix/Windows)
      filePath: /(?:\/[a-zA-Z0-9_\-\.]+)+(?:\/[a-zA-Z0-9_\-\.]+)*|(?:[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*)/g,
      
      // IP addresses (IPv4)
      ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
      
      // Email addresses
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      
      // GitHub issues/PRs (e.g., #123, user/repo#123)
      github: /(?:[\w-]+\/[\w-]+)?#\d+/g,
      
      // Docker images
      docker: /(?:[a-z0-9]+(?:[._-][a-z0-9]+)*\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[a-zA-Z0-9_.-]+)?(?:@sha256:[a-f0-9]{64})?/g,
      
      // Localhost URLs
      localhost: /(?:https?:\/\/)?localhost(?::\d{1,5})?(?:\/[^\s]*)?/g,
      
      // Port numbers (e.g., :8080, :3000)
      port: /:\d{1,5}\b/g
    };
    
    // Link handlers
    this.handlers = new Map();
    this.setupDefaultHandlers();
  }
  
  setupDefaultHandlers() {
    // URL handler
    this.handlers.set('url', (match) => {
      window.open(match, '_blank', 'noopener,noreferrer');
    });
    
    // Email handler
    this.handlers.set('email', (match) => {
      window.open(`mailto:${match}`, '_blank');
    });
    
    // File path handler (copy to clipboard)
    this.handlers.set('filePath', (match) => {
      this.copyToClipboard(match);
      this.showTooltip('Path copied to clipboard');
    });
    
    // IP address handler
    this.handlers.set('ipv4', (match) => {
      // Try to open as HTTP URL
      window.open(`http://${match}`, '_blank', 'noopener,noreferrer');
    });
    
    // GitHub handler
    this.handlers.set('github', (match) => {
      // Convert to full GitHub URL
      let url;
      if (match.includes('/')) {
        // Full reference: user/repo#123
        const [repo, issue] = match.split('#');
        url = `https://github.com/${repo}/issues/${issue}`;
      } else {
        // Just issue number - would need current repo context
        // For now, just copy to clipboard
        this.copyToClipboard(match);
        this.showTooltip('Issue reference copied');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    });
    
    // Docker image handler
    this.handlers.set('docker', (match) => {
      // Copy docker pull command
      this.copyToClipboard(`docker pull ${match}`);
      this.showTooltip('Docker pull command copied');
    });
    
    // Localhost handler
    this.handlers.set('localhost', (match) => {
      // Ensure it has protocol
      const url = match.startsWith('http') ? match : `http://${match}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }
  
  // Register link provider with xterm instance
  registerWithTerminal(terminal) {
    if (!terminal) return;
    
    // Register URL provider
    terminal.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const links = this.detectLinks(terminal, bufferLineNumber);
        callback(links);
      }
    });
    
    // Also use the simpler link matcher for basic URLs
    terminal.registerLinkMatcher(
      this.patterns.url,
      (event, match) => {
        this.handleLink('url', match);
      },
      {
        matchIndex: 0,
        validationCallback: (uri, callback) => {
          // Basic validation
          callback(uri.startsWith('http://') || uri.startsWith('https://'));
        },
        tooltipCallback: (event, uri, location) => {
          // Show tooltip on hover
          return `Open ${uri}`;
        },
        leaveCallback: () => {
          // Clean up tooltip
        },
        priority: 0
      }
    );
    
    // Register email matcher
    terminal.registerLinkMatcher(
      this.patterns.email,
      (event, match) => {
        this.handleLink('email', match);
      },
      {
        matchIndex: 0,
        priority: 1
      }
    );
    
    // Register IP matcher
    terminal.registerLinkMatcher(
      this.patterns.ipv4,
      (event, match) => {
        this.handleLink('ipv4', match);
      },
      {
        matchIndex: 0,
        priority: 2
      }
    );
    
    // Register localhost matcher
    terminal.registerLinkMatcher(
      this.patterns.localhost,
      (event, match) => {
        this.handleLink('localhost', match);
      },
      {
        matchIndex: 0,
        priority: 3
      }
    );
  }
  
  // Detect all types of links in a buffer line
  detectLinks(terminal, bufferLineNumber) {
    const links = [];
    
    try {
      const line = terminal.buffer.active.getLine(bufferLineNumber);
      if (!line) return links;
      
      const text = line.translateToString(true);
      if (!text) return links;
      
      // Check each pattern
      for (const [type, pattern] of Object.entries(this.patterns)) {
        const regex = new RegExp(pattern);
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          links.push({
            range: {
              start: {
                x: match.index + 1,
                y: bufferLineNumber + 1
              },
              end: {
                x: match.index + match[0].length + 1,
                y: bufferLineNumber + 1
              }
            },
            text: match[0],
            activate: (event, text) => {
              this.handleLink(type, text);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error detecting links:', error);
    }
    
    return links;
  }
  
  // Handle link click
  handleLink(type, match) {
    const handler = this.handlers.get(type);
    if (handler) {
      try {
        handler(match);
      } catch (error) {
        console.error(`Error handling ${type} link:`, error);
      }
    }
  }
  
  // Utility: Copy to clipboard
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }
  
  // Utility: Show tooltip
  showTooltip(message, duration = 2000) {
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'link-detector-tooltip';
    tooltip.textContent = message;
    tooltip.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10000;
      pointer-events: none;
      animation: fadeIn 0.3s ease-in-out;
    `;
    
    document.body.appendChild(tooltip);
    
    // Remove after duration
    setTimeout(() => {
      tooltip.style.animation = 'fadeOut 0.3s ease-in-out';
      setTimeout(() => {
        document.body.removeChild(tooltip);
      }, 300);
    }, duration);
  }
  
  // Add custom pattern
  addPattern(name, pattern, handler) {
    this.patterns[name] = pattern;
    if (handler) {
      this.handlers.set(name, handler);
    }
  }
  
  // Remove pattern
  removePattern(name) {
    delete this.patterns[name];
    this.handlers.delete(name);
  }
  
  // Update handler for existing pattern
  setHandler(type, handler) {
    this.handlers.set(type, handler);
  }
  
  // Test if text contains any links
  hasLinks(text) {
    for (const pattern of Object.values(this.patterns)) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }
  
  // Extract all links from text
  extractLinks(text) {
    const results = [];
    
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const regex = new RegExp(pattern);
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        results.push({
          type,
          text: match[0],
          index: match.index,
          length: match[0].length
        });
      }
    }
    
    return results;
  }
}

// CSS for tooltips (inject once)
if (typeof document !== 'undefined' && !document.getElementById('link-detector-styles')) {
  const style = document.createElement('style');
  style.id = 'link-detector-styles';
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translate(-50%, 10px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
    
    @keyframes fadeOut {
      from { opacity: 1; transform: translate(-50%, 0); }
      to { opacity: 0; transform: translate(-50%, 10px); }
    }
    
    .link-detector-tooltip {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    }
  `;
  document.head.appendChild(style);
}