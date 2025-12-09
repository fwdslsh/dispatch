/**
 * TabState.svelte.js
 *
 * Focused tab state management using Svelte 5 runes.
 * Single responsibility: managing tab data and lifecycle.
 */

import { createLogger } from '../utils/logger.js';
import { TAB_TYPE } from '../../../shared/tab-types.js';
import { SvelteMap, SvelteDate } from 'svelte/reactivity';

const log = createLogger('tab-state');

export class TabState {
	constructor() {
		// Core tab data
		this.tabs = $state([]);
		this.selectedTab = $state(null);
		this.loading = $state(false);
		this.error = $state(null);

		// Activity tracking
		this.tabActivity = $state(new SvelteMap());
		this.lastMessageTimestamps = $state(new SvelteMap());

		// Derived state
		this.inLayoutTabs = $derived.by(() => this.tabs.filter((t) => t.inLayout));

		this.activeTabs = $derived.by(() => this.tabs.filter((t) => t.isActive));

		this.aiTabs = $derived.by(() => this.tabs.filter((t) => t.tabType === TAB_TYPE.AI));

		this.terminalTabs = $derived.by(() => this.tabs.filter((t) => t.tabType === TAB_TYPE.TERMINAL));

		this.tabCount = $derived(this.tabs.length);
		this.hasActiveTabs = $derived(this.activeTabs.length > 0);
	}

	// Tab CRUD operations
	loadTabs(tabs) {
		log.info('[TabState] Loading tabs:', tabs);
		this.tabs = tabs.map((tab) => ({
			id: tab.id,
			typeSpecificId: tab.typeSpecificId,
			projectPath: tab.workspacePath || tab.projectPath,
			tabType: tab.type || tab.tabType || tab.sessionType,
			isActive: tab.isActive !== undefined ? tab.isActive : true,
			inLayout: tab.inLayout !== undefined ? tab.inLayout : !!tab.tileId,
			tileId: tab.tileId ?? null,
			title: tab.title || `${tab.type} tab`,
			createdAt: tab.createdAt || new SvelteDate().toISOString(),
			lastActivity: tab.lastActivity || new SvelteDate().toISOString(),
			activityState: tab.activityState || 'idle'
		}));
		log.info('[TabState] Processed tabs:', this.tabs);
		this.loading = false;
		this.error = null;
		log.info('Tabs loaded', { count: this.tabs.length });
	}

	addTab(tabData) {
		const newTab = {
			...tabData,
			tabType: tabData.type || tabData.tabType,
			projectPath: tabData.workspacePath || tabData.projectPath,
			createdAt: new SvelteDate().toISOString(),
			lastActivity: new SvelteDate().toISOString(),
			isActive: true,
			inLayout: false,
			tileId: tabData.tileId ?? null
		};
		this.tabs.push(newTab);
		log.info('Tab added', newTab.id);
	}

	updateTab(tabId, updates) {
		const index = this.tabs.findIndex((t) => t.id === tabId);
		if (index >= 0) {
			// Normalize tabType property if type is provided in updates
			const normalizedUpdates = {
				...updates,
				...(updates.type && { tabType: updates.type }),
				...(updates.workspacePath && { projectPath: updates.workspacePath })
			};
			this.tabs[index] = { ...this.tabs[index], ...normalizedUpdates };
			log.info('Tab updated', tabId);
		}
	}

	removeTab(tabId) {
		this.tabs = this.tabs.filter((t) => t.id !== tabId);
		this.tabActivity.delete(tabId);
		this.lastMessageTimestamps.delete(tabId);
		log.info('Tab removed', tabId);
	}

	// Activity tracking
	updateActivity(tabId, activityState, timestamp) {
		this.tabActivity.set(tabId, activityState);
		if (timestamp) {
			this.lastMessageTimestamps.set(tabId, timestamp);
		}
	}

	// Query methods
	getTab(tabId) {
		return this.tabs.find((t) => t.id === tabId) || null;
	}

	getTabsByProject(projectPath) {
		return this.tabs.filter((t) => t.projectPath === projectPath);
	}

	getTabsByType(tabType) {
		return this.tabs.filter((t) => t.tabType === tabType);
	}

	// Loading and error state
	setLoading(loading) {
		this.loading = loading;
	}

	setError(error) {
		this.error = error;
	}

	clearError() {
		this.error = null;
	}

	// Backwards compatibility aliases (to be removed after full migration)
	get sessions() {
		return this.tabs;
	}
	get inLayoutSessions() {
		return this.inLayoutTabs;
	}
	get activeSessions() {
		return this.activeTabs;
	}
	get sessionCount() {
		return this.tabCount;
	}
	get hasActiveSessions() {
		return this.hasActiveTabs;
	}
	loadSessions(sessions) {
		return this.loadTabs(sessions);
	}
}
