#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import os from 'os';
import open from 'open';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

// Default configuration
const defaultConfig = {
	image: 'fwdslsh/dispatch:latest',
	port: 3030,
	terminalKey: null, // Will be generated if not provided
	enableTunnel: false,
	ltSubdomain: null,
	ptyMode: 'shell',
	volumes: {
		projects: '~/dispatch/projects',
		home: '~/dispatch/home',
		ssh: null, // Optional
		claude: null, // Optional
		config: null // Optional
	},
	build: false, // Whether to build the image first
	openBrowser: false,
	notifications: {
		enabled: false,
		webhook: {
			url: null,
			headers: {
				'Content-Type': 'application/json'
			}
		}
	}
};

function expandPath(pathStr) {
	if (!pathStr) return null;
	if (pathStr.startsWith('~/')) {
		return path.join(os.homedir(), pathStr.slice(2));
	}
	return path.resolve(pathStr);
}

function loadConfig() {
	const configPath = path.join(os.homedir(), '.dispatch', 'config.json');

	let config = { ...defaultConfig };

	if (fs.existsSync(configPath)) {
		try {
			const jsonContent = fs.readFileSync(configPath, 'utf8');
			const fileConfig = JSON.parse(jsonContent);
			config = { ...config, ...fileConfig };
		} catch (error) {
			console.warn(`Warning: Could not parse config file ${configPath}: ${error.message}`);
		}
	}

	return config;
}

function generateRandomKey() {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function createReadlineInterface() {
	return createInterface({
		input: process.stdin,
		output: process.stdout
	});
}

function prompt(question) {
	const rl = createReadlineInterface();
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

function promptYesNo(question, defaultValue = true) {
	const defaultStr = defaultValue ? 'Y/n' : 'y/N';
	return prompt(`${question} (${defaultStr}): `).then(answer => {
		if (answer === '') return defaultValue;
		return answer.toLowerCase().startsWith('y');
	});
}

function copyDirectoryRecursive(source, target) {
	if (!fs.existsSync(source)) {
		return false;
	}

	if (!fs.existsSync(target)) {
		fs.mkdirSync(target, { recursive: true });
	}

	const files = fs.readdirSync(source);

	for (const file of files) {
		const sourcePath = path.join(source, file);
		const targetPath = path.join(target, file);

		if (fs.statSync(sourcePath).isDirectory()) {
			copyDirectoryRecursive(sourcePath, targetPath);
		} else {
			fs.copyFileSync(sourcePath, targetPath);
		}
	}

	return true;
}

async function pullDockerImage(imageName) {
	console.log(`🐳 Pulling Docker image: ${imageName}`);

	return new Promise((resolve, reject) => {
		const pull = spawn('docker', ['pull', imageName], {
			stdio: 'inherit'
		});

		pull.on('close', (code) => {
			if (code === 0) {
				console.log('✅ Docker image pulled successfully');
				resolve();
			} else {
				reject(new Error(`Docker pull failed with exit code ${code}`));
			}
		});
	});
}

function ensureCLIAvailable() {
	const binPath = process.argv[1]; // Current CLI path
	const globalBinPath = '/usr/local/bin/dispatch';

	try {
		// Check if already available globally
		const result = spawn('which', ['dispatch'], { stdio: 'pipe' });
		let output = '';
		result.stdout.on('data', (data) => {
			output += data.toString();
		});

		return new Promise((resolve) => {
			result.on('close', (code) => {
				if (code === 0 && output.trim()) {
					console.log('✅ dispatch CLI already available globally');
					resolve(true);
				} else {
					// Try to create symlink
					try {
						if (fs.existsSync(globalBinPath)) {
							fs.unlinkSync(globalBinPath);
						}
						fs.symlinkSync(binPath, globalBinPath);
						console.log('✅ dispatch CLI made available globally');
						resolve(true);
					} catch (error) {
						console.warn('⚠️  Could not make CLI available globally. You may need to run with sudo or add to PATH manually');
						console.warn(`   Manual command: sudo ln -sf ${binPath} ${globalBinPath}`);
						resolve(false);
					}
				}
			});
		});
	} catch (error) {
		console.warn('⚠️  Could not check CLI availability:', error.message);
		return Promise.resolve(false);
	}
}

async function sendWebhookNotification(config, url, terminalKey) {
	try {
		const webhook = config.notifications.webhook;
		if (!webhook.url) {
			console.warn('⚠️  Webhook notification skipped: no URL configured');
			return;
		}

		const payload = {
			message: 'Dispatch Container Started',
			url: url,
			terminalKey: terminalKey,
			timestamp: new Date().toISOString()
		};

		const response = await fetch(webhook.url, {
			method: 'POST',
			headers: webhook.headers,
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		console.log(`🔗 Webhook notification sent to ${webhook.url}`);
	} catch (error) {
		console.warn(`⚠️  Webhook notification failed: ${error.message}`);
	}
}

async function sendNotifications(config, url, terminalKey) {
	if (!config.notifications.enabled) {
		return;
	}

	console.log('📲 Sending notifications...');

	if (config.notifications.webhook.url) {
		await sendWebhookNotification(config, url, terminalKey);
	} else {
		console.warn('⚠️  Notifications enabled but no webhook configured');
	}
}

function ensureDirectories(config) {
	// Create directories if they don't exist
	const dirs = [config.volumes.projects, config.volumes.home].filter(Boolean).map(expandPath);

	dirs.forEach((dir) => {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
			console.log(`Created directory: ${dir}`);
		}
	});
}

async function buildImage(imageName) {
	console.log(`Building Docker image: ${imageName}`);

	const dockerfilePath = path.join(__dirname, '..', 'docker', 'Dockerfile');
	const contextPath = path.join(__dirname, '..');

	return new Promise((resolve, reject) => {
		const build = spawn('docker', ['build', '-f', dockerfilePath, '-t', imageName, contextPath], {
			stdio: 'inherit'
		});

		build.on('close', (code) => {
			if (code === 0) {
				console.log('✅ Docker image built successfully');
				resolve();
			} else {
				reject(new Error(`Docker build failed with exit code ${code}`));
			}
		});
	});
}

async function runContainer(config) {
	const args = ['run', '-d', '--name', 'dispatch', '-p', `${config.port}:3030`];

	// Add restart policy if requested
	if (!config.restart || config.restart == true) {
		args.push('--restart=unless-stopped');
	} else {
		args.push('--rm');
	}

	// Environment variables
	const terminalKey = config.terminalKey || generateRandomKey();
	args.push('-e', `TERMINAL_KEY=${terminalKey}`);
	args.push('-e', `PTY_MODE=${config.ptyMode}`);
	args.push('-e', `DISPATCH_CONFIG_DIR=/home/dispatch/.config/dispatch`);
	args.push('-e', `DISPATCH_PROJECTS_DIR=/workspace`);

	if (config.enableTunnel) {
		args.push('-e', 'ENABLE_TUNNEL=true');
		if (config.ltSubdomain) {
			args.push('-e', `LT_SUBDOMAIN=${config.ltSubdomain}`);
		}
	}

	// User mapping
	const uid = process.getuid ? process.getuid() : 1000;
	const gid = process.getgid ? process.getgid() : 1000;
	args.push('--user', `${uid}:${gid}`);

	// Volume mounts
	if (config.volumes.home) {
		const homePath = expandPath(config.volumes.home);
		args.push('-v', `${homePath}:/home/dispatch`);
	}

	if (config.volumes.projects) {
		const projectsPath = expandPath(config.volumes.projects);
		args.push('-v', `${projectsPath}:/workspace`);
	}

	if (config.volumes.ssh) {
		const sshPath = expandPath(config.volumes.ssh);
		if (fs.existsSync(sshPath)) {
			args.push('-v', `${sshPath}:/home/dispatch/.ssh:ro`);
		}
	}

	if (config.volumes.claude) {
		const claudePath = expandPath(config.volumes.claude);
		if (fs.existsSync(claudePath)) {
			args.push('-v', `${claudePath}:/home/dispatch/.claude`);
		}
	}

	if (config.volumes.config) {
		const configPath = expandPath(config.volumes.config);
		if (fs.existsSync(configPath)) {
			args.push('-v', `${configPath}:/home/dispatch/.config`);
		}
	}

	// Image name
	args.push(config.image);

	console.log('🚀 Starting Dispatch container...');
	console.log(`📝 Terminal Key: ${terminalKey}`);
	console.log(`🌐 Web Interface: http://localhost:${config.port}`);

	return new Promise((resolve, reject) => {
		const docker = spawn('docker', args, { stdio: 'inherit' });

		docker.on('close', (code) => {
			if (code === 0) {
				console.log('✅ Container started successfully');
				resolve({ terminalKey, port: config.port });
			} else {
				reject(new Error(`Docker run failed with exit code ${code}`));
			}
		});
	});
}

async function waitForContainer(port, maxAttempts = 30) {
	console.log('⏳ Waiting for container to be ready...');

	// Simple wait without fetch dependency
	await new Promise((resolve) => setTimeout(resolve, 3000));

	console.log('✅ Container should be ready');
}

program.name('dispatch').description('Launch Dispatch web terminal in Docker').version('0.0.3');

program
	.command('start')
	.description('Start the Dispatch container')
	.option('-p, --port <port>', 'Port for web interface', '3030')
	.option('-k, --key <key>', 'Terminal authentication key')
	.option('--tunnel', 'Enable public URL tunnel')
	.option('--subdomain <subdomain>', 'Custom tunnel subdomain')
	.option('--mode <mode>', 'PTY mode (shell|claude)', 'shell')
	.option('--build', 'Build Docker image before running')
	.option('--open', 'Open browser after container starts')
	.option('--projects <path>', 'Projects directory to mount')
	.option('--home <path>', 'Home directory to mount')
	.option('--ssh <path>', 'SSH directory to mount (read-only)')
	.option('--claude <path>', 'Claude config directory to mount')
	.option('--config <path>', 'Additional config directory to mount')
	.option('--notify-webhook <url>', 'Send webhook notification with access link')
	.option('--restart', 'Restart container automatically on system reboot')
	.action(async (options) => {
		try {
			let config = loadConfig();

			// Override config with command line options
			if (options.port) config.port = parseInt(options.port);
			if (options.key) config.terminalKey = options.key;
			if (options.tunnel) config.enableTunnel = true;
			if (options.subdomain) config.ltSubdomain = options.subdomain;
			if (options.mode) config.ptyMode = options.mode;
			if (options.build) config.build = true;
			if (options.open) config.openBrowser = true;
			if (options.projects) config.volumes.projects = options.projects;
			if (options.home) config.volumes.home = options.home;
			if (options.ssh) config.volumes.ssh = options.ssh;
			if (options.claude) config.volumes.claude = options.claude;
			if (options.config) config.volumes.config = options.config;

			// Handle notification options
			if (options.notifyWebhook) {
				config.notifications.enabled = true;
				config.notifications.webhook.url = options.notifyWebhook;
			}

			// Add restart option to config
			if (options.restart) config.restart = true;

			// Ensure directories exist
			ensureDirectories(config);

			// Build image if requested
			if (config.build) {
				await buildImage(config.image);
			}

			// Start container
			const result = await runContainer(config);

			// Wait for container to be ready
			await waitForContainer(config.port);

			// Determine the access URL
			let accessUrl = `http://localhost:${config.port}`;
			let tunnelUrl = null;

			if (config.enableTunnel) {
				// Wait a bit more for tunnel to establish
				console.log('⏳ Waiting for tunnel to establish...');
				await new Promise((resolve) => setTimeout(resolve, 5000));

				// Try to read tunnel URL from file (if container writes it)
				try {
					const tunnelUrlFile = '/tmp/tunnel-url.txt';
					if (fs.existsSync(tunnelUrlFile)) {
						tunnelUrl = fs.readFileSync(tunnelUrlFile, 'utf8').trim();
						if (tunnelUrl) {
							accessUrl = tunnelUrl;
							console.log(`🌐 Public URL: ${tunnelUrl}`);
						}
					}
				} catch (error) {
					console.warn('⚠️  Could not read tunnel URL, using local URL');
				}
			}

			// Send notifications if enabled
			if (config.notifications.enabled) {
				await sendNotifications(config, accessUrl, result.terminalKey);
			}

			// Open browser if requested
			if (config.openBrowser) {
				console.log('🌐 Opening browser...');
				await open(accessUrl);
			}
		} catch (error) {
			console.error('❌ Error:', error.message);
			process.exit(1);
		}
	});

program
	.command('stop')
	.description('Stop the Dispatch container')
	.action(async () => {
		try {
			console.log('🛑 Stopping Dispatch container...');

			const stop = spawn('docker', ['stop', 'dispatch'], { stdio: 'inherit' });

			stop.on('close', (code) => {
				if (code === 0) {
					console.log('✅ Container stopped successfully');
				} else {
					console.log('⚠️  Container may not have been running');
				}
			});
		} catch (error) {
			console.error('❌ Error:', error.message);
			process.exit(1);
		}
	});

program
	.command('config')
	.description('Generate example configuration file')
	.action(() => {
		const configDir = path.join(os.homedir(), '.dispatch');
		const configPath = path.join(configDir, 'config.json');

		const exampleConfig = {
			// Dispatch CLI Configuration
			image: 'fwdslsh/dispatch:latest',
			port: 3030,
			terminalKey: null, // Will be auto-generated if not provided
			enableTunnel: false,
			ltSubdomain: null, // Custom tunnel subdomain (optional)
			ptyMode: 'shell', // 'shell' or 'claude'
			volumes: {
				projects: '~/dispatch/projects', // Projects workspace directory
				home: '~/dispatch/home', // User home directory (for dotfiles, shell history, etc.)
				ssh: '~/.ssh', // SSH directory (mounted read-only, optional)
				claude: '~/.claude', // Claude configuration directory (optional)
				config: '~/.config' // Additional config directory (optional)
			},
			build: false, // Build Docker image before running
			openBrowser: false, // Open browser automatically after starting
			notifications: {
				enabled: false, // Enable notifications when container starts
				webhook: {
					url: null, // Webhook URL to send POST request to (great for Slack, Discord, etc.)
					headers: {
						'Content-Type': 'application/json'
						// Add other headers like Authorization if needed
					}
				}
			}
		};

		try {
			if (!fs.existsSync(configDir)) {
				fs.mkdirSync(configDir, { recursive: true });
			}

			if (fs.existsSync(configPath)) {
				console.log(`⚠️  Configuration file already exists at ${configPath}`);
				console.log('Use --force to overwrite or edit it manually.');
				return;
			}

			fs.writeFileSync(configPath, JSON.stringify(exampleConfig, null, 2), 'utf8');
			console.log(`✅ Configuration file created at ${configPath}`);
			console.log('📝 Edit this file to customize your Dispatch setup');
		} catch (error) {
			console.error('❌ Error creating config file:', error.message);
			process.exit(1);
		}
	});

program
	.command('init')
	.description('Initialize Dispatch environment setup')
	.option('--skip-docker', 'Skip Docker image pull')
	.option('--skip-cli', 'Skip making CLI globally available')
	.option('--dispatch-home <path>', 'Dispatch home directory (default: ~/dispatch)')
	.option('--projects-dir <path>', 'Projects directory (default: ~/dispatch/projects)')
	.action(async (options) => {
		try {
			console.log('🚀 Initializing Dispatch environment...\n');

			// Determine dispatch home directory
			let dispatchHome = options.dispatchHome || path.join(os.homedir(), 'dispatch');

			if (!options.dispatchHome) {
				const useCustomHome = await promptYesNo('Use default dispatch home directory ~/dispatch?', true);
				if (!useCustomHome) {
					dispatchHome = await prompt('Enter custom dispatch home directory: ');
					dispatchHome = expandPath(dispatchHome);
				}
			}

			console.log(`📁 Using dispatch home: ${dispatchHome}`);

			// Create dispatch directory
			if (!fs.existsSync(dispatchHome)) {
				const createDir = await promptYesNo(`Create directory ${dispatchHome}?`, true);
				if (createDir) {
					fs.mkdirSync(dispatchHome, { recursive: true });
					console.log(`✅ Created directory: ${dispatchHome}`);
				} else {
					console.log('❌ Cannot proceed without dispatch home directory');
					return;
				}
			} else {
				console.log(`✅ Dispatch home directory already exists: ${dispatchHome}`);
			}

			// Determine projects directory
			let projectsDir = options.projectsDir || path.join(dispatchHome, 'projects');

			if (!options.projectsDir) {
				const useDefaultProjects = await promptYesNo(`Use default projects directory ${path.join(dispatchHome, 'projects')}?`, true);
				if (!useDefaultProjects) {
					projectsDir = await prompt('Enter custom projects directory: ');
					projectsDir = expandPath(projectsDir);
				}
			}

			console.log(`📁 Using projects directory: ${projectsDir}`);

			// Create projects directory
			if (!fs.existsSync(projectsDir)) {
				fs.mkdirSync(projectsDir, { recursive: true });
				console.log(`✅ Created projects directory: ${projectsDir}`);
			} else {
				console.log(`✅ Projects directory already exists: ${projectsDir}`);
			}

			// Copy .claude directory if it exists
			const claudeSourceDir = path.join(os.homedir(), '.claude');
			const claudeTargetDir = path.join(dispatchHome, '.claude');

			if (fs.existsSync(claudeSourceDir)) {
				const copyClaude = await promptYesNo('Copy ~/.claude configuration to dispatch home?', true);
				if (copyClaude) {
					if (copyDirectoryRecursive(claudeSourceDir, claudeTargetDir)) {
						console.log(`✅ Copied .claude configuration to ${claudeTargetDir}`);
					} else {
						console.warn('⚠️  Failed to copy .claude configuration');
					}
				}
			} else {
				console.log('ℹ️  No ~/.claude directory found to copy');
			}

			// Copy .config/dispatch directory if it exists
			const configSourceDir = path.join(os.homedir(), '.config', 'dispatch');
			const configTargetDir = path.join(dispatchHome, '.config', 'dispatch');

			if (fs.existsSync(configSourceDir)) {
				const copyConfig = await promptYesNo('Copy ~/.config/dispatch to dispatch home?', true);
				if (copyConfig) {
					if (copyDirectoryRecursive(configSourceDir, configTargetDir)) {
						console.log(`✅ Copied dispatch configuration to ${configTargetDir}`);
					} else {
						console.warn('⚠️  Failed to copy dispatch configuration');
					}
				}
			} else {
				console.log('ℹ️  No ~/.config/dispatch directory found to copy');
			}

			// Create .config/dispatch directory in dispatch home if it doesn't exist
			if (!fs.existsSync(configTargetDir)) {
				fs.mkdirSync(configTargetDir, { recursive: true });
				console.log(`✅ Created dispatch config directory: ${configTargetDir}`);
			}

			// Save init configuration
			const initConfigPath = path.join(configTargetDir, 'init-config.json');
			const initConfig = {
				dispatchHome,
				projectsDir,
				initDate: new Date().toISOString(),
				version: '0.0.3'
			};

			fs.writeFileSync(initConfigPath, JSON.stringify(initConfig, null, 2), 'utf8');
			console.log(`✅ Saved init configuration to ${initConfigPath}`);

			// Update main CLI configuration to use new paths
			const configDir = path.join(os.homedir(), '.dispatch');
			const configPath = path.join(configDir, 'config.json');

			let config = loadConfig();
			config.volumes.projects = projectsDir;
			config.volumes.home = path.join(dispatchHome, 'home');
			config.volumes.claude = path.join(dispatchHome, '.claude');
			config.volumes.config = path.join(dispatchHome, '.config');

			// Ensure CLI config directory exists
			if (!fs.existsSync(configDir)) {
				fs.mkdirSync(configDir, { recursive: true });
			}

			fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
			console.log(`✅ Updated CLI configuration at ${configPath}`);

			// Ensure home directory exists for container
			const containerHomeDir = path.join(dispatchHome, 'home');
			if (!fs.existsSync(containerHomeDir)) {
				fs.mkdirSync(containerHomeDir, { recursive: true });
				console.log(`✅ Created container home directory: ${containerHomeDir}`);
			}

			// Make CLI available globally
			if (!options.skipCli) {
				const makeCLIAvailable = await promptYesNo('Make dispatch CLI available system-wide?', true);
				if (makeCLIAvailable) {
					await ensureCLIAvailable();
				}
			}

			// Pull Docker image
			if (!options.skipDocker) {
				const pullImage = await promptYesNo('Pull latest Dispatch Docker image?', true);
				if (pullImage) {
					try {
						await pullDockerImage(config.image);
					} catch (error) {
						console.warn('⚠️  Failed to pull Docker image:', error.message);
						console.warn('    You can pull it manually with: docker pull ' + config.image);
					}
				}
			}

			console.log('\n🎉 Dispatch initialization complete!');
			console.log('\nNext steps:');
			console.log('  1. Run "dispatch start" to launch your environment');
			console.log('  2. Open your browser to the provided URL');
			console.log('  3. Enter the terminal key when prompted');
			console.log('\nYour files will be mounted from:');
			console.log(`  - Projects: ${projectsDir}`);
			console.log(`  - Home: ${containerHomeDir}`);

		} catch (error) {
			console.error('❌ Error during initialization:', error.message);
			process.exit(1);
		}
	});

program
	.command('init')
	.description('Initialize Dispatch environment setup')
	.option('--skip-docker', 'Skip Docker image pull')
	.option('--skip-cli', 'Skip making CLI globally available')
	.option('--dispatch-home <path>', 'Dispatch home directory (default: ~/dispatch)')
	.option('--projects-dir <path>', 'Projects directory (default: ~/dispatch/projects)')
	.action(async (options) => {
		try {
			console.log('🚀 Initializing Dispatch environment...\n');

			// Determine dispatch home directory
			let dispatchHome = options.dispatchHome || path.join(os.homedir(), 'dispatch');

			if (!options.dispatchHome) {
				const useCustomHome = await promptYesNo('Use default dispatch home directory ~/dispatch?', true);
				if (!useCustomHome) {
					dispatchHome = await prompt('Enter custom dispatch home directory: ');
					dispatchHome = expandPath(dispatchHome);
				}
			}

			console.log(`📁 Using dispatch home: ${dispatchHome}`);

			// Create dispatch directory
			if (!fs.existsSync(dispatchHome)) {
				const createDir = await promptYesNo(`Create directory ${dispatchHome}?`, true);
				if (createDir) {
					fs.mkdirSync(dispatchHome, { recursive: true });
					console.log(`✅ Created directory: ${dispatchHome}`);
				} else {
					console.log('❌ Cannot proceed without dispatch home directory');
					return;
				}
			} else {
				console.log(`✅ Dispatch home directory already exists: ${dispatchHome}`);
			}

			// Determine projects directory
			let projectsDir = options.projectsDir || path.join(dispatchHome, 'projects');

			if (!options.projectsDir) {
				const useDefaultProjects = await promptYesNo(`Use default projects directory ${path.join(dispatchHome, 'projects')}?`, true);
				if (!useDefaultProjects) {
					projectsDir = await prompt('Enter custom projects directory: ');
					projectsDir = expandPath(projectsDir);
				}
			}

			console.log(`📁 Using projects directory: ${projectsDir}`);

			// Create projects directory
			if (!fs.existsSync(projectsDir)) {
				fs.mkdirSync(projectsDir, { recursive: true });
				console.log(`✅ Created projects directory: ${projectsDir}`);
			} else {
				console.log(`✅ Projects directory already exists: ${projectsDir}`);
			}

			// Copy .claude directory if it exists
			const claudeSourceDir = path.join(os.homedir(), '.claude');
			const claudeTargetDir = path.join(dispatchHome, '.claude');

			if (fs.existsSync(claudeSourceDir)) {
				const copyClaude = await promptYesNo('Copy ~/.claude configuration to dispatch home?', true);
				if (copyClaude) {
					if (copyDirectoryRecursive(claudeSourceDir, claudeTargetDir)) {
						console.log(`✅ Copied .claude configuration to ${claudeTargetDir}`);
					} else {
						console.warn('⚠️  Failed to copy .claude configuration');
					}
				}
			} else {
				console.log('ℹ️  No ~/.claude directory found to copy');
			}

			// Copy .config/dispatch directory if it exists
			const configSourceDir = path.join(os.homedir(), '.config', 'dispatch');
			const configTargetDir = path.join(dispatchHome, '.config', 'dispatch');

			if (fs.existsSync(configSourceDir)) {
				const copyConfig = await promptYesNo('Copy ~/.config/dispatch to dispatch home?', true);
				if (copyConfig) {
					if (copyDirectoryRecursive(configSourceDir, configTargetDir)) {
						console.log(`✅ Copied dispatch configuration to ${configTargetDir}`);
					} else {
						console.warn('⚠️  Failed to copy dispatch configuration');
					}
				}
			} else {
				console.log('ℹ️  No ~/.config/dispatch directory found to copy');
			}

			// Create .config/dispatch directory in dispatch home if it doesn't exist
			if (!fs.existsSync(configTargetDir)) {
				fs.mkdirSync(configTargetDir, { recursive: true });
				console.log(`✅ Created dispatch config directory: ${configTargetDir}`);
			}

			// Save init configuration
			const initConfigPath = path.join(configTargetDir, 'init-config.json');
			const initConfig = {
				dispatchHome,
				projectsDir,
				initDate: new Date().toISOString(),
				version: '0.0.3'
			};

			fs.writeFileSync(initConfigPath, JSON.stringify(initConfig, null, 2), 'utf8');
			console.log(`✅ Saved init configuration to ${initConfigPath}`);

			// Update main CLI configuration to use new paths
			const configDir = path.join(os.homedir(), '.dispatch');
			const configPath = path.join(configDir, 'config.json');

			let config = loadConfig();
			config.volumes.projects = projectsDir;
			config.volumes.home = path.join(dispatchHome, 'home');
			config.volumes.claude = path.join(dispatchHome, '.claude');
			config.volumes.config = path.join(dispatchHome, '.config');

			// Ensure CLI config directory exists
			if (!fs.existsSync(configDir)) {
				fs.mkdirSync(configDir, { recursive: true });
			}

			fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
			console.log(`✅ Updated CLI configuration at ${configPath}`);

			// Ensure home directory exists for container
			const containerHomeDir = path.join(dispatchHome, 'home');
			if (!fs.existsSync(containerHomeDir)) {
				fs.mkdirSync(containerHomeDir, { recursive: true });
				console.log(`✅ Created container home directory: ${containerHomeDir}`);
			}

			// Make CLI available globally
			if (!options.skipCli) {
				const makeCLIAvailable = await promptYesNo('Make dispatch CLI available system-wide?', true);
				if (makeCLIAvailable) {
					await ensureCLIAvailable();
				}
			}

			// Pull Docker image
			if (!options.skipDocker) {
				const pullImage = await promptYesNo('Pull latest Dispatch Docker image?', true);
				if (pullImage) {
					try {
						await pullDockerImage(config.image);
					} catch (error) {
						console.warn('⚠️  Failed to pull Docker image:', error.message);
						console.warn('    You can pull it manually with: docker pull ' + config.image);
					}
				}
			}

			console.log('\n🎉 Dispatch initialization complete!');
			console.log('\nNext steps:');
			console.log('  1. Run "dispatch start" to launch your environment');
			console.log('  2. Open your browser to the provided URL');
			console.log('  3. Enter the terminal key when prompted');
			console.log('\nYour files will be mounted from:');
			console.log(`  - Projects: ${projectsDir}`);
			console.log(`  - Home: ${containerHomeDir}`);

		} catch (error) {
			console.error('❌ Error during initialization:', error.message);
			process.exit(1);
		}
	});

program
	.command('status')
	.description('Check if Dispatch container is running')
	.action(async () => {
		try {
			const ps = spawn(
				'docker',
				[
					'ps',
					'--filter',
					'name=dispatch',
					'--format',
					'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
				],
				{
					stdio: ['inherit', 'pipe', 'inherit']
				}
			);

			let output = '';
			ps.stdout.on('data', (data) => {
				output += data.toString();
			});

			ps.on('close', (code) => {
				if (code === 0) {
					const lines = output.trim().split('\n');
					if (lines.length > 1) {
						console.log('📊 Dispatch Container Status:');
						console.log(output);
					} else {
						console.log('📴 No Dispatch container is currently running');
						console.log('💡 Use "dispatch start" to start a new container');
					}
				}
			});
		} catch (error) {
			console.error('❌ Error checking status:', error.message);
			process.exit(1);
		}
	});

program.parse();
