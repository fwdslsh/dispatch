/**
 * Type definitions for test setup
 * Augments Vitest matchers and testing library types
 */

import '@testing-library/jest-dom';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
	interface Assertion<T = any> extends jest.Matchers<void, T>, TestingLibraryMatchers<T, void> {}
	interface AsymmetricMatchersContaining
		extends jest.Matchers<void, any>,
			TestingLibraryMatchers<any, void> {}
}

// Augment supertest Test type
declare module 'supertest' {
	interface Test {
		get(url: string): Test;
		post(url: string): Test;
		put(url: string): Test;
		patch(url: string): Test;
		delete(url: string): Test;
		head(url: string): Test;
		options(url: string): Test;
		send(data: any): Test;
		set(field: string, value: string): Test;
		set(headers: Record<string, string>): Test;
		query(params: any): Test;
		field(name: string, value: string): Test;
		attach(field: string, file: string, filename?: string): Test;
		type(value: string): Test;
		accept(value: string): Test;
		timeout(ms: number): Test;
		expect(status: number): Test;
		expect(body: any): Test;
		expect(field: string, value: string | RegExp): Test;
		expect(callback: (res: any) => void): Test;
		end(callback?: (err: any, res: any) => void): Test;
		then(resolve: (res: any) => void, reject?: (err: any) => void): Promise<any>;
		catch(reject: (err: any) => void): Promise<any>;
		body: any;
		status: number;
	}
}

// Augment global fetch for mocking
declare global {
	interface Window {
		fetch: {
			(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
			mockResolvedValueOnce: (value: any) => any;
			mockImplementation: (fn: any) => any;
		};
	}

	// Node.js fs module augmentation for mocking
	namespace NodeJS {
		interface Module {
			existsSync: {
				(path: string): boolean;
				mockImplementation: (fn: (path: string) => boolean) => void;
			};
		}
	}
}

export {};
