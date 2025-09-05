/**
 * Simple App Context - Pure State Management
 * 
 * Clean context focused only on reactive state without service creation.
 * Follows the principle of separating state from service management.
 */

import { getContext, setContext } from 'svelte';

const APP_CONTEXT_KEY = Symbol('simple-app-context');

/**
 * Create simple app context with pure state management
 */
export function createSimpleAppContext() {
  // Simple reactive state - no service creation
  const auth = $state({
    isAuthenticated: false,
    terminalKey: null
  });

  const connection = $state({
    isOnline: false,
    socket: null // This will be set by the app, not created by context
  });

  const theme = $state({
    current: 'dark'
  });

  const notifications = $state({
    items: []
  });

  // Simple computed states
  const canCreateSessions = $derived(() => auth.isAuthenticated && connection.isOnline);
  const hasNotifications = $derived(() => notifications.items.length > 0);

  // Simple state actions - no service calls
  const actions = {
    // Authentication actions (pure state updates)
    setAuthenticated(authenticated) {
      auth.isAuthenticated = authenticated;
    },

    setTerminalKey(key) {
      auth.terminalKey = key;
    },

    // Connection actions (pure state updates)
    setOnline(online) {
      connection.isOnline = online;
    },

    setSocket(socket) {
      connection.socket = socket;
    },

    // Theme actions
    setTheme(themeName) {
      theme.current = themeName;
    },

    toggleTheme() {
      theme.current = theme.current === 'dark' ? 'light' : 'dark';
    },

    // Notification actions (pure state management)
    addNotification(message, type = 'info') {
      const notification = {
        id: Date.now(),
        message,
        type,
        timestamp: new Date().toISOString()
      };
      
      notifications.items.push(notification);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        this.removeNotification(notification.id);
      }, 5000);
    },

    removeNotification(id) {
      const index = notifications.items.findIndex(n => n.id === id);
      if (index >= 0) {
        notifications.items.splice(index, 1);
      }
    },

    clearAllNotifications() {
      notifications.items = [];
    }
  };

  // Return pure state and actions - no services
  const context = {
    // State
    auth,
    connection,
    theme,
    notifications,

    // Computed
    canCreateSessions,
    hasNotifications,

    // Actions
    ...actions
  };

  // Set context
  setContext(APP_CONTEXT_KEY, context);
  
  return context;
}

/**
 * Get the app context
 */
export function getAppContext() {
  const context = getContext(APP_CONTEXT_KEY);
  if (!context) {
    throw new Error('App context not found. Make sure createSimpleAppContext() is called in a parent component.');
  }
  return context;
}

/**
 * Simple utility to check if user is authenticated
 */
export function useAuth() {
  const context = getAppContext();
  return {
    isAuthenticated: context.auth.isAuthenticated,
    setAuthenticated: context.setAuthenticated
  };
}

/**
 * Simple utility to manage connection state
 */
export function useConnection() {
  const context = getAppContext();
  return {
    isOnline: context.connection.isOnline,
    setOnline: context.setOnline,
    socket: context.connection.socket,
    setSocket: context.setSocket
  };
}

/**
 * Simple utility for notifications
 */
export function useNotifications() {
  const context = getAppContext();
  return {
    notifications: context.notifications.items,
    addNotification: context.addNotification,
    removeNotification: context.removeNotification,
    clearAll: context.clearAllNotifications,
    hasNotifications: context.hasNotifications
  };
}