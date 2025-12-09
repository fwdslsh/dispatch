/**
 * Tab Types Tests
 *
 * Tests for the canonical tab type constants and utilities.
 * @file tests/shared/tab-types.test.js
 */

import { describe, expect, it } from 'vitest';
import {
	TAB_TYPE,
	TAB_TYPES,
	isValidTabType,
	getTabTypeDisplayName,
	getTabTypeIcon
} from '../../src/lib/shared/tab-types.js';

describe('Tab Type Constants', () => {
	it('should define exactly 3 canonical tab types', () => {
		expect(TAB_TYPES).toHaveLength(3);
	});

	it('should have TERMINAL type', () => {
		expect(TAB_TYPE.TERMINAL).toBe('terminal');
	});

	it('should have AI type', () => {
		expect(TAB_TYPE.AI).toBe('ai');
	});

	it('should have FILE_EDITOR type', () => {
		expect(TAB_TYPE.FILE_EDITOR).toBe('file-editor');
	});

	it('should include all types in TAB_TYPES array', () => {
		expect(TAB_TYPES).toContain(TAB_TYPE.TERMINAL);
		expect(TAB_TYPES).toContain(TAB_TYPE.AI);
		expect(TAB_TYPES).toContain(TAB_TYPE.FILE_EDITOR);
	});
});

describe('isValidTabType', () => {
	it('should return true for valid tab types', () => {
		expect(isValidTabType('terminal')).toBe(true);
		expect(isValidTabType('ai')).toBe(true);
		expect(isValidTabType('file-editor')).toBe(true);
	});

	it('should return false for invalid types', () => {
		expect(isValidTabType('invalid')).toBe(false);
		expect(isValidTabType('')).toBe(false);
		expect(isValidTabType(null)).toBe(false);
		expect(isValidTabType(undefined)).toBe(false);
	});

	it('should return false for legacy type names', () => {
		expect(isValidTabType('pty')).toBe(false);
		expect(isValidTabType('claude')).toBe(false);
	});
});

describe('getTabTypeDisplayName', () => {
	it('should return correct display names', () => {
		expect(getTabTypeDisplayName(TAB_TYPE.TERMINAL)).toBe('Terminal');
		expect(getTabTypeDisplayName(TAB_TYPE.AI)).toBe('AI Agent');
		expect(getTabTypeDisplayName(TAB_TYPE.FILE_EDITOR)).toBe('File Editor');
	});

	it('should return the type itself for unknown types', () => {
		expect(getTabTypeDisplayName('unknown')).toBe('unknown');
	});
});

describe('getTabTypeIcon', () => {
	it('should return correct icon names', () => {
		expect(getTabTypeIcon(TAB_TYPE.TERMINAL)).toBe('terminal');
		expect(getTabTypeIcon(TAB_TYPE.AI)).toBe('robot');
		expect(getTabTypeIcon(TAB_TYPE.FILE_EDITOR)).toBe('file-edit');
	});

	it('should return default icon for unknown types', () => {
		expect(getTabTypeIcon('unknown')).toBe('file');
	});
});
