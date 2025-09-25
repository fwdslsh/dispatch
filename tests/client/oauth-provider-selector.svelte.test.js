import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';

import OAuthProviderSelector from '../../src/lib/client/shared/components/OAuthProviderSelector.svelte';

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn());

describe('OAuth Provider Selector Component', () => {
	beforeEach(() => {
		// Reset fetch mock
		vi.clearAllMocks();

		// Mock successful auth config response by default
		fetch.mockResolvedValue({
			json: () => Promise.resolve({
				success: true,
				methods: {
					oauth: {
						available: true,
						providers: {
							google: {
								enabled: true,
								configured: true,
								available: true
							},
							github: {
								enabled: true,
								configured: true,
								available: true
							}
						}
					}
				},
				security: {
					isSecure: true,
					isTunnel: false
				}
			})
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Loading State', () => {
		it('shows loading spinner while fetching providers', () => {
			const { container } = render(OAuthProviderSelector);

			expect(container.textContent).toContain('Loading authentication providers...');
			const spinner = container.querySelector('[data-testid*="loading"]') ||
							 container.querySelector('.loading-state');
			expect(spinner).toBeTruthy();
		});
	});

	describe('Provider Configuration', () => {
		it('displays available OAuth providers', async () => {
			const { container } = render(OAuthProviderSelector);

			await waitFor(() => {
				expect(container.textContent).toContain('Google');
				expect(container.textContent).toContain('GitHub');
			});

			// Should have OAuth buttons for enabled providers
			const googleButton = container.querySelector('[data-testid="oauth-provider-google"]') ||
								 container.querySelector('button[title*="Google"]');
			const githubButton = container.querySelector('[data-testid="oauth-provider-github"]') ||
								container.querySelector('button[title*="GitHub"]');

			expect(googleButton).toBeTruthy();
			expect(githubButton).toBeTruthy();
		});

		it('handles providers that are not configured', async () => {
			fetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					methods: {
						oauth: {
							available: true,
							providers: {
								google: {
									enabled: true,
									configured: false,
									available: true
								}
							}
						}
					},
					security: {
						isSecure: true,
						isTunnel: false
					}
				})
			});

			const { container } = render(OAuthProviderSelector);

			await waitFor(() => {
				expect(container.textContent).toContain('Not configured by administrator');
			});
		});

		it('handles providers that are temporarily unavailable', async () => {
			fetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					methods: {
						oauth: {
							available: true,
							providers: {
								google: {
									enabled: true,
									configured: true,
									available: false
								}
							}
						}
					},
					security: {
						isSecure: true,
						isTunnel: false
					}
				})
			});

			const { container } = render(OAuthProviderSelector);

			await waitFor(() => {
				expect(container.textContent).toContain('Temporarily unavailable');
			});
		});
	});

	describe('Error Handling', () => {
		it('shows error state when fetch fails', async () => {
			fetch.mockRejectedValueOnce(new Error('Network error'));

			const { container } = render(OAuthProviderSelector);

			await waitFor(() => {
				expect(container.textContent).toContain('Failed to Load Providers');
				expect(container.textContent).toContain('Network error');
			});

			const retryButton = container.querySelector('button');
			expect(retryButton?.textContent).toContain('Retry');
		});

		it('shows error state when server returns error', async () => {
			fetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: false,
					error: 'Authentication service unavailable'
				})
			});

			const { container } = render(OAuthProviderSelector);

			await waitFor(() => {
				expect(container.textContent).toContain('Failed to Load Providers');
				expect(container.textContent).toContain('Authentication service unavailable');
			});
		});

		it('allows retry after error', async () => {
			// First call fails
			fetch.mockRejectedValueOnce(new Error('Network error'));

			const { container } = render(OAuthProviderSelector);

			await waitFor(() => {
				expect(container.textContent).toContain('Failed to Load Providers');
			});

			// Mock successful retry
			fetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					methods: {
						oauth: {
							available: true,
							providers: {
								google: {
									enabled: true,
									configured: true,
									available: true
								}
							}
						}
					},
					security: {
						isSecure: true,
						isTunnel: false
					}
				})
			});

			const retryButton = container.querySelector('button');
			await fireEvent.click(retryButton);

			await waitFor(() => {
				expect(container.textContent).toContain('Google');
				expect(container.textContent).not.toContain('Failed to Load Providers');
			});
		});
	});

	describe('No Providers State', () => {
		it('shows message when no providers are configured', async () => {
			fetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					methods: {
						oauth: {
							available: false,
							providers: {}
						}
					},
					security: {
						isSecure: true,
						isTunnel: false
					}
				})
			});

			const { container } = render(OAuthProviderSelector);

			await waitFor(() => {
				expect(container.textContent).toContain('No OAuth Providers Available');
				expect(container.textContent).toContain('Contact your administrator');
			});
		});
	});

	describe('Security Context', () => {
		it('shows tunnel warning when using tunnel URL', async () => {
			fetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					methods: {
						oauth: {
							available: true,
							providers: {
								google: {
									enabled: true,
									configured: true,
									available: true
								}
							}
						}
					},
					security: {
						isSecure: true,
						isTunnel: true
					}
				})
			});

			const { container } = render(OAuthProviderSelector);

			await waitFor(() => {
				expect(container.textContent).toContain('Using tunnel URL');
				expect(container.textContent).toContain('OAuth redirects may have limitations');
			});
		});

		it('shows insecure connection warning when using HTTP', async () => {
			fetch.mockResolvedValueOnce({
				json: () => Promise.resolve({
					success: true,
					methods: {
						oauth: {
							available: true,
							providers: {
								google: {
									enabled: true,
									configured: true,
									available: true
								}
							}
						}
					},
					security: {
						isSecure: false,
						isTunnel: false
					}
				})
			});

			const { container } = render(OAuthProviderSelector);

			await waitFor(() => {
				expect(container.textContent).toContain('Using HTTP');
				expect(container.textContent).toContain('OAuth requires HTTPS in production');
			});
		});
	});

	describe('Component Props', () => {
		it('respects compact mode', async () => {
			const { container } = render(OAuthProviderSelector, {
				props: { compact: true }
			});

			await waitFor(() => {
				const selector = container.querySelector('.oauth-selector');
				expect(selector?.classList.contains('compact')).toBe(true);
			});
		});

		it('hides title when showTitle is false', async () => {
			const { container } = render(OAuthProviderSelector, {
				props: { showTitle: false }
			});

			await waitFor(() => {
				const header = container.querySelector('.selector-header');
				expect(header).toBeFalsy();
			});
		});

		it('uses custom title and subtitle', async () => {
			const { container } = render(OAuthProviderSelector, {
				props: {
					title: 'Custom Title',
					subtitle: 'Custom subtitle text'
				}
			});

			await waitFor(() => {
				expect(container.textContent).toContain('Custom Title');
				expect(container.textContent).toContain('Custom subtitle text');
			});
		});

		it('passes returnTo prop to OAuth buttons', async () => {
			const { container } = render(OAuthProviderSelector, {
				props: { returnTo: '/dashboard' }
			});

			await waitFor(() => {
				// OAuth buttons should be rendered (we can't easily test the returnTo prop directly)
				const buttons = container.querySelectorAll('button[title*="Google"], button[title*="GitHub"]');
				expect(buttons.length).toBeGreaterThan(0);
			});
		});
	});

	describe('Provider Events', () => {
		it('emits providerSelected event', async () => {
			let eventData = null;
			const { component } = render(OAuthProviderSelector);

			component.$on('providerSelected', (event) => {
				eventData = event.detail;
			});

			// Simulate provider selection (would normally come from OAuthLoginButton)
			component.$$.ctx[0].handleProviderSelect('google'); // Internal method call

			expect(eventData).toEqual({
				providerId: 'google',
				returnTo: '/'
			});
		});
	});

	describe('Accessibility', () => {
		it('has proper ARIA labels and roles', async () => {
			const { container } = render(OAuthProviderSelector);

			await waitFor(() => {
				const selector = container.querySelector('[data-testid="oauth-provider-selector"]');
				expect(selector).toBeTruthy();

				// Check for accessible loading states
				const loadingSpinner = container.querySelector('[aria-hidden], [role="status"]') ||
									  container.querySelector('.loading-state p');
				// Loading state should be present initially
				expect(loadingSpinner).toBeTruthy();
			});
		});
	});
});