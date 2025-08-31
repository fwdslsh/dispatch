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
    this.setupHandlers();
  }
  
  setupHandlers() {
    // URL handler
    this.handlers.set('url', (match) => {
      window.open(match, '_blank', 'noopener,noreferrer');
    });
    
    // Email handler
    this.handlers.set('email', (match) => {
      window.location.href = `mailto:${match}`;
    });
    
    // File path handler
    this.handlers.set('filePath', (match) => {
      // Copy to clipboard
      if (navigator.clipboard) {
        navigator.clipboard.writeText(match);
        console.log('File path copied to clipboard:', match);
      }
    });
    
    // IPv4 handler
    this.handlers.set('ipv4', (match) => {
      // Try to open as HTTP URL
      const url = `http://${match}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
    
    // GitHub handler
    this.handlers.set('github', (match) => {
      const url = match.includes('/') 
        ? `https://github.com/${match.replace('#', '/issues/')}`
        : `https://github.com/issues/${match.replace('#', '')}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
    
    // Docker handler
    this.handlers.set('docker', (match) => {
      const url = `https://hub.docker.com/_/${match.split(':')[0]}`;
      window.open(url, '_blank', 'noopener,noreferrer');
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
    
    try {
      // Use modern registerLinkProvider API instead of deprecated registerLinkMatcher
      terminal.registerLinkProvider({
        provideLinks: (bufferLineNumber, callback) => {
          const links = this.detectLinks(terminal, bufferLineNumber);
          callback(links);
        }
      });
      
      console.log('LinkDetector: Successfully registered link provider with terminal');
    } catch (error) {
      console.warn('LinkDetector: Failed to register link provider:', error);
    }
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
          const startIndex = match.index;
          const endIndex = match.index + match[0].length;
          
          links.push({
            range: {
              start: { x: startIndex, y: bufferLineNumber },
              end: { x: endIndex, y: bufferLineNumber }
            },
            text: match[0],
            activate: () => this.handleLink(type, match[0]),
            hover: (event, text) => {
              // Safely handle hover with null checks
              const linkText = text || match[0] || 'link';
              return `Click to open: ${linkText}`;
            },
            leave: () => {}
          });
        }
      }
    } catch (error) {
      console.warn('LinkDetector: Error detecting links:', error);
    }
    
    return links;
  }
  
  // Handle link activation
  handleLink(type, match) {
    const handler = this.handlers.get(type);
    if (handler) {
      try {
        handler(match);
      } catch (error) {
        console.error(`LinkDetector: Error handling ${type} link:`, error);
      }
    } else {
      console.warn(`LinkDetector: No handler for link type: ${type}`);
    }
  }
  
  // Get all supported link types
  getSupportedTypes() {
    return Array.from(this.handlers.keys());
  }
  
  // Test if a string matches any pattern
  testString(text) {
    const results = {};
    
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const matches = text.match(pattern);
      results[type] = matches || [];
    }
    
    return results;
  }
}