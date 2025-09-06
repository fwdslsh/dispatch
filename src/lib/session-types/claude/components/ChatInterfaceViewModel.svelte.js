/**
 * ChatInterfaceViewModel - Encapsulates chat interface business logic
 *
 * Handles message management, chat history persistence, authentication status,
 * and communication with Claude services. UI components should be thin and only handle presentation.
 */

import { marked } from 'marked';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-json.js';

export class ChatInterfaceViewModel {
	// Private fields
	#sessionId = '';
	#onSendMessage = null;
	#claudeClient = null;

	// Public reactive state
	messages = $state([]);
	typing = $state(false);
	messageInput = $state('');
	isAuthenticated = $state(false);

	// Actions - static object to prevent reactive loops
	actions;

	constructor(sessionId = 'default', onSendMessage = null, claudeClient = null) {
		this.#sessionId = sessionId;
		this.#onSendMessage = onSendMessage;
		this.#claudeClient = claudeClient;
		
		// Initialize static actions object
		this.actions = {
			addMessage: this.addMessage.bind(this),
			setTyping: this.setTyping.bind(this),
			sendMessage: this.sendMessage.bind(this),
			handleKeyDown: this.handleKeyDown.bind(this),
			formatMessageContent: this.formatMessageContent.bind(this),
			formatTimestamp: this.formatTimestamp.bind(this),
			clearHistory: this.clearHistory.bind(this),
			updateMessageInput: (value) => { this.messageInput = value; }
		};
		
		this.#initializeMarked();
		this.#loadChatHistory();
		this.#checkAuthStatus();
	}

	// Expose sessionId and claudeClient as simple properties for comparison in effects
	get currentSessionId() {
		return this.#sessionId;
	}

	get currentClaudeClient() {
		return this.#claudeClient;
	}

	/**
	 * Update session ID and reload history
	 */
	updateSession(sessionId) {
		this.#sessionId = sessionId;
		this.#loadChatHistory();
	}

	/**
	 * Set Claude client for authentication checks
	 */
	setClaudeClient(client) {
		this.#claudeClient = client;
		this.#checkAuthStatus();
	}

	/**
	 * Add a message to the chat
	 */
	addMessage(message) {
		const newMessage = {
			id: message.id || Date.now().toString(),
			sender: message.sender,
			content: message.content,
			timestamp: message.timestamp || new Date(),
			...message
		};

		this.messages = [...this.messages, newMessage];
		this.#saveChatHistory();
	}

	/**
	 * Set typing indicator state
	 */
	setTyping(isTyping) {
		this.typing = isTyping;
	}

	/**
	 * Send a message
	 */
	sendMessage() {
		const content = this.messageInput.trim();
		
		if (!content) {
			return;
		}

		// Handle /login command specially
		if (content === '/login' || content.startsWith('claude setup-token')) {
			this.#handleLoginCommand(content);
			return;
		}

		const message = {
			id: Date.now().toString(),
			sender: 'user',
			content,
			timestamp: new Date()
		};

		this.addMessage(message);
		this.#onSendMessage?.(message);
		this.messageInput = '';

		// Automatically query Claude with the user's message
		this.#queryClaude(content);
	}

	/**
	 * Handle Enter key in textarea
	 */
	handleKeyDown(event) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			this.sendMessage();
		}
	}

	/**
	 * Format message content with markdown and syntax highlighting
	 */
	formatMessageContent(content) {
		// Handle code blocks with syntax highlighting
		if (content.includes('```')) {
			return this.#formatCodeBlocks(content);
		}

		// Regular markdown parsing
		return marked.parse(content);
	}

	/**
	 * Format timestamp for display
	 */
	formatTimestamp(timestamp) {
		const date = new Date(timestamp);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	/**
	 * Clear chat history
	 */
	clearHistory() {
		this.messages = [];
		const key = `chat-history-${this.#sessionId}`;
		if (typeof window !== 'undefined') {
			localStorage.removeItem(key);
		}
	}



	// Private methods

	#initializeMarked() {
		marked.setOptions({
			highlight: function (code, lang) {
				if (lang && Prism.languages[lang]) {
					return Prism.highlight(code, Prism.languages[lang], lang);
				}
				return code;
			},
			breaks: true,
			gfm: true
		});
	}

	/**
	 * Load chat history from localStorage
	 */
	#loadChatHistory() {
		if (typeof window === 'undefined') return;

		const key = `chat-history-${this.#sessionId}`;
		const stored = localStorage.getItem(key);
		if (stored) {
			try {
				this.messages = JSON.parse(stored);
			} catch (error) {
				console.warn('Failed to load chat history:', error);
				this.messages = [];
			}
		}
	}

	/**
	 * Save chat history to localStorage
	 */
	#saveChatHistory() {
		if (typeof window === 'undefined') return;

		const key = `chat-history-${this.#sessionId}`;
		try {
			localStorage.setItem(key, JSON.stringify(this.messages));
		} catch (error) {
			console.warn('Failed to save chat history:', error);
		}
	}

	/**
	 * Check Claude authentication status
	 */
	async #checkAuthStatus() {
		try {
			// In browser, we'll assume not authenticated and rely on server-side auth
			if (typeof window !== 'undefined') {
				this.isAuthenticated = false;
			} else if (this.#claudeClient) {
				// Use Claude client if available
				const status = await this.#claudeClient.checkAuth();
				this.isAuthenticated = status.authenticated;
			}
		} catch (error) {
			console.warn('Could not check Claude auth status:', error);
			this.isAuthenticated = false;
		}
	}

	/**
	 * Handle /login command
	 */
	async #handleLoginCommand(content) {
		// Add user message
		this.addMessage({
			id: Date.now().toString(),
			sender: 'user',
			content,
			timestamp: new Date()
		});

		this.messageInput = '';

		// Provide login instructions
		this.addMessage({
			id: (Date.now() + 1).toString(),
			sender: 'assistant',
			content: `To authenticate with Claude Code, please run the following command in a terminal:

\`\`\`bash
npx @anthropic-ai/claude setup-token
\`\`\`

After successful authentication, return here and try your query again. You can also use the terminal tab in this interface to run the login command directly.

Once authenticated, I'll be able to help you with coding tasks, questions, and more!`,
			timestamp: new Date()
		});

		// Trigger a refresh of auth status after a short delay
		setTimeout(async () => {
			await this.#checkAuthStatus();
			if (this.isAuthenticated) {
				this.addMessage({
					id: (Date.now() + 2).toString(),
					sender: 'assistant',
					content: "✅ Authentication successful! I'm ready to help you with your coding tasks.",
					timestamp: new Date()
				});
			}
		}, 2000);
	}

	/**
	 * Format code blocks with syntax highlighting
	 */
	#formatCodeBlocks(content) {
		return content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
			const lang = language || 'text';
			let highlighted = code;

			if (lang && Prism.languages[lang]) {
				highlighted = Prism.highlight(code, Prism.languages[lang], lang);
			}

			return `<pre class="code-block"><code class="language-${lang}">${highlighted}</code></pre>`;
		});
	}

	/**
	 * Query Claude with the given prompt
	 */
	async #queryClaude(prompt) {
		if (!this.isAuthenticated) {
			this.addMessage({
				sender: 'assistant',
				content: 'Not authenticated with Claude CLI. Please run: `claude setup-token`',
				timestamp: new Date()
			});
			return;
		}

		this.setTyping(true);

		try {
			if (this.#claudeClient) {
				const response = await this.#claudeClient.sendMessage(prompt);
				this.addMessage({
					sender: 'assistant',
					content: response.content || response.message,
					timestamp: new Date()
				});
			} else {
				// Fallback: show message that Claude client is not available
				this.addMessage({
					sender: 'assistant',
					content: 'Claude client not available. Please ensure you are properly connected.',
					timestamp: new Date()
				});
			}
		} catch (error) {
			console.error('Claude query failed:', error);
			this.addMessage({
				sender: 'assistant',
				content: `Error: ${error.message}`,
				timestamp: new Date()
			});
		} finally {
			this.setTyping(false);
		}
	}
}