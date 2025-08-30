// tests/lib/server/name-validation.test.js
import { test, expect } from '@playwright/test';
import { validateSessionName, sanitizeSessionName, generateFallbackName } from '../../../src/lib/server/name-validation.js';

test.describe('Session Name Validation', () => {
  test.describe('validateSessionName', () => {
    test('accepts valid names', () => {
      expect(validateSessionName('My Project')).toBe(true);
      expect(validateSessionName('react-frontend')).toBe(true);
      expect(validateSessionName('API_Server_2024')).toBe(true);
      expect(validateSessionName('Test Session 123')).toBe(true);
    });

    test('rejects empty names', () => {
      expect(validateSessionName('')).toBe(false);
      expect(validateSessionName('   ')).toBe(false);
    });

    test('rejects names that are too long', () => {
      const longName = 'a'.repeat(51);
      expect(validateSessionName(longName)).toBe(false);
    });

    test('rejects names with invalid characters', () => {
      expect(validateSessionName('My/Project')).toBe(false);
      expect(validateSessionName('Test\\Session')).toBe(false);
      expect(validateSessionName('Project*Name')).toBe(false);
      expect(validateSessionName('Session<script>alert("hack")</script>')).toBe(false);
    });

    test('accepts names at boundary lengths', () => {
      expect(validateSessionName('a')).toBe(true);
      expect(validateSessionName('a'.repeat(50))).toBe(true);
    });
  });

  test.describe('sanitizeSessionName', () => {
    test('removes invalid characters', () => {
      expect(sanitizeSessionName('My/Project')).toBe('My-Project');
      expect(sanitizeSessionName('Test\\Session')).toBe('Test-Session');
      expect(sanitizeSessionName('Project*Name')).toBe('Project-Name');
    });

    test('collapses multiple spaces', () => {
      expect(sanitizeSessionName('My   Project')).toBe('My-Project');
      expect(sanitizeSessionName('Test    Session')).toBe('Test-Session');
    });

    test('trims whitespace', () => {
      expect(sanitizeSessionName('  My Project  ')).toBe('My-Project');
    });

    test('converts to lowercase for filesystem safety', () => {
      expect(sanitizeSessionName('My Project')).toBe('my-project');
      expect(sanitizeSessionName('API Server')).toBe('api-server');
    });

    test('handles empty input gracefully', () => {
      expect(sanitizeSessionName('')).toBe('');
      expect(sanitizeSessionName('   ')).toBe('');
    });
  });

  test.describe('generateFallbackName', () => {
    test('generates name with session ID prefix', () => {
      const sessionId = '12345678-1234-1234-1234-123456789012';
      const fallbackName = generateFallbackName(sessionId);
      expect(fallbackName).toBe('Session 12345678');
    });

    test('handles short session IDs', () => {
      const shortId = '1234567';
      const fallbackName = generateFallbackName(shortId);
      expect(fallbackName).toBe('Session 1234567');
    });

    test('uses full ID if less than 8 characters', () => {
      const veryShortId = '123';
      const fallbackName = generateFallbackName(veryShortId);
      expect(fallbackName).toBe('Session 123');
    });
  });
});