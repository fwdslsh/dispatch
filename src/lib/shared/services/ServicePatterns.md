# Simple Service Patterns

This document defines simple, consistent patterns for services without unnecessary complexity.

## Basic Service Pattern

All services should follow this simple pattern:

```javascript
export class MyService {
	constructor(dependencies) {
		// Simple constructor with direct dependencies
		this.socket = dependencies.socket;
		this.someState = $state(null);
	}

	// Methods return simple objects, not complex abstractions
	async doSomething(data) {
		try {
			const response = await this.socket.emit('do-something', data);

			if (response.success) {
				this.someState = response.data;
				return { success: true, data: response.data };
			} else {
				return { success: false, error: response.error };
			}
		} catch (error) {
			console.error('MyService: Error in doSomething:', error);
			return { success: false, error: error.message };
		}
	}

	// Simple cleanup
	destroy() {
		this.someState = null;
	}
}
```

## Error Handling Pattern

Simple, consistent error handling:

```javascript
// ✅ Simple and consistent
async myMethod(data) {
  try {
    const result = await this.doWork(data);
    return { success: true, data: result };
  } catch (error) {
    console.error('ServiceName: Error in myMethod:', error);
    return { success: false, error: error.message };
  }
}
```

## Socket Service Pattern

For services that use socket communication:

```javascript
async callServer(event, data) {
  try {
    const response = await new Promise((resolve) => {
      this.socket.emit(event, data, resolve);
    });

    return response.success ?
      { success: true, data: response.data } :
      { success: false, error: response.error };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

## State Management Pattern

Simple reactive state in services:

```javascript
export class StateService {
	constructor() {
		// Simple reactive state
		this.items = $state([]);
		this.currentItem = $state(null);
		this.isLoading = $state(false);

		// Simple computed values
		this.hasItems = $derived(() => this.items.length > 0);
	}

	// Simple state updates
	setLoading(loading) {
		this.isLoading = loading;
	}

	addItem(item) {
		this.items.push(item);
	}

	setCurrentItem(item) {
		this.currentItem = item;
	}
}
```

## What NOT to do

Avoid these over-engineered patterns:

```javascript
// ❌ Complex interfaces and abstractions
interface IComplexService<T> {
  execute<R>(command: Command<T, R>): Promise<Result<R, Error>>;
}

// ❌ Service locator pattern
const service = ServiceLocator.get<IMyService>('MyService');

// ❌ Complex dependency injection
@Injectable()
class MyService {
  constructor(@Inject('SOCKET') private socket: ISocket) {}
}

// ❌ Complex error handling
class ComplexError extends Error {
  constructor(code: ErrorCode, context: ErrorContext) {
    super();
    // ... complex error handling
  }
}
```

## Summary

Keep it simple:

1. **Direct dependencies** in constructor
2. **Simple return objects** `{ success, data?, error? }`
3. **Basic error handling** with try/catch and console.error
4. **Reactive state** using Svelte 5 runes
5. **No abstractions** unless truly necessary
