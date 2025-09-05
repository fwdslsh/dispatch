/**
 * AppContext - Global State Management
 * Centralized state management for authentication, theme, connection status, and notifications
 * Using Svelte 5 runes for reactive state management
 */

import { getContext, setContext } from 'svelte';
import { SocketService } from '../services/index.js';

const APP_CONTEXT_KEY = Symbol('app-context');

/**
 * Create the application context with global state
 * @param {Object} options - Context configuration options
 * @returns {Object} AppContext instance
 */
export function createAppContext(options = {}) {
	// Configuration with defaults
	const config = {
		socketNamespace: '/',
		autoConnect: true,
		maxReconnectAttempts: 5,
		theme: 'dark',
		enableNotifications: true,
		...options
	};

	// Authentication state
	const auth = $state({
		isAuthenticated: false,
		user: null,
		token: null,
		lastAuthAttempt: null
	});

	// Theme state
	const theme = $state({
		current: config.theme,
		available: ['dark', 'light'],
		systemPreference: 'dark'
	});

	// Connection status
	const connection = $state({
		status: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
		lastConnected: null,
		attempts: 0,
		error: null,
		latency: null
	});

	// Notifications system
	const notifications = $state({
		items: [],
		maxItems: 5,
		defaultDuration: 5000
	});

	// Loading states
	const loading = $state({
		global: false,
		auth: false,
		connect: false
	});

	// Error states
	const errors = $state({
		global: null,
		auth: null,
		connection: null
	});

	// Initialize socket service
	const socketService = new SocketService(config.socketNamespace, {
		autoConnect: config.autoConnect,
		maxReconnectAttempts: config.maxReconnectAttempts
	});

	// Computed states using $derived
	const isOnline = $derived(() => connection.status === 'connected');
	const canPerformActions = $derived(() => auth.isAuthenticated && isOnline);
	const hasErrors = $derived(() => !!(errors.global || errors.auth || errors.connection));
	const isLoading = $derived(() => loading.global || loading.auth || loading.connect);
	
	// Theme computed properties
	const isDarkTheme = $derived(() => theme.current === 'dark');
	const themeClass = $derived(() => `theme-${theme.current}`);

	// Notification computed properties
	const hasNotifications = $derived(() => notifications.items.length > 0);
	const unreadNotifications = $derived(() => notifications.items.filter(n => !n.read).length);

	// Actions for authentication
	const authActions = {
		/**
		 * Authenticate with the given key
		 * @param {string} key - Authentication key
		 */
		async login(key) {
			if (!key) {
				throw new Error('Authentication key is required');
			}

			loading.auth = true;
			errors.auth = null;
			auth.lastAuthAttempt = new Date();

			try {
				const response = await socketService.auth(key);
				
				if (response.success || response.ok) {
					auth.isAuthenticated = true;
					auth.token = key;
					errors.auth = null;
					
					addNotification({
						type: 'success',
						title: 'Authentication Successful',
						message: 'You are now connected to the terminal',
						duration: 3000
					});
				} else {
					auth.isAuthenticated = false;
					auth.token = null;
					errors.auth = 'Authentication failed';
					
					addNotification({
						type: 'error',
						title: 'Authentication Failed',
						message: 'Invalid authentication key',
						duration: 5000
					});
				}

				return response;
			} catch (error) {
				auth.isAuthenticated = false;
				auth.token = null;
				errors.auth = error.message;
				
				addNotification({
					type: 'error',
					title: 'Authentication Error',
					message: error.message,
					duration: 5000
				});
				
				throw error;
			} finally {
				loading.auth = false;
			}
		},

		/**
		 * Logout and clear authentication
		 */
		async logout() {
			auth.isAuthenticated = false;
			auth.user = null;
			auth.token = null;
			errors.auth = null;

			addNotification({
				type: 'info',
				title: 'Logged Out',
				message: 'You have been disconnected',
				duration: 3000
			});
		},

		/**
		 * Check if authenticated and refresh if needed
		 */
		async checkAuth() {
			// Implementation would depend on your auth strategy
			return auth.isAuthenticated;
		}
	};

	// Actions for theme management
	const themeActions = {
		/**
		 * Toggle between light and dark themes
		 */
		toggle() {
			theme.current = theme.current === 'dark' ? 'light' : 'dark';
			applyTheme();
		},

		/**
		 * Set specific theme
		 * @param {string} themeName - Theme name
		 */
		set(themeName) {
			if (theme.available.includes(themeName)) {
				theme.current = themeName;
				applyTheme();
			}
		},

		/**
		 * Use system preference
		 */
		useSystem() {
			const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			theme.current = prefersDark ? 'dark' : 'light';
			applyTheme();
		}
	};

	// Actions for connection management
	const connectionActions = {
		/**
		 * Connect to socket server
		 */
		async connect() {
			loading.connect = true;
			connection.status = 'connecting';
			errors.connection = null;

			try {
				await socketService.connect();
				connection.status = 'connected';
				connection.lastConnected = new Date();
				connection.attempts = 0;
				
				addNotification({
					type: 'success',
					title: 'Connected',
					message: 'Successfully connected to server',
					duration: 3000
				});
			} catch (error) {
				connection.status = 'error';
				connection.error = error.message;
				errors.connection = error.message;
				
				addNotification({
					type: 'error',
					title: 'Connection Failed',
					message: error.message,
					duration: 5000
				});
				
				throw error;
			} finally {
				loading.connect = false;
			}
		},

		/**
		 * Disconnect from socket server
		 */
		async disconnect() {
			await socketService.disconnect();
			connection.status = 'disconnected';
			connection.error = null;
			auth.isAuthenticated = false;
		},

		/**
		 * Get connection health status
		 */
		async healthCheck() {
			return await socketService.healthCheck();
		}
	};

	// Notification management
	function addNotification(notification) {
		if (!config.enableNotifications) return;

		const id = crypto.randomUUID();
		const item = {
			id,
			type: 'info',
			title: '',
			message: '',
			duration: notifications.defaultDuration,
			read: false,
			timestamp: new Date(),
			...notification
		};

		notifications.items.unshift(item);

		// Limit notification count
		if (notifications.items.length > notifications.maxItems) {
			notifications.items = notifications.items.slice(0, notifications.maxItems);
		}

		// Auto-remove after duration
		if (item.duration > 0) {
			setTimeout(() => {
				removeNotification(id);
			}, item.duration);
		}

		return id;
	}

	function removeNotification(id) {
		const index = notifications.items.findIndex(n => n.id === id);
		if (index > -1) {
			notifications.items.splice(index, 1);
		}
	}

	function markNotificationAsRead(id) {
		const notification = notifications.items.find(n => n.id === id);
		if (notification) {
			notification.read = true;
		}
	}

	function clearAllNotifications() {
		notifications.items = [];
	}

	// Global error handling
	function setGlobalError(error) {
		errors.global = error;
		if (error) {
			addNotification({
				type: 'error',
				title: 'Application Error',
				message: error,
				duration: 0 // Persistent until dismissed
			});
		}
	}

	function clearGlobalError() {
		errors.global = null;
	}

	// Global loading management
	function setGlobalLoading(isLoading) {
		loading.global = isLoading;
	}

	// Apply theme to document
	function applyTheme() {
		document.documentElement.className = themeClass;
		localStorage?.setItem('theme', theme.current);
	}

	// Initialize theme from localStorage
	const storedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
	if (storedTheme && theme.available.includes(storedTheme)) {
		theme.current = storedTheme;
	}
	applyTheme();

	// Setup socket event listeners
	$effect(() => {
		socketService.on('connect', () => {
			connection.status = 'connected';
			connection.lastConnected = new Date();
			connection.error = null;
		});

		socketService.on('disconnect', (reason) => {
			connection.status = 'disconnected';
			auth.isAuthenticated = false;
		});

		socketService.on('connect_error', (error) => {
			connection.status = 'error';
			connection.error = error.message;
		});

		socketService.on('error', (error) => {
			errors.connection = error.message;
		});

		// Cleanup on unmount
		return () => {
			socketService.dispose();
		};
	});

	// Public API
	const context = {
		// State (read-only)
		auth: $state.frozen(auth),
		theme: $state.frozen(theme),
		connection: $state.frozen(connection),
		notifications: $state.frozen(notifications),
		loading: $state.frozen(loading),
		errors: $state.frozen(errors),

		// Computed properties
		isOnline,
		canPerformActions,
		hasErrors,
		isLoading,
		isDarkTheme,
		themeClass,
		hasNotifications,
		unreadNotifications,

		// Actions
		auth: authActions,
		theme: themeActions,
		connection: connectionActions,

		// Utilities
		addNotification,
		removeNotification,
		markNotificationAsRead,
		clearAllNotifications,
		setGlobalError,
		clearGlobalError,
		setGlobalLoading,

		// Socket service access
		socket: socketService
	};

	return context;
}

/**
 * Set the app context
 * @param {Object} context - App context instance
 */
export function setAppContext(context) {
	return setContext(APP_CONTEXT_KEY, context);
}

/**
 * Get the app context
 * @returns {Object} App context instance
 */
export function getAppContext() {
	const context = getContext(APP_CONTEXT_KEY);
	if (!context) {
		throw new Error('App context not found. Make sure to call createAppContext() in a parent component.');
	}
	return context;
}