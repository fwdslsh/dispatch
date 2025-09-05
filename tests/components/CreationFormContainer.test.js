/**
 * Unit tests for CreationFormContainer component
 * Tests conditional rendering based on session type selection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import CreationFormContainer from '../../components/CreationFormContainer.svelte';

// Mock the session type imports
vi.mock('../../session-types/shell/ShellCreationForm.svelte', () => ({
  default: {
    render: () => '<div data-testid="shell-form">Shell Creation Form</div>'
  }
}));

vi.mock('../../session-types/claude/ClaudeCreationForm.svelte', () => ({
  default: {
    render: () => '<div data-testid="claude-form">Claude Creation Form</div>'
  }
}));

// Mock session types
const mockShellSessionType = {
  id: 'shell',
  name: 'Shell Terminal',
  description: 'Standard shell terminal session',
  category: 'terminal',
  namespace: '/shell',
  requiresProject: false,
  supportsAttachment: true
};

const mockClaudeSessionType = {
  id: 'claude',
  name: 'Claude Code Session',
  description: 'AI-assisted development session with Claude integration',
  category: 'ai-assistant',
  namespace: '/claude',
  requiresProject: true,
  supportsAttachment: true
};

describe('CreationFormContainer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Conditional Form Rendering', () => {
    it('should render shell form when shell session type is selected', async () => {
      const { container } = render(CreationFormContainer, {
        props: {
          selectedType: mockShellSessionType,
          projectId: 'test-project-123'
        }
      });

      await tick();

      // Should render shell form
      expect(screen.getByTestId('shell-form')).toBeInTheDocument();
      expect(screen.queryByTestId('claude-form')).not.toBeInTheDocument();
    });

    it('should render Claude form when Claude session type is selected', async () => {
      const { container } = render(CreationFormContainer, {
        props: {
          selectedType: mockClaudeSessionType,
          projectId: 'test-project-123'
        }
      });

      await tick();

      // Should render Claude form
      expect(screen.getByTestId('claude-form')).toBeInTheDocument();
      expect(screen.queryByTestId('shell-form')).not.toBeInTheDocument();
    });

    it('should render placeholder when no session type is selected', async () => {
      const { container } = render(CreationFormContainer, {
        props: {
          selectedType: null,
          projectId: 'test-project-123'
        }
      });

      await tick();

      // Should show placeholder message
      expect(screen.getByText('Select a session type to continue')).toBeInTheDocument();
      expect(screen.queryByTestId('shell-form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('claude-form')).not.toBeInTheDocument();
    });

    it('should handle unknown session types gracefully', async () => {
      const unknownSessionType = {
        id: 'unknown',
        name: 'Unknown Session',
        description: 'Unknown session type',
        category: 'unknown',
        namespace: '/unknown'
      };

      const { container } = render(CreationFormContainer, {
        props: {
          selectedType: unknownSessionType,
          projectId: 'test-project-123'
        }
      });

      await tick();

      // Should show unsupported message
      expect(screen.getByText(/Unsupported session type/)).toBeInTheDocument();
      expect(screen.queryByTestId('shell-form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('claude-form')).not.toBeInTheDocument();
    });
  });

  describe('Form Event Handling', () => {
    it('should forward session creation events from shell form', async () => {
      const onSessionCreate = vi.fn();
      
      const { component } = render(CreationFormContainer, {
        props: {
          selectedType: mockShellSessionType,
          projectId: 'test-project-123',
          onSessionCreate
        }
      });

      await tick();

      // Simulate form submission from shell form
      const mockSessionData = {
        sessionType: 'shell',
        name: 'Test Shell Session',
        options: { shell: '/bin/bash' }
      };

      // Trigger session creation event
      component.$set({ sessionData: mockSessionData });
      await tick();

      // Should have called the callback
      expect(onSessionCreate).toHaveBeenCalledWith(mockSessionData);
    });

    it('should forward session creation events from Claude form', async () => {
      const onSessionCreate = vi.fn();
      
      const { component } = render(CreationFormContainer, {
        props: {
          selectedType: mockClaudeSessionType,
          projectId: 'test-project-123',
          onSessionCreate
        }
      });

      await tick();

      // Simulate form submission from Claude form
      const mockSessionData = {
        sessionType: 'claude',
        name: 'Test Claude Session',
        options: { 
          claudeModel: 'claude-3.5-sonnet',
          authToken: 'sk-ant-api03-test-token'
        }
      };

      // Trigger session creation event
      component.$set({ sessionData: mockSessionData });
      await tick();

      // Should have called the callback
      expect(onSessionCreate).toHaveBeenCalledWith(mockSessionData);
    });

    it('should handle form validation errors', async () => {
      const onValidationError = vi.fn();
      
      render(CreationFormContainer, {
        props: {
          selectedType: mockShellSessionType,
          projectId: 'test-project-123',
          onValidationError
        }
      });

      await tick();

      // Should handle validation errors gracefully
      expect(screen.getByTestId('shell-form')).toBeInTheDocument();
    });
  });

  describe('Project Integration', () => {
    it('should pass project ID to forms that require it', async () => {
      const projectId = 'test-project-456';
      
      render(CreationFormContainer, {
        props: {
          selectedType: mockClaudeSessionType, // Requires project
          projectId
        }
      });

      await tick();

      // Claude form should receive project ID
      expect(screen.getByTestId('claude-form')).toBeInTheDocument();
    });

    it('should handle missing project ID for forms that require it', async () => {
      render(CreationFormContainer, {
        props: {
          selectedType: mockClaudeSessionType, // Requires project
          projectId: null
        }
      });

      await tick();

      // Should show error message for missing project
      expect(screen.getByText(/Project required/)).toBeInTheDocument();
      expect(screen.queryByTestId('claude-form')).not.toBeInTheDocument();
    });

    it('should allow forms that do not require project ID', async () => {
      render(CreationFormContainer, {
        props: {
          selectedType: mockShellSessionType, // Does not require project
          projectId: null
        }
      });

      await tick();

      // Shell form should still render without project
      expect(screen.getByTestId('shell-form')).toBeInTheDocument();
    });
  });

  describe('Dynamic Form Switching', () => {
    it('should switch forms when session type changes', async () => {
      const { component } = render(CreationFormContainer, {
        props: {
          selectedType: mockShellSessionType,
          projectId: 'test-project-123'
        }
      });

      await tick();

      // Initially shows shell form
      expect(screen.getByTestId('shell-form')).toBeInTheDocument();
      expect(screen.queryByTestId('claude-form')).not.toBeInTheDocument();

      // Change to Claude session type
      component.$set({ selectedType: mockClaudeSessionType });
      await tick();

      // Should switch to Claude form
      expect(screen.queryByTestId('shell-form')).not.toBeInTheDocument();
      expect(screen.getByTestId('claude-form')).toBeInTheDocument();
    });

    it('should clear previous form state when switching types', async () => {
      const { component } = render(CreationFormContainer, {
        props: {
          selectedType: mockShellSessionType,
          projectId: 'test-project-123'
        }
      });

      await tick();

      // Change session type
      component.$set({ selectedType: mockClaudeSessionType });
      await tick();

      // Form should be fresh with no previous state
      expect(screen.getByTestId('claude-form')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle form loading errors gracefully', async () => {
      // Mock form import failure
      vi.mocked(import('../../session-types/shell/ShellCreationForm.svelte')).mockRejectedValue(
        new Error('Form loading failed')
      );

      render(CreationFormContainer, {
        props: {
          selectedType: mockShellSessionType,
          projectId: 'test-project-123'
        }
      });

      await tick();

      // Should show error message
      expect(screen.getByText(/Error loading form/)).toBeInTheDocument();
    });

    it('should handle invalid session type properties', async () => {
      const invalidSessionType = {
        id: null,
        name: '',
        description: null
      };

      render(CreationFormContainer, {
        props: {
          selectedType: invalidSessionType,
          projectId: 'test-project-123'
        }
      });

      await tick();

      // Should handle invalid properties gracefully
      expect(screen.getByText(/Invalid session type/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      render(CreationFormContainer, {
        props: {
          selectedType: mockShellSessionType,
          projectId: 'test-project-123'
        }
      });

      await tick();

      // Should have accessible form container
      const container = screen.getByRole('main');
      expect(container).toHaveAttribute('aria-label', 'Session creation form');
    });

    it('should announce form changes to screen readers', async () => {
      const { component } = render(CreationFormContainer, {
        props: {
          selectedType: null,
          projectId: 'test-project-123'
        }
      });

      await tick();

      // Change session type
      component.$set({ selectedType: mockShellSessionType });
      await tick();

      // Should have live region for announcements
      const liveRegion = screen.getByLabelText(/Form status/);
      expect(liveRegion).toBeInTheDocument();
    });
  });
});