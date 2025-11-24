import { homedir } from 'node:os';
import { resolve } from 'node:path';

/**
 * PtyConfig - Value object for PTY configuration
 * Encapsulates PTY session configuration with validation and defaults
 */
export class PtyConfig {
	/**
	 * @param {Object} [options={}] - Configuration options
	 * @param {string} [options.cwd] - Working directory
	 * @param {Object} [options.env] - Environment variables
	 * @param {Object} [options.workspaceEnv] - Workspace environment variables
	 * @param {number} [options.cols] - Terminal columns
	 * @param {number} [options.rows] - Terminal rows
	 * @param {string} [options.name] - Terminal name
	 * @param {string|null} [options.encoding] - String encoding
	 * @param {boolean} [options.handleFlowControl] - Flow control
	 * @param {string} [options.flowControlPause] - Flow control pause
	 * @param {string} [options.flowControlResume] - Flow control resume
	 * @param {number} [options.uid] - Unix user ID
	 * @param {number} [options.gid] - Unix group ID
	 * @param {boolean} [options.useConpty] - Windows ConPTY
	 * @param {boolean} [options.useConptyDll] - Windows ConPTY DLL
	 * @param {boolean} [options.conptyInheritCursor] - Windows ConPTY cursor
	 * @param {string} [options.shell] - Shell command
	 * @param {string[]} [options.args] - Shell arguments
	 */
	constructor(options = {}) {
		// Validate and normalize cwd
		const rawCwd = options.cwd || process.env.WORKSPACES_ROOT || process.env.HOME;
		this.cwd = this.expandTilde(rawCwd);

		// Terminal dimensions with defaults
		this.cols = options.cols || 80;
		this.rows = options.rows || 24;

		// Terminal type with default
		this.name = options.name || 'xterm-256color';

		// String encoding (utf8 or null for binary)
		this.encoding = options.encoding !== undefined ? options.encoding : 'utf8';

		// Environment variables with proper precedence
		// Precedence: system env (process.env) → workspace env → session-specific env
		this.env = this.buildEnvironment(options.env, options.workspaceEnv);

		// Flow control options (experimental)
		this.handleFlowControl = options.handleFlowControl || false;
		this.flowControlPause = options.flowControlPause || '\x13'; // XOFF
		this.flowControlResume = options.flowControlResume || '\x11'; // XON

		// Unix-specific options
		this.uid = options.uid;
		this.gid = options.gid;

		// Windows-specific options
		this.useConpty = options.useConpty;
		this.useConptyDll = options.useConptyDll;
		this.conptyInheritCursor = options.conptyInheritCursor;

		// Shell configuration
		this.shell = options.shell || this.getDefaultShell();
		// Default to interactive mode (-i) for bash to show prompt
		this.args = options.args || ['-i'];

		// Store any additional options
		this.additionalOptions = { ...options };
		delete this.additionalOptions.cwd;
		delete this.additionalOptions.env;
		delete this.additionalOptions.workspaceEnv;
		delete this.additionalOptions.cols;
		delete this.additionalOptions.rows;
		delete this.additionalOptions.name;
		delete this.additionalOptions.encoding;
		delete this.additionalOptions.handleFlowControl;
		delete this.additionalOptions.flowControlPause;
		delete this.additionalOptions.flowControlResume;
		delete this.additionalOptions.uid;
		delete this.additionalOptions.gid;
		delete this.additionalOptions.useConpty;
		delete this.additionalOptions.useConptyDll;
		delete this.additionalOptions.conptyInheritCursor;
		delete this.additionalOptions.shell;
		delete this.additionalOptions.args;
	}

	/**
	 * Expand tilde (~) in path to home directory
	 * @param {string} path - Path potentially containing ~
	 * @returns {string} Expanded path
	 * @private
	 */
	expandTilde(path) {
		if (!path) return path;
		if (path.startsWith('~/')) {
			return resolve(homedir(), path.slice(2));
		}
		return path;
	}

	/**
	 * Build environment variables with proper precedence
	 * @param {Object} [sessionEnv] - Session-specific environment
	 * @param {Object} [workspaceEnv] - Workspace environment
	 * @returns {Object} Merged environment
	 * @private
	 */
	buildEnvironment(sessionEnv, workspaceEnv) {
		const baseEnv = { ...process.env, ...workspaceEnv };

		// Set default PS1 prompt if not already set (for shells without .bashrc)
		if (!baseEnv.PS1) {
			baseEnv.PS1 = '\\u@\\h:\\w\\$ ';
		}

		if (sessionEnv) {
			return { ...baseEnv, ...sessionEnv };
		}
		return baseEnv;
	}

	/**
	 * Get default shell for the current platform
	 * @returns {string} Default shell command
	 * @private
	 */
	getDefaultShell() {
		return process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : 'bash');
	}

	/**
	 * Convert to node-pty options format
	 * @returns {Object} node-pty compatible options
	 */
	toNodePtyOptions() {
		return {
			cwd: this.cwd,
			env: this.env,
			cols: this.cols,
			rows: this.rows,
			name: this.name,
			encoding: this.encoding,
			handleFlowControl: this.handleFlowControl,
			flowControlPause: this.flowControlPause,
			flowControlResume: this.flowControlResume,
			uid: this.uid,
			gid: this.gid,
			useConpty: this.useConpty,
			useConptyDll: this.useConptyDll,
			conptyInheritCursor: this.conptyInheritCursor,
			...this.additionalOptions
		};
	}

	/**
	 * Get shell and args for spawning
	 * @returns {{shell: string, args: string[]}}
	 */
	getShellConfig() {
		return {
			shell: this.shell,
			args: this.args
		};
	}

	/**
	 * Get logging-safe config (without sensitive data)
	 * @returns {Object}
	 */
	getLoggingConfig() {
		return {
			cwd: this.cwd,
			cols: this.cols,
			rows: this.rows,
			name: this.name,
			encoding: this.encoding,
			shell: this.shell,
			args: this.args
		};
	}
}
