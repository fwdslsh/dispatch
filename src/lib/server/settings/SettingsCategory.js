/**
 * SettingsCategory Model
 * Represents a logical grouping of related configuration settings
 */

export class SettingsCategory {
	/**
	 * Create a SettingsCategory instance
	 * @param {Object} data - Category data
	 * @param {string} data.id - Unique identifier
	 * @param {string} data.name - Display name
	 * @param {string} data.description - Category description
	 * @param {number} data.display_order - Display order in UI
	 */
	constructor({ id, name, description, display_order }) {
		this.id = id;
		this.name = name;
		this.description = description;
		this.display_order = display_order;
	}

	/**
	 * Validate category data
	 * @returns {Array<string>} Array of validation errors (empty if valid)
	 */
	validate() {
		const errors = [];

		if (!this.id || typeof this.id !== 'string' || this.id.trim().length === 0) {
			errors.push('Category ID is required and must be a non-empty string');
		}

		if (!this.name || typeof this.name !== 'string' || this.name.trim().length === 0) {
			errors.push('Category name is required and must be a non-empty string');
		}

		if (!this.description || typeof this.description !== 'string') {
			errors.push('Category description is required and must be a string');
		}

		if (typeof this.display_order !== 'number' || this.display_order < 0) {
			errors.push('Display order must be a non-negative number');
		}

		return errors;
	}

	/**
	 * Convert to plain object for database storage
	 * @returns {Object} Plain object representation
	 */
	toObject() {
		return {
			id: this.id,
			name: this.name,
			description: this.description,
			display_order: this.display_order
		};
	}

	/**
	 * Create SettingsCategory from database row
	 * @param {Object} row - Database row
	 * @returns {SettingsCategory}
	 */
	static fromRow(row) {
		return new SettingsCategory({
			id: row.id,
			name: row.name,
			description: row.description,
			display_order: row.display_order
		});
	}

	/**
	 * Database operations for SettingsCategory
	 */
	static createRepository(db) {
		return {
			/**
			 * Find all categories ordered by display_order
			 * @returns {Array<SettingsCategory>}
			 */
			findAll() {
				const stmt = db.prepare(`
					SELECT id, name, description, display_order
					FROM settings_categories
					ORDER BY display_order ASC
				`);
				const rows = stmt.all();
				return rows.map((row) => SettingsCategory.fromRow(row));
			},

			/**
			 * Find category by ID
			 * @param {string} id - Category ID
			 * @returns {SettingsCategory|null}
			 */
			findById(id) {
				const stmt = db.prepare(`
					SELECT id, name, description, display_order
					FROM settings_categories
					WHERE id = ?
				`);
				const row = stmt.get(id);
				return row ? SettingsCategory.fromRow(row) : null;
			},

			/**
			 * Create new category
			 * @param {SettingsCategory} category
			 * @returns {boolean} Success status
			 */
			create(category) {
				const errors = category.validate();
				if (errors.length > 0) {
					throw new Error(`Validation failed: ${errors.join(', ')}`);
				}

				const stmt = db.prepare(`
					INSERT INTO settings_categories (id, name, description, display_order)
					VALUES (?, ?, ?, ?)
				`);

				try {
					const result = stmt.run(
						category.id,
						category.name,
						category.description,
						category.display_order
					);
					return result.changes > 0;
				} catch (error) {
					if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
						throw new Error(`Category with ID '${category.id}' already exists`);
					}
					throw error;
				}
			},

			/**
			 * Update existing category
			 * @param {string} id - Category ID
			 * @param {Object} updates - Fields to update
			 * @returns {boolean} Success status
			 */
			update(id, updates) {
				const allowedFields = ['name', 'description', 'display_order'];
				const validUpdates = {};

				// Filter and validate updates
				for (const [key, value] of Object.entries(updates)) {
					if (allowedFields.includes(key)) {
						validUpdates[key] = value;
					}
				}

				if (Object.keys(validUpdates).length === 0) {
					return false;
				}

				const setClause = Object.keys(validUpdates)
					.map((key) => `${key} = ?`)
					.join(', ');

				const stmt = db.prepare(`
					UPDATE settings_categories
					SET ${setClause}
					WHERE id = ?
				`);

				const values = [...Object.values(validUpdates), id];
				const result = stmt.run(...values);
				return result.changes > 0;
			},

			/**
			 * Delete category (only if no settings reference it)
			 * @param {string} id - Category ID
			 * @returns {boolean} Success status
			 */
			delete(id) {
				// Check if any settings reference this category
				const checkStmt = db.prepare(`
					SELECT COUNT(*) as count
					FROM configuration_settings
					WHERE category_id = ?
				`);
				const settingsCount = checkStmt.get(id);

				if (settingsCount.count > 0) {
					throw new Error(
						`Cannot delete category '${id}': ${settingsCount.count} settings reference it`
					);
				}

				const stmt = db.prepare(`
					DELETE FROM settings_categories WHERE id = ?
				`);
				const result = stmt.run(id);
				return result.changes > 0;
			}
		};
	}
}

export default SettingsCategory;
