/**
 * Simple Session Context - Pure State Management
 * 
 * Clean context focused only on session state without service creation.
 */

import { getContext, setContext } from 'svelte';

const SESSION_CONTEXT_KEY = Symbol('session-context');

/**
 * Create simple session context
 */
export function createSessionContext() {
  // Simple reactive state - no service creation
  const sessions = $state({
    list: [],
    current: null,
    isCreating: false,
    isLoading: false
  });

  const sessionForm = $state({
    isVisible: false,
    selectedType: null,
    formData: {}
  });

  // Simple computed states
  const hasSessions = $derived(() => sessions.list.length > 0);
  const hasCurrentSession = $derived(() => sessions.current !== null);
  const canCreateSession = $derived(() => !sessions.isCreating);
  const currentSessionType = $derived(() => sessions.current?.type || null);

  // Simple state actions
  const actions = {
    // Session list actions
    setSessions(sessionList) {
      sessions.list = sessionList || [];
    },

    addSession(session) {
      if (session && !sessions.list.find(s => s.sessionId === session.sessionId)) {
        sessions.list.push(session);
      }
    },

    updateSession(updatedSession) {
      const index = sessions.list.findIndex(s => s.sessionId === updatedSession.sessionId);
      if (index >= 0) {
        sessions.list[index] = updatedSession;
        
        // Update current session if it's the one being updated
        if (sessions.current && sessions.current.sessionId === updatedSession.sessionId) {
          sessions.current = updatedSession;
        }
      }
    },

    removeSession(sessionId) {
      sessions.list = sessions.list.filter(s => s.sessionId !== sessionId);
      
      // Clear current session if it was removed
      if (sessions.current && sessions.current.sessionId === sessionId) {
        sessions.current = null;
      }
    },

    // Current session actions
    setCurrentSession(session) {
      sessions.current = session;
    },

    clearCurrentSession() {
      sessions.current = null;
    },

    // Loading and creation state actions
    setLoading(loading) {
      sessions.isLoading = loading;
    },

    setCreating(creating) {
      sessions.isCreating = creating;
    },

    // Session form actions
    showSessionForm() {
      sessionForm.isVisible = true;
    },

    hideSessionForm() {
      sessionForm.isVisible = false;
      sessionForm.selectedType = null;
      sessionForm.formData = {};
    },

    setSelectedSessionType(type) {
      sessionForm.selectedType = type;
    },

    setFormData(data) {
      sessionForm.formData = { ...sessionForm.formData, ...data };
    },

    clearFormData() {
      sessionForm.formData = {};
    }
  };

  const context = {
    // State
    sessions,
    sessionForm,

    // Computed
    hasSessions,
    hasCurrentSession,
    canCreateSession,
    currentSessionType,

    // Actions
    ...actions
  };

  setContext(SESSION_CONTEXT_KEY, context);
  return context;
}

/**
 * Get session context
 */
export function getSessionContext() {
  const context = getContext(SESSION_CONTEXT_KEY);
  if (!context) {
    throw new Error('Session context not found. Make sure createSessionContext() is called in a parent component.');
  }
  return context;
}

/**
 * Simple utility for session list
 */
export function useSessions() {
  const context = getSessionContext();
  return {
    sessions: context.sessions.list,
    hasSessions: context.hasSessions,
    isLoading: context.sessions.isLoading,
    setSessions: context.setSessions,
    addSession: context.addSession,
    updateSession: context.updateSession,
    removeSession: context.removeSession,
    setLoading: context.setLoading
  };
}

/**
 * Simple utility for current session
 */
export function useCurrentSession() {
  const context = getSessionContext();
  return {
    currentSession: context.sessions.current,
    hasCurrentSession: context.hasCurrentSession,
    currentSessionType: context.currentSessionType,
    setCurrentSession: context.setCurrentSession,
    clearCurrentSession: context.clearCurrentSession
  };
}

/**
 * Simple utility for session creation
 */
export function useSessionCreation() {
  const context = getSessionContext();
  return {
    isCreating: context.sessions.isCreating,
    canCreate: context.canCreateSession,
    isFormVisible: context.sessionForm.isVisible,
    selectedType: context.sessionForm.selectedType,
    formData: context.sessionForm.formData,
    
    // Actions
    setCreating: context.setCreating,
    showForm: context.showSessionForm,
    hideForm: context.hideSessionForm,
    setSelectedType: context.setSelectedSessionType,
    setFormData: context.setFormData,
    clearFormData: context.clearFormData
  };
}