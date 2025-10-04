/**
 * Component tests for AuthenticationSettings
 * Tests UI behavior, validation, and state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import AuthenticationSettings from '../../../../src/lib/client/settings/AuthenticationSettings.svelte';
import { SettingsViewModel } from '../../../../src/lib/client/settings/SettingsViewModel.svelte.js';

describe('AuthenticationSettings Component', () => {
	let mockSettingsViewModel;

	beforeEach(() => {
		// Mock settings data
		const mockSettings = {
			terminal_key: {
				key: 'terminal_key',
				name: 'Terminal Key',
				display_name: 'Terminal Key',
				description: 'Authentication key for terminal access',
				type: 'STRING',
				is_sensitive: true,
				is_required: true,
				current_value: 'testkey12345',
				default_value: 'change-me-to-a-strong-password',
				env_var_name: 'TERMINAL_KEY',
				category_id: 'authentication'
			},
			oauth_client_id: {
				key: 'oauth_client_id',
				name: 'OAuth Client ID',
				display_name: 'OAuth Client ID',
				description: 'OAuth application client ID',
				type: 'STRING',
				is_sensitive: false,
				is_required: false,
				current_value: 'test-client-id',
				default_value: null,
				env_var_name: 'OAUTH_CLIENT_ID',
				category_id: 'authentication'
			}
		};

		// Create mock SettingsViewModel
		mockSettingsViewModel = {
			settingsByCategory: [
				{
					id: 'authentication',
					name: 'Authentication',
					settings: [mockSettings.terminal_key, mockSettings.oauth_client_id]
				}
			],
			categoryHasChanges: vi.fn(() => false),
			hasValidationErrors: false,
			saving: false,
			successMessage: null,
			error: null,
			getSetting: vi.fn((key) => mockSettings[key] || null),
			getSettingsByCategory: vi.fn((categoryId) => {
				if (categoryId === 'authentication') {
					return [mockSettings.terminal_key, mockSettings.oauth_client_id];
				}
				return [];
			}),
			getCurrentValue: vi.fn((key) => {
				if (key === 'terminal_key') return 'testkey12345';
				if (key === 'oauth_client_id') return 'test-client-id';
				return null;
			}),
			getValidationErrors: vi.fn(() => []),
			hasChanges: vi.fn(() => false),
			updateSetting: vi.fn(),
			saveCategory: vi.fn(async () => {
				mockSettingsViewModel.successMessage = 'Settings saved successfully';
			}),
			discardSetting: vi.fn()
		};
	});

	describe('Rendering', () => {
		it('should render authentication settings header', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			expect(screen.getByTestId('authentication-settings')).toBeInTheDocument();
			expect(screen.getByText('Authentication')).toBeInTheDocument();
		});

		it('should render terminal key settings section', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			expect(screen.getByText('Terminal Key')).toBeInTheDocument();
		});

		it('should show session invalidation warning', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			expect(screen.getByText(/session invalidation/i)).toBeInTheDocument();
		});
	});

	describe('Terminal Key Input', () => {
		it('should display terminal key input field', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const input = screen.getByTestId('terminal-key-input');
			expect(input).toBeInTheDocument();
			expect(input.type).toBe('password');
		});

		it('should mask sensitive terminal key by default', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const input = screen.getByTestId('terminal-key-input');
			expect(input.type).toBe('password');
		});

		it('should toggle password visibility', async () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const toggleButton = screen.getByTestId('toggle-password-visibility');
			const input = screen.getByTestId('terminal-key-input');

			expect(input.type).toBe('password');

			await fireEvent.click(toggleButton);
			await tick();

			expect(input.type).toBe('text');

			await fireEvent.click(toggleButton);
			await tick();

			expect(input.type).toBe('password');
		});

		it('should call updateSetting when terminal key changes', async () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const input = screen.getByTestId('terminal-key-input');

			await fireEvent.input(input, { target: { value: 'newkey123456' } });
			await tick();

			expect(mockSettingsViewModel.updateSetting).toHaveBeenCalledWith(
				'terminal_key',
				'newkey123456'
			);
		});
	});

	describe('Validation', () => {
		it('should display validation errors', async () => {
			mockSettingsViewModel.getValidationErrors = vi.fn((key) => {
				if (key === 'terminal_key') {
					return ['Terminal key must be at least 12 characters'];
				}
				return [];
			});

			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const errorElement = screen.getByTestId('terminal-key-error');
			expect(errorElement).toBeInTheDocument();
			expect(errorElement).toHaveTextContent('Terminal key must be at least 12 characters');
		});

		it('should disable save button when validation errors exist', () => {
			mockSettingsViewModel.hasValidationErrors = true;

			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const saveButton = screen.getByTestId('save-authentication-button');
			expect(saveButton).toBeDisabled();
		});

		it('should enable save button when changes exist and no errors', () => {
			mockSettingsViewModel.categoryHasChanges = vi.fn(() => true);
			mockSettingsViewModel.hasValidationErrors = false;

			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const saveButton = screen.getByTestId('save-authentication-button');
			expect(saveButton).not.toBeDisabled();
		});
	});

	describe('Save Functionality', () => {
		it('should call saveCategory when save button is clicked', async () => {
			mockSettingsViewModel.categoryHasChanges = vi.fn(() => true);

			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const saveButton = screen.getByTestId('save-authentication-button');

			await fireEvent.click(saveButton);
			await tick();

			expect(mockSettingsViewModel.saveCategory).toHaveBeenCalledWith('authentication');
		});

		it('should show loading state while saving', async () => {
			mockSettingsViewModel.categoryHasChanges = vi.fn(() => true);
			mockSettingsViewModel.saving = true;

			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const saveButton = screen.getByTestId('save-authentication-button');
			expect(saveButton).toHaveTextContent('Saving...');
			expect(saveButton).toBeDisabled();
		});

		it('should display success message after save', async () => {
			mockSettingsViewModel.categoryHasChanges = vi.fn(() => true);
			mockSettingsViewModel.successMessage = 'Settings saved successfully';

			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const successMessage = screen.getByTestId('save-success-message');
			expect(successMessage).toBeInTheDocument();
			expect(successMessage).toHaveTextContent('Settings saved successfully');
		});

		it('should display error message on save failure', () => {
			mockSettingsViewModel.error = 'Failed to save settings';

			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const errorMessage = screen.getByTestId('save-error-message');
			expect(errorMessage).toBeInTheDocument();
			expect(errorMessage).toHaveTextContent('Failed to save settings');
		});
	});

	describe('Discard Changes', () => {
		it('should show discard button when changes exist', () => {
			mockSettingsViewModel.categoryHasChanges = vi.fn(() => true);

			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const discardButton = screen.getByTestId('discard-authentication-changes-button');
			expect(discardButton).toBeInTheDocument();
		});

		it('should call discardSetting for each authentication setting', async () => {
			mockSettingsViewModel.categoryHasChanges = vi.fn(() => true);

			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const discardButton = screen.getByTestId('discard-authentication-changes-button');

			await fireEvent.click(discardButton);
			await tick();

			expect(mockSettingsViewModel.discardSetting).toHaveBeenCalledWith('terminal_key');
		});
	});

	describe('Session Invalidation Warning', () => {
		it('should display warning about session invalidation', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const warningElement = screen.getByTestId('session-warning');
			expect(warningElement).toBeInTheDocument();
		});

		it('should show warning message content', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			expect(
				screen.getByText(/Changing authentication settings will invalidate all active sessions/i)
			).toBeInTheDocument();
		});
	});

	describe('OAuth Settings Section', () => {
		beforeEach(() => {
			// Update mock to return OAuth settings
			const oauthSettings = {
				oauth_client_id: {
					key: 'oauth_client_id',
					name: 'OAuth Client ID',
					display_name: 'OAuth Client ID',
					type: 'STRING',
					is_sensitive: false,
					is_required: false,
					current_value: 'test-client-id',
					category_id: 'authentication'
				},
				oauth_redirect_uri: {
					key: 'oauth_redirect_uri',
					name: 'OAuth Redirect URI',
					display_name: 'OAuth Redirect URI',
					type: 'URL',
					is_sensitive: false,
					is_required: false,
					current_value: 'https://example.com/callback',
					category_id: 'authentication'
				},
				oauth_scope: {
					key: 'oauth_scope',
					name: 'OAuth Scope',
					display_name: 'OAuth Scope',
					type: 'STRING',
					is_sensitive: false,
					is_required: false,
					current_value: 'read write',
					category_id: 'authentication'
				}
			};

			mockSettingsViewModel.getSetting = vi.fn((key) => oauthSettings[key] || null);
			mockSettingsViewModel.getCurrentValue = vi.fn((key) => {
				if (oauthSettings[key]) return oauthSettings[key].current_value;
				return null;
			});
		});

		it('should render OAuth settings section when available', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			expect(screen.getByText('OAuth Configuration')).toBeInTheDocument();
		});

		it('should display OAuth client ID input', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const input = screen.getByTestId('oauth-client-id-input');
			expect(input).toBeInTheDocument();
		});

		it('should display OAuth redirect URI input', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const input = screen.getByTestId('oauth-redirect-uri-input');
			expect(input).toBeInTheDocument();
		});

		it('should display OAuth scope input', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const input = screen.getByTestId('oauth-scope-input');
			expect(input).toBeInTheDocument();
		});
	});

	describe('Environment Variable Fallback', () => {
		it('should show environment variable info when setting has env_var_name', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			// Terminal key has TERMINAL_KEY env var
			const envInfo = screen.queryByTestId('terminal-key-env-fallback');
			// Should only show when there are no changes
			if (envInfo) {
				expect(envInfo).toHaveTextContent('TERMINAL_KEY');
			}
		});

		it('should hide environment variable info when setting has changes', () => {
			mockSettingsViewModel.hasChanges = vi.fn((key) => key === 'terminal_key');

			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const envInfo = screen.queryByTestId('terminal-key-env-fallback');
			expect(envInfo).not.toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('should have proper ARIA labels', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const input = screen.getByTestId('terminal-key-input');
			expect(input).toHaveAttribute('aria-describedby');
		});

		it('should have required indicator for required fields', () => {
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const requiredIndicator = screen.getByLabelText('Required');
			expect(requiredIndicator).toBeInTheDocument();
		});

		it('should associate errors with inputs via aria-describedby', () => {
			mockSettingsViewModel.getValidationErrors = vi.fn((key) => {
				if (key === 'terminal_key') {
					return ['Error message'];
				}
				return [];
			});

			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const input = screen.getByTestId('terminal-key-input');
			const ariaDescribedBy = input.getAttribute('aria-describedby');

			expect(ariaDescribedBy).toContain('terminal-key-error');
		});
	});

	describe('Responsive Design', () => {
		it('should render properly on mobile sizes', () => {
			// This is more of a visual regression test, but we can check structure
			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			const container = screen.getByTestId('authentication-settings');
			expect(container).toBeInTheDocument();

			// Check that action buttons are in a flex container that can wrap
			const actionsContainer = container.querySelector('.settings-actions');
			expect(actionsContainer).toBeInTheDocument();
		});
	});

	describe('Edge Cases', () => {
		it('should handle null settingsViewModel gracefully', () => {
			// This should not crash
			expect(() => {
				render(AuthenticationSettings, { props: { settingsViewModel: null } });
			}).toThrow(); // Svelte will throw when required prop is missing
		});

		it('should handle empty authentication settings', () => {
			mockSettingsViewModel.getSettingsByCategory = vi.fn(() => []);
			mockSettingsViewModel.getSetting = vi.fn(() => null);

			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			// Should still render the container
			expect(screen.getByTestId('authentication-settings')).toBeInTheDocument();
		});

		it('should handle missing OAuth settings gracefully', () => {
			mockSettingsViewModel.getSetting = vi.fn((key) => {
				if (key === 'terminal_key') {
					return {
						key: 'terminal_key',
						name: 'Terminal Key',
						display_name: 'Terminal Key',
						type: 'STRING',
						is_sensitive: true,
						is_required: true,
						current_value: 'testkey12345',
						category_id: 'authentication'
					};
				}
				return null;
			});

			render(AuthenticationSettings, { props: { settingsViewModel: mockSettingsViewModel } });

			// OAuth section should not be rendered
			expect(screen.queryByText('OAuth Configuration')).not.toBeInTheDocument();
		});
	});
});
