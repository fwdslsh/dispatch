/**
 * SessionManager component tests
 * Runs in browser environment via Vitest configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import SessionManager from '../../../src/lib/client/shared/components/SessionManager.svelte';

// Mock fetch for browser environment
Object.defineProperty(window, 'fetch', {
  value: vi.fn(),
  writable: true
});

// Mock console methods to avoid noise in tests
Object.defineProperty(window, 'console', {
  value: {
    ...console,
    error: vi.fn(),
    warn: vi.fn()
  },
  writable: true
});

describe('SessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    window.fetch.mockReset();
  });

  const mockSessions = [
    {
      id: 'session-1',
      deviceId: 'device-1',
      deviceName: 'Chrome Desktop',
      createdAt: '2024-01-01T10:00:00Z',
      expiresAt: '2024-12-31T23:59:59Z',
      lastActivity: '2024-01-15T14:30:00Z',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Chrome/120.0',
      authMethod: 'webauthn'
    },
    {
      id: 'session-2',
      deviceId: 'device-2',
      deviceName: 'Mobile Safari',
      createdAt: '2024-01-02T08:00:00Z',
      expiresAt: '2024-06-01T23:59:59Z',
      lastActivity: '2024-01-10T12:00:00Z',
      ipAddress: '10.0.0.50',
      userAgent: 'Mobile Safari/17.0',
      authMethod: 'oauth'
    },
    {
      id: 'session-3',
      deviceId: 'device-3',
      deviceName: 'Firefox Laptop',
      createdAt: '2023-12-01T16:00:00Z',
      expiresAt: '2024-01-01T00:00:00Z', // Expired
      lastActivity: '2023-12-15T10:00:00Z',
      ipAddress: '172.16.0.10',
      userAgent: 'Mozilla/5.0 Firefox/121.0',
      authMethod: 'local'
    }
  ];

  const mockCurrentSession = {
    id: 'session-1',
    deviceId: 'device-1',
    deviceName: 'Chrome Desktop',
    createdAt: '2024-01-01T10:00:00Z',
    expiresAt: '2024-12-31T23:59:59Z',
    lastActivity: '2024-01-15T14:30:00Z',
    authMethod: 'webauthn'
  };

  it('renders loading state initially', () => {
    render(SessionManager);
    expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
  });

  it('loads and displays sessions on mount', async () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions,
        currentSession: mockCurrentSession
      })
    });

    render(SessionManager);

    await waitFor(() => {
      expect(screen.getByText('Session Management')).toBeInTheDocument();
    });

    // Check session statistics
    expect(screen.getByText('Total Sessions: 3')).toBeInTheDocument();
    expect(screen.getByText('Active: 2')).toBeInTheDocument();
    expect(screen.getByText('Expired: 1')).toBeInTheDocument();
    expect(screen.getByText('Devices: 3')).toBeInTheDocument();

    // Check sessions are displayed
    expect(screen.getByText('Chrome Desktop')).toBeInTheDocument();
    expect(screen.getByText('Mobile Safari')).toBeInTheDocument();
    expect(screen.getByText('Firefox Laptop')).toBeInTheDocument();

    // Check current session indicator
    expect(screen.getByText('(Current Session)')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    window.fetch.mockRejectedValueOnce(new Error('Network error'));

    render(SessionManager);

    await waitFor(() => {
      expect(screen.getByText('Failed to load sessions. Please try again.')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('retries loading sessions when retry button clicked', async () => {
    // First call fails
    window.fetch.mockRejectedValueOnce(new Error('Network error'));
    // Second call succeeds
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions,
        currentSession: mockCurrentSession
      })
    });

    render(SessionManager);

    await waitFor(() => {
      expect(screen.getByText('Failed to load sessions. Please try again.')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    await fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Session Management')).toBeInTheDocument();
    });
  });

  it('refreshes sessions when refresh button clicked', async () => {
    // Initial load
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions,
        currentSession: mockCurrentSession
      })
    });

    render(SessionManager);

    await waitFor(() => {
      expect(screen.getByText('Session Management')).toBeInTheDocument();
    });

    // Mock second fetch for refresh
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions.slice(0, 2), // Fewer sessions
        currentSession: mockCurrentSession
      })
    });

    const refreshButton = screen.getByRole('button', { name: 'Refresh' });
    await fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('Total Sessions: 2')).toBeInTheDocument();
    });
  });

  it('opens session details modal when view details clicked', async () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions,
        currentSession: mockCurrentSession
      })
    });

    render(SessionManager);

    await waitFor(() => {
      expect(screen.getByText('Session Management')).toBeInTheDocument();
    });

    const viewDetailsButtons = screen.getAllByRole('button', { name: 'View Details' });
    await fireEvent.click(viewDetailsButtons[0]);

    // Check modal is open
    expect(screen.getByText('Session Details')).toBeInTheDocument();
    expect(screen.getByText('session-1')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
    expect(screen.getByText('Mozilla/5.0 Chrome/120.0')).toBeInTheDocument();
  });

  it('closes session details modal when close button clicked', async () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions,
        currentSession: mockCurrentSession
      })
    });

    render(SessionManager);

    await waitFor(() => {
      expect(screen.getByText('Session Management')).toBeInTheDocument();
    });

    // Open modal
    const viewDetailsButtons = screen.getAllByRole('button', { name: 'View Details' });
    await fireEvent.click(viewDetailsButtons[0]);

    expect(screen.getByText('Session Details')).toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByRole('button', { name: 'Close' });
    await fireEvent.click(closeButton);

    expect(screen.queryByText('Session Details')).not.toBeInTheDocument();
  });

  it('terminates individual session when logout clicked', async () => {
    // Initial load
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions,
        currentSession: mockCurrentSession
      })
    });

    // Mock logout response
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        message: 'Session terminated successfully'
      })
    });

    // Mock refresh after logout
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions.slice(0, 2), // Session removed
        currentSession: mockCurrentSession
      })
    });

    render(SessionManager);

    await waitFor(() => {
      expect(screen.getByText('Session Management')).toBeInTheDocument();
    });

    // Find logout button for non-current session
    const logoutButtons = screen.getAllByRole('button', { name: 'Logout' });
    await fireEvent.click(logoutButtons[0]); // Should be Mobile Safari session

    await waitFor(() => {
      expect(window.fetch).toHaveBeenCalledWith('/api/user/sessions/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'session-2' })
      });
    });

    // Should refresh sessions after logout
    await waitFor(() => {
      expect(screen.getByText('Total Sessions: 2')).toBeInTheDocument();
    });
  });

  it('terminates all other sessions when logout all clicked', async () => {
    // Initial load
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions,
        currentSession: mockCurrentSession
      })
    });

    // Mock logout all response
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        message: 'Terminated 2 sessions',
        terminatedCount: 2
      })
    });

    // Mock refresh after logout all
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: [mockSessions[0]], // Only current session remains
        currentSession: mockCurrentSession
      })
    });

    render(SessionManager);

    await waitFor(() => {
      expect(screen.getByText('Session Management')).toBeInTheDocument();
    });

    const logoutAllButton = screen.getByRole('button', { name: 'Logout All Other Sessions' });
    await fireEvent.click(logoutAllButton);

    await waitFor(() => {
      expect(window.fetch).toHaveBeenCalledWith('/api/user/sessions/logout-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    // Should refresh sessions after logout all
    await waitFor(() => {
      expect(screen.getByText('Total Sessions: 1')).toBeInTheDocument();
    });
  });

  it('handles logout error gracefully', async () => {
    // Initial load
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions,
        currentSession: mockCurrentSession
      })
    });

    // Mock logout error
    window.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        success: false,
        error: 'Session not found'
      })
    });

    render(SessionManager);

    await waitFor(() => {
      expect(screen.getByText('Session Management')).toBeInTheDocument();
    });

    const logoutButtons = screen.getAllByRole('button', { name: 'Logout' });
    await fireEvent.click(logoutButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Failed to terminate session: Session not found')).toBeInTheDocument();
    });
  });

  it('disables logout button for current session', async () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions,
        currentSession: mockCurrentSession
      })
    });

    render(SessionManager);

    await waitFor(() => {
      expect(screen.getByText('Session Management')).toBeInTheDocument();
    });

    // Find the current session row
    const currentSessionRow = screen.getByText('Chrome Desktop').closest('.session-item');
    const logoutButton = currentSessionRow.querySelector('button[disabled]');
    expect(logoutButton).toBeInTheDocument();
    expect(logoutButton).toHaveAttribute('title', 'Cannot logout current session');
  });

  it('shows expired session styling', async () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions,
        currentSession: mockCurrentSession
      })
    });

    render(SessionManager);

    await waitFor(() => {
      expect(screen.getByText('Session Management')).toBeInTheDocument();
    });

    // Find expired session
    const expiredSessionRow = screen.getByText('Firefox Laptop').closest('.session-item');
    expect(expiredSessionRow).toHaveClass('expired');
  });

  it('formats session dates correctly', async () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions,
        currentSession: mockCurrentSession
      })
    });

    render(SessionManager);

    await waitFor(() => {
      expect(screen.getByText('Session Management')).toBeInTheDocument();
    });

    // Check that dates are formatted (exact format may vary by locale)
    expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
  });

  it('displays authentication method badges correctly', async () => {
    window.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        sessions: mockSessions,
        currentSession: mockCurrentSession
      })
    });

    render(SessionManager);

    await waitFor(() => {
      expect(screen.getByText('Session Management')).toBeInTheDocument();
    });

    // Check auth method badges
    expect(screen.getByText('WebAuthn')).toBeInTheDocument();
    expect(screen.getByText('OAuth')).toBeInTheDocument();
    expect(screen.getByText('Access Code')).toBeInTheDocument();
  });
});