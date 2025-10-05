import path from 'node:path';
import os from 'node:os';

/**
 * Centralized configuration loader for server services.
 */
export class ConfigService {
	constructor({ overrides = {}, env = process.env } = {}) {
		this.overrides = overrides;
		this.env = env;
		this.cached = null;
	}

	/**
	 * Return the resolved configuration object.
	 * @returns {Record<string, any>}
	 */
	load() {
		if (this.cached) {
			return this.cached;
		}

                const config = {
                        dbPath: this._string('dbPath', 'DB_PATH', '~/.dispatch/data/workspace.db'),
                        workspacesRoot: this._string(
                                'workspacesRoot',
                                'WORKSPACES_ROOT',
                                '~/.dispatch-home/workspaces'
                        ),
                        configDir: this._string('configDir', 'DISPATCH_CONFIG_DIR', '~/.config/dispatch'),
                        debug: this._boolean('debug', 'DEBUG', false),
                        port: this._number('port', 'PORT', 3030),
                        tunnelSubdomain: this._string('tunnelSubdomain', 'LT_SUBDOMAIN', ''),
                        terminalKey: this._string('terminalKey', 'TERMINAL_KEY', 'change-me-to-a-strong-password'),
                        defaultShell: this._string('shell', 'SHELL', process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'),
                        enableTunnel: this._boolean('enableTunnel', 'ENABLE_TUNNEL', false),
                        baseEnv: { ...this.env }
                };

		this.cached = this._resolvePaths(config);
		return this.cached;
	}

        /**
         * Get a single configuration value by key.
         * @param {string} key
         * @returns {any}
         */
        get(key) {
                return this.load()[key];
        }

        getEnv() {
                return { ...this.load().baseEnv };
        }

        getTerminalKey() {
                return this.load().terminalKey;
        }

        getDefaultShell() {
                return this.load().defaultShell;
        }

	_string(overrideKey, envKey, fallback) {
		if (this.overrides[overrideKey] !== undefined && this.overrides[overrideKey] !== null) {
			return String(this.overrides[overrideKey]);
		}

		if (this.env[envKey] !== undefined) {
			return String(this.env[envKey]);
		}

		return fallback;
	}

	_number(overrideKey, envKey, fallback) {
		const raw = this.overrides[overrideKey] ?? this.env[envKey];
		if (raw === undefined || raw === null || raw === '') {
			return Number(fallback);
		}

		const parsed = Number(raw);
		return Number.isNaN(parsed) ? Number(fallback) : parsed;
	}

	_boolean(overrideKey, envKey, fallback) {
		const raw = this.overrides[overrideKey] ?? this.env[envKey];
		if (raw === undefined || raw === null || raw === '') {
			return Boolean(fallback);
		}

		if (typeof raw === 'boolean') {
			return raw;
		}

		const normalized = String(raw).toLowerCase();
		return (
			normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
		);
	}

	_resolvePaths(config) {
		const homeDir = this.env.HOME || os.homedir();
		const resolved = { ...config };

		['dbPath', 'workspacesRoot', 'configDir'].forEach((key) => {
			const value = resolved[key];
			if (typeof value === 'string' && value.startsWith('~/')) {
				resolved[key] = path.join(homeDir, value.slice(2));
			}
		});

		return resolved;
	}
}
