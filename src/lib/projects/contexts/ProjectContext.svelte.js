/**
 * Simple Project Context - Pure State Management
 *
 * Clean context focused only on project state without service creation.
 */

import { getContext, setContext } from 'svelte';

const PROJECT_CONTEXT_KEY = Symbol('project-context');

/**
 * Create simple project context
 */
export function createProjectContext() {
	// Simple reactive state - no service creation
	const projects = $state({
		list: [],
		current: null,
		isLoading: false
	});

	// Simple computed states
	const hasProjects = $derived(() => projects.list.length > 0);
	const hasCurrentProject = $derived(() => projects.current !== null);
	const currentProjectName = $derived(() => projects.current?.name || '');

	// Simple state actions
	const actions = {
		// Project list actions
		setProjects(projectList) {
			projects.list = projectList || [];
		},

		addProject(project) {
			if (project && !projects.list.find((p) => p.id === project.id)) {
				projects.list.push(project);
			}
		},

		updateProject(updatedProject) {
			const index = projects.list.findIndex((p) => p.id === updatedProject.id);
			if (index >= 0) {
				projects.list[index] = updatedProject;

				// Update current project if it's the one being updated
				if (projects.current && projects.current.id === updatedProject.id) {
					projects.current = updatedProject;
				}
			}
		},

		removeProject(projectId) {
			projects.list = projects.list.filter((p) => p.id !== projectId);

			// Clear current project if it was removed
			if (projects.current && projects.current.id === projectId) {
				projects.current = null;
			}
		},

		// Current project actions
		setCurrentProject(project) {
			projects.current = project;
		},

		clearCurrentProject() {
			projects.current = null;
		},

		// Loading state actions
		setLoading(loading) {
			projects.isLoading = loading;
		}
	};

	const context = {
		// State
		projects,

		// Computed
		hasProjects,
		hasCurrentProject,
		currentProjectName,

		// Actions
		...actions
	};

	setContext(PROJECT_CONTEXT_KEY, context);
	return context;
}

/**
 * Get project context
 */
export function getProjectContext() {
	const context = getContext(PROJECT_CONTEXT_KEY);
	if (!context) {
		throw new Error(
			'Project context not found. Make sure createProjectContext() is called in a parent component.'
		);
	}
	return context;
}

/**
 * Simple utility for project list
 */
export function useProjects() {
	const context = getProjectContext();
	return {
		projects: context.projects.list,
		hasProjects: context.hasProjects,
		isLoading: context.projects.isLoading,
		setProjects: context.setProjects,
		addProject: context.addProject,
		updateProject: context.updateProject,
		removeProject: context.removeProject,
		setLoading: context.setLoading
	};
}

/**
 * Simple utility for current project
 */
export function useCurrentProject() {
	const context = getProjectContext();
	return {
		currentProject: context.projects.current,
		hasCurrentProject: context.hasCurrentProject,
		currentProjectName: context.currentProjectName,
		setCurrentProject: context.setCurrentProject,
		clearCurrentProject: context.clearCurrentProject
	};
}
