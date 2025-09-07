# JavaScript Style Guide

We use modern ESM JavaScript with a preference for classes for object-oriented functionality and functional programming patterns where appropriate.

## Module Structure

- Use ES6 modules (`import`/`export`) exclusively
- Place imports at the top, organized by: built-ins, external packages, internal modules
- Use named exports for utilities, default exports for main components/classes
- Keep modules focused on a single responsibility

```javascript
// External imports
import { EventEmitter } from 'node:events';
import express from 'express';

// Internal imports
import { DatabaseService } from './services/database.js';
import { validateInput } from '../utils/validation.js';

export class ApiServer extends EventEmitter {
	// Implementation
}

export { validateInput };
```

## Class Design

- Use classes for stateful objects and when inheritance/polymorphism adds value
- Prefer composition over inheritance
- Use private fields (`#`) for internal state
- Keep constructors simple, delegate complex initialization to methods

```javascript
export class UserService {
	#database;
	#cache = new Map();

	constructor(database) {
		this.#database = database;
	}

	async findUser(id) {
		if (this.#cache.has(id)) {
			return this.#cache.get(id);
		}

		const user = await this.#database.users.findById(id);
		this.#cache.set(id, user);
		return user;
	}
}
```

## Functional Programming

- Prefer pure functions for data transformation and business logic
- Use array methods (`map`, `filter`, `reduce`) over loops
- Leverage destructuring and spread operators for clean data manipulation
- Use `const` by default, `let` only when reassignment is needed

```javascript
// Data transformation pipeline
export const processUsers = (users) =>
	users
		.filter((user) => user.active)
		.map(({ id, name, email }) => ({ id, name, email }))
		.sort((a, b) => a.name.localeCompare(b.name));

// Higher-order function for validation
export const createValidator = (schema) => (data) => schema.validate(data);
```

## Async Patterns

- Use `async/await` over promises chains
- Handle errors with try/catch blocks close to the operation
- Use `Promise.all()` for concurrent operations
- Prefer explicit error handling over silent failures

```javascript
export class DataProcessor {
	async processMultipleFiles(filePaths) {
		try {
			const results = await Promise.all(filePaths.map((path) => this.#processFile(path)));
			return results.filter(Boolean);
		} catch (error) {
			throw new ProcessingError(`Failed to process files: ${error.message}`);
		}
	}
}
```

## Error Handling

- Create custom error classes for domain-specific errors
- Use descriptive error messages with context
- Fail fast and provide clear feedback
- Log errors at appropriate levels

```javascript
export class ValidationError extends Error {
	constructor(field, value, constraint) {
		super(`Invalid ${field}: ${value} does not meet ${constraint}`);
		this.name = 'ValidationError';
		this.field = field;
		this.value = value;
	}
}
```

## JSDoc Documentation

- Use JSDoc for type definitions and comprehensive documentation
- Document all public APIs with parameter types, return types, and examples
- Use `@typedef` for complex object shapes and custom types
- Include `@throws` for functions that can throw specific errors

```javascript
/**
 * @typedef {Object} User
 * @property {string} id - Unique user identifier
 * @property {string} name - User's display name
 * @property {string} email - User's email address
 * @property {boolean} active - Whether the user account is active
 */

/**
 * Service for managing user data and operations
 */
export class UserService {
	/**
	 * Find a user by ID with caching
	 * @param {string} id - The user ID to search for
	 * @returns {Promise<User|null>} The user object or null if not found
	 * @throws {DatabaseError} When database connection fails
	 * @example
	 * const user = await userService.findUser('123');
	 * if (user) console.log(user.name);
	 */
	async findUser(id) {
		// Implementation
	}

	/**
	 * Process and transform user data
	 * @param {User[]} users - Array of user objects to process
	 * @returns {User[]} Filtered and sorted active users
	 */
	static processUsers(users) {
		// Implementation
	}
}
```
