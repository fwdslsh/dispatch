import { promises as fs } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { logger } from '../utils/logger.js';

/**
 * WorkspaceTemplateService - Pre-configured workspace templates
 *
 * Provides workspace templates with boilerplate files for quick project starts.
 * Supports template creation, management, and workspace instantiation from templates.
 */
export class WorkspaceTemplateService {
	constructor(database, workspaceService = null) {
		this.db = database;
		this.workspaceService = workspaceService;
		this.templates = new Map();
		this.isInitialized = false;
		this.templatesPath = process.env.TEMPLATES_PATH || join(process.cwd(), 'templates');
	}

	/**
	 * Initialize the template service
	 */
	async init() {
		if (this.isInitialized) return;

		await this.db.init();

		// Create workspace templates table
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS workspace_templates (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT,
				category TEXT DEFAULT 'general',
				template_config TEXT NOT NULL, -- JSON configuration
				file_structure TEXT NOT NULL,  -- JSON file structure
				is_active BOOLEAN DEFAULT 1,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				usage_count INTEGER DEFAULT 0
			)
		`);

		// Create template usage tracking
		await this.db.run(`
			CREATE TABLE IF NOT EXISTS template_usage (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				template_id TEXT NOT NULL,
				workspace_path TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				FOREIGN KEY (template_id) REFERENCES workspace_templates(id)
			)
		`);

		// Ensure templates directory exists
		try {
			await fs.mkdir(this.templatesPath, { recursive: true });
		} catch (error) {
			logger.warn('TEMPLATE', `Could not create templates directory: ${this.templatesPath}`, error);
		}

		// Load existing templates
		await this.loadTemplates();

		// Create default templates if none exist
		await this.createDefaultTemplates();

		this.isInitialized = true;
		logger.info(
			'TEMPLATE',
			`WorkspaceTemplateService initialized with ${this.templates.size} templates`
		);
	}

	/**
	 * Load templates from database
	 */
	async loadTemplates() {
		const templates = await this.db.all('SELECT * FROM workspace_templates WHERE is_active = 1');

		this.templates.clear();
		for (const template of templates) {
			try {
				const config = JSON.parse(template.template_config);
				const fileStructure = JSON.parse(template.file_structure);

				this.templates.set(template.id, {
					...template,
					config,
					fileStructure
				});
			} catch (error) {
				logger.warn('TEMPLATE', `Failed to parse template ${template.id}:`, error);
			}
		}
	}

	/**
	 * Create default workspace templates
	 */
	async createDefaultTemplates() {
		const existingTemplates = await this.db.get(
			'SELECT COUNT(*) as count FROM workspace_templates'
		);
		if (existingTemplates.count > 0) {
			return; // Templates already exist
		}

		const defaultTemplates = [
			{
				id: 'empty',
				name: 'Empty Workspace',
				description: 'A clean, empty workspace for starting from scratch',
				category: 'general',
				config: {
					defaultShell: 'bash',
					environmentVariables: {},
					startupCommands: []
				},
				fileStructure: {
					'README.md': {
						type: 'file',
						content:
							'# {{workspaceName}}\n\nA new workspace created with Dispatch.\n\n## Getting Started\n\nThis is your project workspace. Add your files and start coding!\n'
					}
				}
			},
			{
				id: 'nodejs',
				name: 'Node.js Project',
				description: 'Node.js project template with package.json and basic structure',
				category: 'development',
				config: {
					defaultShell: 'bash',
					environmentVariables: {
						NODE_ENV: 'development'
					},
					startupCommands: ['npm install']
				},
				fileStructure: {
					'package.json': {
						type: 'file',
						content: JSON.stringify(
							{
								name: '{{workspaceSlug}}',
								version: '1.0.0',
								description: '{{description}}',
								main: 'index.js',
								scripts: {
									start: 'node index.js',
									dev: 'node --watch index.js',
									test: 'echo "Error: no test specified" && exit 1'
								},
								keywords: [],
								author: '',
								license: 'ISC'
							},
							null,
							2
						)
					},
					'index.js': {
						type: 'file',
						content: `console.log('Hello from {{workspaceName}}!');\n\n// Your Node.js application starts here\n`
					},
					'README.md': {
						type: 'file',
						content:
							'# {{workspaceName}}\n\n{{description}}\n\n## Installation\n\n```bash\nnpm install\n```\n\n## Usage\n\n```bash\nnpm start\n```\n\n## Development\n\n```bash\nnpm run dev\n```\n'
					},
					'.gitignore': {
						type: 'file',
						content: 'node_modules/\n.env\n.env.local\n*.log\n.DS_Store\n'
					}
				}
			},
			{
				id: 'python',
				name: 'Python Project',
				description: 'Python project template with virtual environment setup',
				category: 'development',
				config: {
					defaultShell: 'bash',
					environmentVariables: {
						PYTHONPATH: '.'
					},
					startupCommands: [
						'python3 -m venv venv',
						'source venv/bin/activate',
						'pip install -r requirements.txt'
					]
				},
				fileStructure: {
					'main.py': {
						type: 'file',
						content:
							'#!/usr/bin/env python3\n"""{{workspaceName}} - {{description}}"""\n\ndef main():\n    print("Hello from {{workspaceName}}!")\n    # Your Python application starts here\n\nif __name__ == "__main__":\n    main()\n'
					},
					'requirements.txt': {
						type: 'file',
						content:
							'# Add your Python dependencies here\n# Example:\n# requests>=2.25.0\n# flask>=2.0.0\n'
					},
					'README.md': {
						type: 'file',
						content:
							'# {{workspaceName}}\n\n{{description}}\n\n## Setup\n\n```bash\npython3 -m venv venv\nsource venv/bin/activate\npip install -r requirements.txt\n```\n\n## Usage\n\n```bash\npython main.py\n```\n'
					},
					'.gitignore': {
						type: 'file',
						content: '__pycache__/\n*.py[cod]\n*$py.class\nvenv/\n.env\n.vscode/\n*.log\n'
					}
				}
			},
			{
				id: 'web-frontend',
				name: 'Web Frontend',
				description: 'Basic HTML/CSS/JavaScript frontend template',
				category: 'web',
				config: {
					defaultShell: 'bash',
					environmentVariables: {},
					startupCommands: []
				},
				fileStructure: {
					'index.html': {
						type: 'file',
						content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>{{workspaceName}}</title>\n    <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n    <header>\n        <h1>{{workspaceName}}</h1>\n    </header>\n    <main>\n        <p>{{description}}</p>\n        <p>Welcome to your new web project!</p>\n    </main>\n    <script src="script.js"></script>\n</body>\n</html>`
					},
					'styles.css': {
						type: 'file',
						content: `/* {{workspaceName}} Styles */\n\n* {\n    margin: 0;\n    padding: 0;\n    box-sizing: border-box;\n}\n\nbody {\n    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;\n    line-height: 1.6;\n    color: #333;\n    background-color: #f4f4f4;\n}\n\nheader {\n    background: #333;\n    color: white;\n    text-align: center;\n    padding: 1rem;\n}\n\nmain {\n    max-width: 800px;\n    margin: 2rem auto;\n    padding: 2rem;\n    background: white;\n    border-radius: 8px;\n    box-shadow: 0 2px 10px rgba(0,0,0,0.1);\n}\n\nh1 {\n    margin-bottom: 1rem;\n}\n\np {\n    margin-bottom: 1rem;\n}`
					},
					'script.js': {
						type: 'file',
						content: `// {{workspaceName}} JavaScript\n\nconsole.log('Welcome to {{workspaceName}}!');\n\n// Your JavaScript code goes here\ndocument.addEventListener('DOMContentLoaded', function() {\n    console.log('DOM loaded and ready!');\n});\n`
					},
					'README.md': {
						type: 'file',
						content:
							'# {{workspaceName}}\n\n{{description}}\n\n## Getting Started\n\n1. Open `index.html` in your browser\n2. Edit the HTML, CSS, and JavaScript files\n3. Refresh to see your changes\n\n## Files\n\n- `index.html` - Main HTML file\n- `styles.css` - CSS styles\n- `script.js` - JavaScript code\n'
					}
				}
			},
			{
				id: 'react-app',
				name: 'React Application',
				description: 'React application template with modern setup',
				category: 'web',
				config: {
					defaultShell: 'bash',
					environmentVariables: {
						NODE_ENV: 'development'
					},
					startupCommands: ['npm install', 'npm start']
				},
				fileStructure: {
					'package.json': {
						type: 'file',
						content: JSON.stringify(
							{
								name: '{{workspaceSlug}}',
								version: '0.1.0',
								description: '{{description}}',
								dependencies: {
									react: '^18.2.0',
									'react-dom': '^18.2.0',
									'react-scripts': '5.0.1'
								},
								scripts: {
									start: 'react-scripts start',
									build: 'react-scripts build',
									test: 'react-scripts test',
									eject: 'react-scripts eject'
								},
								eslintConfig: {
									extends: ['react-app']
								},
								browserslist: {
									production: ['>0.2%', 'not dead', 'not op_mini all'],
									development: [
										'last 1 chrome version',
										'last 1 firefox version',
										'last 1 safari version'
									]
								}
							},
							null,
							2
						)
					},
					'public/index.html': {
						type: 'file',
						content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>{{workspaceName}}</title>\n  </head>\n  <body>\n    <noscript>You need to enable JavaScript to run this app.</noscript>\n    <div id="root"></div>\n  </body>\n</html>`
					},
					'src/App.js': {
						type: 'file',
						content: `import React from 'react';\nimport './App.css';\n\nfunction App() {\n  return (\n    <div className="App">\n      <header className="App-header">\n        <h1>{{workspaceName}}</h1>\n        <p>{{description}}</p>\n        <p>Edit <code>src/App.js</code> and save to reload.</p>\n      </header>\n    </div>\n  );\n}\n\nexport default App;`
					},
					'src/App.css': {
						type: 'file',
						content: `.App {\n  text-align: center;\n}\n\n.App-header {\n  background-color: #282c34;\n  padding: 20px;\n  color: white;\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  font-size: calc(10px + 2vmin);\n}\n\n.App-header h1 {\n  margin-bottom: 1rem;\n}\n\n.App-header p {\n  margin-bottom: 1rem;\n}\n\ncode {\n  background-color: rgba(0, 0, 0, 0.1);\n  padding: 0.2rem 0.4rem;\n  border-radius: 4px;\n}`
					},
					'src/index.js': {
						type: 'file',
						content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport './index.css';\nimport App from './App';\n\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);`
					},
					'src/index.css': {
						type: 'file',
						content: `body {\n  margin: 0;\n  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',\n    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',\n    sans-serif;\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n}\n\ncode {\n  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',\n    monospace;\n}`
					},
					'README.md': {
						type: 'file',
						content:
							'# {{workspaceName}}\n\n{{description}}\n\nThis project was created with Create React App template.\n\n## Available Scripts\n\n### `npm start`\n\nRuns the app in development mode.\nOpen [http://localhost:3000](http://localhost:3000) to view it in your browser.\n\n### `npm test`\n\nLaunches the test runner in interactive watch mode.\n\n### `npm run build`\n\nBuilds the app for production to the `build` folder.\n'
					}
				}
			}
		];

		for (const template of defaultTemplates) {
			await this.createTemplate(template);
		}

		logger.info('TEMPLATE', `Created ${defaultTemplates.length} default workspace templates`);
	}

	/**
	 * Create a new workspace template
	 * @param {Object} templateData - Template configuration
	 * @returns {Promise<string>} Template ID
	 */
	async createTemplate(templateData) {
		await this.init();

		const {
			id = `template_${Date.now()}`,
			name,
			description,
			category = 'general',
			config,
			fileStructure
		} = templateData;

		const now = Date.now();

		await this.db.run(
			`INSERT INTO workspace_templates
			 (id, name, description, category, template_config, file_structure, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				name,
				description,
				category,
				JSON.stringify(config),
				JSON.stringify(fileStructure),
				now,
				now
			]
		);

		// Add to memory
		this.templates.set(id, {
			id,
			name,
			description,
			category,
			template_config: JSON.stringify(config),
			file_structure: JSON.stringify(fileStructure),
			config,
			fileStructure,
			is_active: true,
			created_at: now,
			updated_at: now,
			usage_count: 0
		});

		logger.info('TEMPLATE', `Created workspace template: ${id} (${name})`);
		return id;
	}

	/**
	 * Update an existing template
	 * @param {string} templateId - Template ID
	 * @param {Object} updates - Template updates
	 * @returns {Promise<boolean>} Success status
	 */
	async updateTemplate(templateId, updates) {
		await this.init();

		const template = this.templates.get(templateId);
		if (!template) {
			throw new Error(`Template not found: ${templateId}`);
		}

		const updateFields = [];
		const updateValues = [];

		if (updates.name !== undefined) {
			updateFields.push('name = ?');
			updateValues.push(updates.name);
		}

		if (updates.description !== undefined) {
			updateFields.push('description = ?');
			updateValues.push(updates.description);
		}

		if (updates.category !== undefined) {
			updateFields.push('category = ?');
			updateValues.push(updates.category);
		}

		if (updates.config !== undefined) {
			updateFields.push('template_config = ?');
			updateValues.push(JSON.stringify(updates.config));
		}

		if (updates.fileStructure !== undefined) {
			updateFields.push('file_structure = ?');
			updateValues.push(JSON.stringify(updates.fileStructure));
		}

		updateFields.push('updated_at = ?');
		updateValues.push(Date.now());

		updateValues.push(templateId);

		await this.db.run(
			`UPDATE workspace_templates SET ${updateFields.join(', ')} WHERE id = ?`,
			updateValues
		);

		// Reload templates
		await this.loadTemplates();

		logger.info('TEMPLATE', `Updated workspace template: ${templateId}`);
		return true;
	}

	/**
	 * Delete a workspace template
	 * @param {string} templateId - Template ID
	 * @param {boolean} [hard=false] - Hard delete vs soft delete
	 * @returns {Promise<boolean>} Success status
	 */
	async deleteTemplate(templateId, hard = false) {
		await this.init();

		if (hard) {
			await this.db.run('DELETE FROM workspace_templates WHERE id = ?', [templateId]);
			await this.db.run('DELETE FROM template_usage WHERE template_id = ?', [templateId]);
		} else {
			await this.db.run('UPDATE workspace_templates SET is_active = 0 WHERE id = ?', [templateId]);
		}

		this.templates.delete(templateId);

		logger.info('TEMPLATE', `${hard ? 'Hard' : 'Soft'} deleted workspace template: ${templateId}`);
		return true;
	}

	/**
	 * Create workspace from template
	 * @param {string} templateId - Template ID
	 * @param {Object} options - Workspace creation options
	 * @param {string} options.workspacePath - Target workspace path
	 * @param {string} [options.workspaceName] - Workspace name for templating
	 * @param {string} [options.description] - Workspace description for templating
	 * @param {Object} [options.variables] - Additional template variables
	 * @returns {Promise<Object>} Creation result
	 */
	async createWorkspaceFromTemplate(templateId, options) {
		await this.init();

		const template = this.templates.get(templateId);
		if (!template) {
			throw new Error(`Template not found: ${templateId}`);
		}

		const {
			workspacePath,
			workspaceName = this.extractWorkspaceName(workspacePath),
			description = `Workspace created from ${template.name} template`,
			variables = {}
		} = options;

		try {
			// Ensure workspace directory exists
			await fs.mkdir(workspacePath, { recursive: true });

			// Prepare template variables
			const templateVars = {
				workspaceName,
				workspaceSlug: this.slugify(workspaceName),
				workspacePath,
				description,
				createdAt: new Date().toISOString(),
				...variables
			};

			// Create file structure
			await this.createFileStructure(workspacePath, template.fileStructure, templateVars);

			// Create workspace entry if WorkspaceService is available
			if (this.workspaceService) {
				await this.workspaceService.createWorkspace({
					path: workspacePath,
					name: workspaceName,
					description
				});
			}

			// Track template usage
			await this.trackTemplateUsage(templateId, workspacePath);

			// Increment usage count
			await this.db.run(
				'UPDATE workspace_templates SET usage_count = usage_count + 1 WHERE id = ?',
				[templateId]
			);

			logger.info('TEMPLATE', `Created workspace from template ${templateId}: ${workspacePath}`);

			return {
				templateId,
				templateName: template.name,
				workspacePath,
				workspaceName,
				createdFiles: await this.countFiles(workspacePath),
				config: template.config
			};
		} catch (error) {
			logger.error('TEMPLATE', `Failed to create workspace from template ${templateId}:`, error);
			throw error;
		}
	}

	/**
	 * Create file structure from template
	 * @param {string} basePath - Base directory path
	 * @param {Object} structure - File structure definition
	 * @param {Object} variables - Template variables
	 */
	async createFileStructure(basePath, structure, variables) {
		for (const [path, definition] of Object.entries(structure)) {
			const fullPath = join(basePath, path);

			if (definition.type === 'file') {
				// Ensure directory exists
				await fs.mkdir(dirname(fullPath), { recursive: true });

				// Process template content
				const content = this.processTemplate(definition.content, variables);

				// Write file
				await fs.writeFile(fullPath, content, 'utf8');

				logger.debug('TEMPLATE', `Created file: ${fullPath}`);
			} else if (definition.type === 'directory') {
				// Create directory
				await fs.mkdir(fullPath, { recursive: true });

				// Process nested structure if it exists
				if (definition.contents) {
					await this.createFileStructure(fullPath, definition.contents, variables);
				}

				logger.debug('TEMPLATE', `Created directory: ${fullPath}`);
			}
		}
	}

	/**
	 * Process template content with variables
	 * @param {string} content - Template content
	 * @param {Object} variables - Template variables
	 * @returns {string} Processed content
	 */
	processTemplate(content, variables) {
		let processed = content;

		// Simple template variable replacement
		for (const [key, value] of Object.entries(variables)) {
			const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
			processed = processed.replace(regex, value);
		}

		return processed;
	}

	/**
	 * Track template usage
	 * @param {string} templateId - Template ID
	 * @param {string} workspacePath - Workspace path
	 */
	async trackTemplateUsage(templateId, workspacePath) {
		await this.db.run(
			'INSERT INTO template_usage (template_id, workspace_path, created_at) VALUES (?, ?, ?)',
			[templateId, workspacePath, Date.now()]
		);
	}

	/**
	 * Count files in directory
	 * @param {string} dirPath - Directory path
	 * @returns {Promise<number>} File count
	 */
	async countFiles(dirPath) {
		try {
			const items = await fs.readdir(dirPath, { withFileTypes: true });
			let count = 0;

			for (const item of items) {
				if (item.isFile()) {
					count++;
				} else if (item.isDirectory()) {
					count += await this.countFiles(join(dirPath, item.name));
				}
			}

			return count;
		} catch (error) {
			return 0;
		}
	}

	/**
	 * Extract workspace name from path
	 * @param {string} path - Workspace path
	 * @returns {string} Workspace name
	 */
	extractWorkspaceName(path) {
		const segments = path.split('/').filter(Boolean);
		return segments[segments.length - 1] || 'Workspace';
	}

	/**
	 * Create URL-friendly slug from name
	 * @param {string} name - Name to slugify
	 * @returns {string} Slug
	 */
	slugify(name) {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	/**
	 * List available templates
	 * @param {Object} [options] - Filter options
	 * @param {string} [options.category] - Filter by category
	 * @param {boolean} [options.includeUsageStats=false] - Include usage statistics
	 * @returns {Promise<Array>} List of templates
	 */
	async listTemplates(options = {}) {
		await this.init();

		const { category, includeUsageStats = false } = options;

		let templates = Array.from(this.templates.values());

		// Filter by category if specified
		if (category) {
			templates = templates.filter((t) => t.category === category);
		}

		// Format for API
		const result = templates.map((t) => ({
			id: t.id,
			name: t.name,
			description: t.description,
			category: t.category,
			usageCount: t.usage_count,
			createdAt: new Date(t.created_at).toISOString(),
			updatedAt: new Date(t.updated_at).toISOString()
		}));

		// Add usage statistics if requested
		if (includeUsageStats) {
			for (const template of result) {
				const recentUsage = await this.db.get(
					'SELECT COUNT(*) as count FROM template_usage WHERE template_id = ? AND created_at > ?',
					[template.id, Date.now() - 30 * 24 * 60 * 60 * 1000] // Last 30 days
				);
				template.recentUsage = recentUsage.count;
			}
		}

		return result;
	}

	/**
	 * Get template details
	 * @param {string} templateId - Template ID
	 * @returns {Promise<Object|null>} Template details
	 */
	async getTemplate(templateId) {
		await this.init();

		const template = this.templates.get(templateId);
		if (!template) {
			return null;
		}

		return {
			id: template.id,
			name: template.name,
			description: template.description,
			category: template.category,
			config: template.config,
			fileStructure: template.fileStructure,
			usageCount: template.usage_count,
			createdAt: new Date(template.created_at).toISOString(),
			updatedAt: new Date(template.updated_at).toISOString()
		};
	}

	/**
	 * Get template categories
	 * @returns {Promise<Array>} List of categories with counts
	 */
	async getCategories() {
		await this.init();

		const categories = await this.db.all(
			`SELECT category, COUNT(*) as count
			 FROM workspace_templates
			 WHERE is_active = 1
			 GROUP BY category
			 ORDER BY category`
		);

		return categories.map((c) => ({
			name: c.category,
			count: c.count,
			displayName: this.formatCategoryName(c.category)
		}));
	}

	/**
	 * Format category name for display
	 * @param {string} category - Category name
	 * @returns {string} Display name
	 */
	formatCategoryName(category) {
		return category
			.split('-')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	/**
	 * Get template usage statistics
	 * @param {string} [templateId] - Specific template ID
	 * @returns {Promise<Object>} Usage statistics
	 */
	async getUsageStats(templateId = null) {
		await this.init();

		const totalTemplates = await this.db.get(
			'SELECT COUNT(*) as count FROM workspace_templates WHERE is_active = 1'
		);

		let totalUsage, recentUsage, popularTemplates;

		if (templateId) {
			// Stats for specific template
			totalUsage = await this.db.get(
				'SELECT COUNT(*) as count FROM template_usage WHERE template_id = ?',
				[templateId]
			);
			recentUsage = await this.db.get(
				'SELECT COUNT(*) as count FROM template_usage WHERE template_id = ? AND created_at > ?',
				[templateId, Date.now() - 30 * 24 * 60 * 60 * 1000]
			);
		} else {
			// Global stats
			totalUsage = await this.db.get('SELECT COUNT(*) as count FROM template_usage');
			recentUsage = await this.db.get(
				'SELECT COUNT(*) as count FROM template_usage WHERE created_at > ?',
				[Date.now() - 30 * 24 * 60 * 60 * 1000]
			);

			popularTemplates = await this.db.all(
				`SELECT wt.id, wt.name, wt.usage_count
				 FROM workspace_templates wt
				 WHERE wt.is_active = 1
				 ORDER BY wt.usage_count DESC
				 LIMIT 5`
			);
		}

		return {
			totalTemplates: totalTemplates.count,
			totalUsage: totalUsage.count,
			recentUsage: recentUsage.count,
			popularTemplates: popularTemplates || []
		};
	}

	/**
	 * Cleanup service resources
	 */
	cleanup() {
		this.templates.clear();
		logger.info('TEMPLATE', 'WorkspaceTemplateService cleanup complete');
	}
}
