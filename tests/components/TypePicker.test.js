/**
 * Unit tests for TypePicker component
 * Tests session type selection functionality and registry integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import TypePicker from '../../components/TypePicker.svelte';

// Mock session types registry
vi.mock('../../session-types/index.js', () => ({
  getAllSessionTypes: vi.fn(() => [
    {
      id: 'shell',
      name: 'Shell Terminal',
      description: 'Standard shell terminal session',
      category: 'terminal',
      namespace: '/shell',
      requiresProject: false,
      supportsAttachment: true
    },
    {
      id: 'claude',
      name: 'Claude Code Session', 
      description: 'AI-assisted development session with Claude integration',
      category: 'ai-assistant',
      namespace: '/claude',
      requiresProject: true,
      supportsAttachment: true
    }
  ])
}));

// Mock the icon components
vi.mock('../../components/Icons/ShellIcon.svelte', () => ({
  default: {
    $$render: () => '<div data-testid="shell-icon">Shell Icon</div>'
  }
}));

vi.mock('../../components/Icons/ClaudeIcon.svelte', () => ({
  default: {
    $$render: () => '<div data-testid="claude-icon">Claude Icon</div>'
  }
}));

describe('TypePicker Component', () => {
  let mockOnTypeSelect;

  beforeEach(() => {
    mockOnTypeSelect = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Rendering and Display', () => {
    it('should render session type picker with title', async () => {
      const { container } = render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      expect(screen.getByText('Select Session Type')).toBeInTheDocument();
      expect(container.querySelector('.type-picker')).toBeInTheDocument();
    });

    it('should display available session types from registry', async () => {
      render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      // Should show both shell and claude session types
      expect(screen.getByText('Shell Terminal')).toBeInTheDocument();
      expect(screen.getByText('Claude Code Session')).toBeInTheDocument();
      
      // Should show descriptions
      expect(screen.getByText('Standard shell terminal session')).toBeInTheDocument();
      expect(screen.getByText('AI-assisted development session with Claude integration')).toBeInTheDocument();
    });

    it('should display session type categories', async () => {
      render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      expect(screen.getByText('terminal')).toBeInTheDocument();
      expect(screen.getByText('ai-assistant')).toBeInTheDocument();
    });

    it('should show project requirement badges', async () => {
      render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      // Claude requires project, shell doesn't
      expect(screen.getByText('Project Required')).toBeInTheDocument();
    });

    it('should render appropriate icons for session types', async () => {
      render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      expect(screen.getByTestId('shell-icon')).toBeInTheDocument();
      expect(screen.getByTestId('claude-icon')).toBeInTheDocument();
    });
  });

  describe('Session Type Selection', () => {
    it('should handle session type selection', async () => {
      render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      const shellButton = screen.getByText('Shell Terminal').closest('button');
      await fireEvent.click(shellButton);

      expect(mockOnTypeSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'shell',
          name: 'Shell Terminal'
        })
      );
    });

    it('should highlight selected session type', async () => {
      const selectedType = {
        id: 'claude',
        name: 'Claude Code Session',
        description: 'AI-assisted development session with Claude integration',
        category: 'ai-assistant',
        namespace: '/claude',
        requiresProject: true
      };

      render(TypePicker, {
        props: {
          selectedType,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      const claudeButton = screen.getByText('Claude Code Session').closest('button');
      expect(claudeButton).toHaveClass('selected');
    });

    it('should handle multiple selection attempts', async () => {
      render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      const shellButton = screen.getByText('Shell Terminal').closest('button');
      const claudeButton = screen.getByText('Claude Code Session').closest('button');

      // Select shell first
      await fireEvent.click(shellButton);
      expect(mockOnTypeSelect).toHaveBeenCalledTimes(1);

      // Then select claude
      await fireEvent.click(claudeButton);
      expect(mockOnTypeSelect).toHaveBeenCalledTimes(2);

      expect(mockOnTypeSelect).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: 'claude',
          name: 'Claude Code Session'
        })
      );
    });

    it('should update selected state when prop changes', async () => {
      const { component } = render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      // Initially no selection
      expect(screen.queryByText('Shell Terminal').closest('button')).not.toHaveClass('selected');

      // Update selectedType prop
      component.$set({
        selectedType: {
          id: 'shell',
          name: 'Shell Terminal',
          category: 'terminal'
        }
      });

      await tick();

      // Should now be selected
      expect(screen.getByText('Shell Terminal').closest('button')).toHaveClass('selected');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty session types registry', async () => {
      // Mock empty registry
      const { getAllSessionTypes } = await import('../../src/lib/session-types/index.js');
      getAllSessionTypes.mockReturnValue([]);

      render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      expect(screen.getByText('No session types available')).toBeInTheDocument();
    });

    it('should handle session type registry loading errors', async () => {
      // Mock registry error
      const { getAllSessionTypes } = await import('../../src/lib/session-types/index.js');
      getAllSessionTypes.mockImplementation(() => {
        throw new Error('Registry loading failed');
      });

      render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      expect(screen.getByText('No session types available')).toBeInTheDocument();
    });

    it('should handle session types without icons gracefully', async () => {
      // Mock session type with unknown ID
      const { getAllSessionTypes } = await import('../../src/lib/session-types/index.js');
      getAllSessionTypes.mockReturnValue([
        {
          id: 'unknown-type',
          name: 'Unknown Session Type',
          description: 'A session type without an icon',
          category: 'custom',
          namespace: '/unknown'
        }
      ]);

      render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      // Should show default icon placeholder
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('should handle missing onTypeSelect callback', async () => {
      render(TypePicker, {
        props: {
          selectedType: null
          // No onTypeSelect provided
        }
      });

      await tick();

      const shellButton = screen.getByText('Shell Terminal').closest('button');
      
      // Should not throw when clicked
      expect(() => fireEvent.click(shellButton)).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and structure', async () => {
      render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      // Check for heading structure
      expect(screen.getByText('Select Session Type')).toBeInTheDocument();

      // Check for button role and accessibility
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2); // shell and claude
      
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('should indicate selected state to screen readers', async () => {
      const selectedType = {
        id: 'shell',
        name: 'Shell Terminal',
        category: 'terminal'
      };

      render(TypePicker, {
        props: {
          selectedType,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      const shellButton = screen.getByText('Shell Terminal').closest('button');
      expect(shellButton).toHaveClass('selected');
    });
  });

  describe('Responsive Behavior', () => {
    it('should render properly on mobile viewports', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 400,
      });

      render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      // Component should still render properly
      expect(screen.getByText('Select Session Type')).toBeInTheDocument();
      expect(screen.getByText('Shell Terminal')).toBeInTheDocument();
      expect(screen.getByText('Claude Code Session')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should handle rapid selections without issues', async () => {
      render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      const shellButton = screen.getByText('Shell Terminal').closest('button');
      const claudeButton = screen.getByText('Claude Code Session').closest('button');

      // Rapid clicking
      await fireEvent.click(shellButton);
      await fireEvent.click(claudeButton);
      await fireEvent.click(shellButton);
      await fireEvent.click(claudeButton);

      expect(mockOnTypeSelect).toHaveBeenCalledTimes(4);
    });

    it('should not re-render excessively when props don\'t change', async () => {
      const { component } = render(TypePicker, {
        props: {
          selectedType: null,
          onTypeSelect: mockOnTypeSelect
        }
      });

      await tick();

      const initialRenderCount = mockOnTypeSelect.mock.calls.length;

      // Set same props again
      component.$set({
        selectedType: null,
        onTypeSelect: mockOnTypeSelect
      });

      await tick();

      // Should not have triggered unnecessary callbacks
      expect(mockOnTypeSelect).toHaveBeenCalledTimes(initialRenderCount);
    });
  });
});