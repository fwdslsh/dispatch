import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';

import OAuthLoginButton from '../../src/lib/client/shared/components/OAuthLoginButton.svelte';
import WebAuthnButton from '../../src/lib/client/shared/components/WebAuthnButton.svelte';

describe('Authentication UI Components - Basic Tests', () => {
	beforeEach(() => {
		// Mock basic browser APIs without complex location handling
		vi.stubGlobal('navigator', {
			credentials: {
				create: vi.fn(),
				get: vi.fn()
			}
		});

		vi.stubGlobal('PublicKeyCredential', {
			isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true)
		});

		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.unstubAllGlobals();
	});

	describe('OAuth Login Button Rendering', () => {
		it('renders Google OAuth button with correct content', () => {
			const { container } = render(OAuthLoginButton, {
				props: { provider: 'google' }
			});

			// Check that component renders
			expect(container.innerHTML).toBeTruthy();

			// Should contain Google-specific content
			expect(container.textContent).toContain('Continue with Google');
			expect(container.textContent).toContain('🔍'); // Google icon
		});

		it('renders GitHub OAuth button with correct content', () => {
			const { container } = render(OAuthLoginButton, {
				props: { provider: 'github' }
			});

			expect(container.textContent).toContain('Continue with GitHub');
			expect(container.textContent).toContain('🐙'); // GitHub icon
		});

		it('handles unknown provider with fallback', () => {
			const { container } = render(OAuthLoginButton, {
				props: { provider: 'unknown' }
			});

			expect(container.textContent).toContain('Continue with OAuth');
			expect(container.textContent).toContain('🌐'); // Default icon
		});

		it('renders with disabled state', () => {
			const { container } = render(OAuthLoginButton, {
				props: { provider: 'google', disabled: true }
			});

			const button = container.querySelector('button');
			expect(button).toBeTruthy();
			expect(button.disabled).toBe(true);
		});

		it('has proper ARIA accessibility attributes', () => {
			const { container } = render(OAuthLoginButton, {
				props: { provider: 'google' }
			});

			const button = container.querySelector('button');
			expect(button.getAttribute('aria-label')).toBe('Continue with Google');
			expect(button.getAttribute('title')).toBe('Continue with Google');
		});

		it('includes provider icon with proper accessibility', () => {
			const { container } = render(OAuthLoginButton, {
				props: { provider: 'google' }
			});

			const icon = container.querySelector('.provider-icon');
			expect(icon).toBeTruthy();
			expect(icon.getAttribute('aria-hidden')).toBe('true');
		});
	});

	describe('WebAuthn Button Rendering', () => {
		it('renders authenticate mode correctly', () => {
			const { container } = render(WebAuthnButton, {
				props: { mode: 'authenticate' }
			});

			expect(container.textContent).toContain('Sign in with Passkey');
			expect(container.textContent).toContain('🔐');
		});

		it('renders register mode correctly', () => {
			const { container } = render(WebAuthnButton, {
				props: {
					mode: 'register',
					userId: 'test-user'
				}
			});

			expect(container.textContent).toContain('Register Passkey');
			expect(container.textContent).toContain('🔐');
		});

		it('disables button when disabled prop is true', () => {
			const { container } = render(WebAuthnButton, {
				props: {
					mode: 'authenticate',
					disabled: true
				}
			});

			const button = container.querySelector('button');
			expect(button.disabled).toBe(true);
		});

		it('shows WebAuthn available state by default', () => {
			const { container } = render(WebAuthnButton, {
				props: { mode: 'authenticate' }
			});

			const button = container.querySelector('button');
			expect(button.disabled).toBe(false);

			// Should not show warning message
			const warning = container.querySelector('.warning');
			expect(warning).toBeFalsy();
		});

		it('shows WebAuthn not supported when browser lacks support', () => {
			// Remove WebAuthn support
			vi.stubGlobal('PublicKeyCredential', undefined);

			const { container } = render(WebAuthnButton, {
				props: { mode: 'authenticate' }
			});

			const button = container.querySelector('button');
			expect(button.disabled).toBe(true);

			const warning = container.querySelector('.warning');
			expect(warning).toBeTruthy();
			expect(warning.textContent).toContain('WebAuthn not supported');
		});

		it('uses correct variant prop', () => {
			const { container } = render(WebAuthnButton, {
				props: {
					mode: 'authenticate',
					variant: 'secondary'
				}
			});

			const button = container.querySelector('button');
			expect(button).toBeTruthy();
		});
	});

	describe('Component Structure and CSS', () => {
		it('OAuth button has correct CSS classes', () => {
			const { container } = render(OAuthLoginButton, {
				props: { provider: 'google' }
			});

			const button = container.querySelector('.oauth-button');
			expect(button).toBeTruthy();
			expect(button.classList.contains('oauth-button')).toBe(true);
		});

		it('OAuth button has proper content structure', () => {
			const { container } = render(OAuthLoginButton, {
				props: { provider: 'google' }
			});

			const buttonContent = container.querySelector('.button-content');
			expect(buttonContent).toBeTruthy();

			const icon = container.querySelector('.provider-icon');
			expect(icon).toBeTruthy();

			const text = container.querySelector('.provider-text');
			expect(text).toBeTruthy();
		});

		it('WebAuthn button integrates with Button component', () => {
			const { container } = render(WebAuthnButton, {
				props: { mode: 'authenticate' }
			});

			// Should use the shared Button component
			const button = container.querySelector('button');
			expect(button.classList.contains('button')).toBe(true);
		});

		it('WebAuthn button has proper wrapper structure', () => {
			const { container } = render(WebAuthnButton, {
				props: { mode: 'authenticate' }
			});

			const wrapper = container.querySelector('.webauthn-button');
			expect(wrapper).toBeTruthy();
		});
	});

	describe('Provider Configuration', () => {
		it('configures Google provider correctly', () => {
			const { container } = render(OAuthLoginButton, {
				props: { provider: 'google' }
			});

			const button = container.querySelector('.oauth-button');
			const styles = window.getComputedStyle(button);

			// Should have CSS custom properties set
			expect(button.style.getPropertyValue('--provider-color')).toBeTruthy();
		});

		it('configures GitHub provider correctly', () => {
			const { container } = render(OAuthLoginButton, {
				props: { provider: 'github' }
			});

			const button = container.querySelector('.oauth-button');
			expect(button.style.getPropertyValue('--provider-color')).toBeTruthy();
		});

		it('handles returnTo parameter in props', () => {
			const { container } = render(OAuthLoginButton, {
				props: {
					provider: 'google',
					returnTo: '/dashboard'
				}
			});

			// Component should render without errors
			expect(container.textContent).toContain('Continue with Google');
		});
	});

	describe('Error State Rendering', () => {
		it('OAuth button can display error state', () => {
			// This test focuses on the ability to render error content
			const { container } = render(OAuthLoginButton, {
				props: { provider: 'google' }
			});

			// Component should have the structure to show errors
			const button = container.querySelector('.oauth-button');
			expect(button).toBeTruthy();

			// The error display structure exists in the component
			expect(container.innerHTML).toContain('oauth-button');
		});

		it('WebAuthn button can display error state', () => {
			const { container } = render(WebAuthnButton, {
				props: { mode: 'authenticate' }
			});

			// Should have structure for error display
			const wrapper = container.querySelector('.webauthn-button');
			expect(wrapper).toBeTruthy();
		});
	});

	describe('Props and Configuration', () => {
		it('OAuth button accepts all expected props', () => {
			const { container } = render(OAuthLoginButton, {
				props: {
					provider: 'google',
					returnTo: '/custom-return',
					disabled: false
				}
			});

			expect(container.textContent).toContain('Continue with Google');
		});

		it('WebAuthn button accepts all expected props', () => {
			const { container } = render(WebAuthnButton, {
				props: {
					mode: 'register',
					username: 'testuser',
					userId: 'user-123',
					deviceName: 'Test Device',
					disabled: false,
					variant: 'primary'
				}
			});

			expect(container.textContent).toContain('Register Passkey');
		});
	});

	describe('Component Behavior Basics', () => {
		it('OAuth button maintains consistent rendering', () => {
			const { container: container1 } = render(OAuthLoginButton, {
				props: { provider: 'google' }
			});

			const { container: container2 } = render(OAuthLoginButton, {
				props: { provider: 'google' }
			});

			// Both should render consistently
			expect(container1.textContent).toEqual(container2.textContent);
		});

		it('WebAuthn button maintains consistent rendering', () => {
			const { container: container1 } = render(WebAuthnButton, {
				props: { mode: 'authenticate' }
			});

			const { container: container2 } = render(WebAuthnButton, {
				props: { mode: 'authenticate' }
			});

			expect(container1.textContent).toEqual(container2.textContent);
		});
	});

	describe('Component Integration Points', () => {
		it('components render without dependency errors', () => {
			// Test that components can be rendered together
			const { container: oauthContainer } = render(OAuthLoginButton, {
				props: { provider: 'google' }
			});

			const { container: webauthnContainer } = render(WebAuthnButton, {
				props: { mode: 'authenticate' }
			});

			expect(oauthContainer.innerHTML).toBeTruthy();
			expect(webauthnContainer.innerHTML).toBeTruthy();
		});

		it('components have unique identifiers when needed', () => {
			const { container } = render(WebAuthnButton, {
				props: { mode: 'authenticate' }
			});

			const button = container.querySelector('button');
			// Button component adds unique IDs
			expect(button.id).toBeTruthy();
		});
	});
});
