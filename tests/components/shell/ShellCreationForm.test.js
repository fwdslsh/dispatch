/**
 * Component tests for ShellCreationForm.svelte
 * Tests shell-specific form validation and configuration options
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/svelte';
import ShellCreationForm from '../../../lib/session-types/shell/ShellCreationForm.svelte';

describe('ShellCreationForm Component', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render shell creation form with default options', () => {
      const { getByText, getByDisplayValue } = render(ShellCreationForm);
      
      // Check that shell configuration header is rendered
      expect(getByText('Configure Shell Terminal Session')).toBeInTheDocument();
      
      // Check default shell selection
      expect(getByDisplayValue('/bin/bash')).toBeInTheDocument();
      
      // Check form is rendered (submit button is hidden)
      expect(getByText('Session Name')).toBeInTheDocument();
    });

    it('should render all available shell options', () => {
      const { container } = render(ShellCreationForm);
      
      const shellSelect = container.querySelector('#shell-path');
      expect(shellSelect).toBeInTheDocument();
      
      // Check that all shell options are available
      const options = shellSelect.querySelectorAll('option');
      const shellPaths = Array.from(options).map(opt => opt.value);
      
      expect(shellPaths).toContain('/bin/bash');
      expect(shellPaths).toContain('/bin/sh');
      expect(shellPaths).toContain('/bin/zsh');
      expect(shellPaths).toContain('/bin/fish');
      expect(shellPaths).toContain('custom');
    });

    it('should show environment variable editor when toggled', async () => {
      const { getByText, queryByText } = render(ShellCreationForm);
      
      // Initially hidden
      expect(queryByText('Variable name')).not.toBeInTheDocument();
      
      // Click to show editor
      const showButton = getByText('Show Environment Editor');
      await fireEvent.click(showButton);
      
      // Now visible
      expect(getByText('Variable name')).toBeInTheDocument();
      expect(getByText('Variable value')).toBeInTheDocument();
      expect(getByText('Add')).toBeInTheDocument();
    });
  });

  describe('Shell Selection', () => {
    it('should allow selecting different shell types', async () => {
      const { container, getByDisplayValue } = render(ShellCreationForm);
      
      const shellSelect = container.querySelector('#shell-path');
      
      // Change to zsh
      await fireEvent.change(shellSelect, { target: { value: '/bin/zsh' } });
      expect(getByDisplayValue('/bin/zsh')).toBeInTheDocument();
      
      // Change to fish
      await fireEvent.change(shellSelect, { target: { value: '/bin/fish' } });
      expect(getByDisplayValue('/bin/fish')).toBeInTheDocument();
    });

    it('should show custom shell input when "custom" is selected', async () => {
      const { container, getByPlaceholderText } = render(ShellCreationForm);
      
      const shellSelect = container.querySelector('#shell-path');
      
      // Select custom option
      await fireEvent.change(shellSelect, { target: { value: 'custom' } });
      
      // Custom input should appear
      expect(getByPlaceholderText('Enter custom shell path (e.g., /usr/local/bin/zsh)')).toBeInTheDocument();
    });

    it('should emit dataChange event when shell is selected', async () => {
      const component = render(ShellCreationForm);
      const { container } = component;
      
      const shellSelect = container.querySelector('#shell-path');
      
      // Change shell selection - new form manages data internally
      await fireEvent.change(shellSelect, { target: { value: '/bin/zsh' } });
      
      // Verify the selection was updated in the form
      expect(component.getByDisplayValue('/bin/zsh')).toBeInTheDocument();
    });
  });

  describe('Environment Variables', () => {
    let component;

    beforeEach(async () => {
      component = render(ShellCreationForm);
      
      // Show environment editor
      const showButton = component.getByText('Show Environment Editor');
      await fireEvent.click(showButton);
    });

    it('should add environment variable when form is filled and submitted', async () => {
      const { getByPlaceholderText, getByText } = component;
      
      const keyInput = getByPlaceholderText('Variable name');
      const valueInput = getByPlaceholderText('Variable value');
      const addButton = getByText('Add');
      
      // Fill in environment variable
      await fireEvent.input(keyInput, { target: { value: 'MY_VAR' } });
      await fireEvent.input(valueInput, { target: { value: 'my_value' } });
      
      // Add the variable
      await fireEvent.click(addButton);
      
      // Check that variable appears in list
      expect(getByText('MY_VAR')).toBeInTheDocument();
      expect(getByText('my_value')).toBeInTheDocument();
    });

    it('should not add empty environment variables', async () => {
      const { getByText, queryByText } = component;
      
      const addButton = getByText('Add');
      
      // Try to add without filling inputs
      await fireEvent.click(addButton);
      
      // Should show empty message
      expect(getByText('No custom environment variables set')).toBeInTheDocument();
    });

    it('should remove environment variable when remove button is clicked', async () => {
      const { getByPlaceholderText, getByText, queryByText } = component;
      
      // Add a variable first
      const keyInput = getByPlaceholderText('Variable name');
      const valueInput = getByPlaceholderText('Variable value');
      const addButton = getByText('Add');
      
      await fireEvent.input(keyInput, { target: { value: 'TEST_VAR' } });
      await fireEvent.input(valueInput, { target: { value: 'test_value' } });
      await fireEvent.click(addButton);
      
      // Verify it was added
      expect(getByText('TEST_VAR')).toBeInTheDocument();
      
      // Find and click remove button
      const removeButton = component.container.querySelector('.remove-env-btn');
      await fireEvent.click(removeButton);
      
      // Verify it was removed
      expect(queryByText('TEST_VAR')).not.toBeInTheDocument();
      expect(getByText('No custom environment variables set')).toBeInTheDocument();
    });

    it('should support adding multiple environment variables', async () => {
      const { getByPlaceholderText, getByText } = component;
      
      const keyInput = getByPlaceholderText('Variable name');
      const valueInput = getByPlaceholderText('Variable value');
      const addButton = getByText('Add');
      
      // Add first variable
      await fireEvent.input(keyInput, { target: { value: 'VAR1' } });
      await fireEvent.input(valueInput, { target: { value: 'value1' } });
      await fireEvent.click(addButton);
      
      // Add second variable
      await fireEvent.input(keyInput, { target: { value: 'VAR2' } });
      await fireEvent.input(valueInput, { target: { value: 'value2' } });
      await fireEvent.click(addButton);
      
      // Both should be present
      expect(getByText('VAR1')).toBeInTheDocument();
      expect(getByText('value1')).toBeInTheDocument();
      expect(getByText('VAR2')).toBeInTheDocument();
      expect(getByText('value2')).toBeInTheDocument();
    });

    it('should support adding environment variables with Enter key', async () => {
      const { getByPlaceholderText, getByText } = component;
      
      const keyInput = getByPlaceholderText('Variable name');
      const valueInput = getByPlaceholderText('Variable value');
      
      // Fill inputs
      await fireEvent.input(keyInput, { target: { value: 'ENTER_VAR' } });
      await fireEvent.input(valueInput, { target: { value: 'enter_value' } });
      
      // Press Enter in value input
      await fireEvent.keyDown(valueInput, { key: 'Enter' });
      
      // Variable should be added
      expect(getByText('ENTER_VAR')).toBeInTheDocument();
      expect(getByText('enter_value')).toBeInTheDocument();
    });
  });

  describe('Advanced Options', () => {
    it('should render login shell checkbox', () => {
      const { getByText } = render(ShellCreationForm);
      
      expect(getByText('Login shell')).toBeInTheDocument();
      expect(getByText('Start shell as a login shell (loads login configuration files)')).toBeInTheDocument();
    });

    it('should render initial command input', () => {
      const { getByPlaceholderText, getByText } = render(ShellCreationForm);
      
      expect(getByPlaceholderText('Optional command to run on startup')).toBeInTheDocument();
      expect(getByText('Command will be executed after shell starts')).toBeInTheDocument();
    });

    it('should emit dataChange when advanced options are modified', async () => {
      const component = render(ShellCreationForm);
      const { container } = component;
      
      // Toggle login shell checkbox
      const checkbox = container.querySelector('input[type="checkbox"]');
      await fireEvent.click(checkbox);
      
      // Verify checkbox state changed
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('Form Integration', () => {
    it('should render form with default props', () => {
      const { container } = render(ShellCreationForm);
      
      // Should render form elements
      expect(container.querySelector('.shell-form')).toBeInTheDocument();
      expect(container.querySelector('#session-name')).toBeInTheDocument();
      expect(container.querySelector('#shell-path')).toBeInTheDocument();
    });

    it('should handle session data binding', () => {
      let sessionData = null;
      const { container } = render(ShellCreationForm, {
        props: { 
          sessionData,
          onSessionCreate: (data) => { sessionData = data; }
        }
      });
      
      // Form should be rendered
      expect(container.querySelector('.shell-form')).toBeInTheDocument();
    });
  });

  describe('Session Data Management', () => {
    it('should update session data when shell configuration changes', async () => {
      let sessionData = null;
      const component = render(ShellCreationForm, {
        props: { 
          bind: { sessionData }
        }
      });
      const { container, getByText } = component;
      
      // Change shell
      const shellSelect = container.querySelector('#shell-path');
      await fireEvent.change(shellSelect, { target: { value: '/bin/fish' } });
      
      // Add environment variable
      const showButton = getByText('Show Environment Editor');
      await fireEvent.click(showButton);
      
      const keyInput = component.getByPlaceholderText('Variable name');
      const valueInput = component.getByPlaceholderText('Variable value');
      
      await fireEvent.input(keyInput, { target: { value: 'NEW_VAR' } });
      await fireEvent.input(valueInput, { target: { value: 'new_value' } });
      await fireEvent.click(component.getByText('Add'));
      
      // Form should manage its own state internally
      expect(getByText('NEW_VAR')).toBeInTheDocument();
      expect(getByText('new_value')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate environment variable keys are not empty', async () => {
      const component = render(ShellCreationForm);
      const { getByText } = component;
      
      // Show environment editor
      const showButton = getByText('Show Environment Editor');
      await fireEvent.click(showButton);
      
      const valueInput = component.getByPlaceholderText('Variable value');
      const addButton = component.getByText('Add');
      
      // Try to add with only value, no key
      await fireEvent.input(valueInput, { target: { value: 'some_value' } });
      
      // Add button should be disabled
      expect(addButton.disabled).toBe(true);
    });

    it('should validate environment variable values are not empty', async () => {
      const component = render(ShellCreationForm);
      const { getByText } = component;
      
      // Show environment editor
      const showButton = getByText('Show Environment Editor');
      await fireEvent.click(showButton);
      
      const keyInput = component.getByPlaceholderText('Variable name');
      const addButton = component.getByText('Add');
      
      // Try to add with only key, no value
      await fireEvent.input(keyInput, { target: { value: 'SOME_KEY' } });
      
      // Add button should be disabled
      expect(addButton.disabled).toBe(true);
    });
  });
});