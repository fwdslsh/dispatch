<script>
    import { onMount, onDestroy } from "svelte";
    import { io } from "socket.io-client";
    import { goto } from "$app/navigation";
    import HeaderToolbar from "$lib/components/HeaderToolbar.svelte";
    import Container from "$lib/components/Container.svelte";
    import { panelStore } from "$lib/stores/panel-store.js";
    import BackIcon from "$lib/components/Icons/BackIcon.svelte";
    import EndSessionIcon from "$lib/components/Icons/EndSessionIcon.svelte";
    import SessionIcon from "$lib/components/Icons/SessionIcon.svelte";
    import StartSession from "$lib/components/Icons/StartSession.svelte";
    import ConfirmationDialog from "$lib/components/ConfirmationDialog.svelte";
    import PublicUrlDisplay from "$lib/components/PublicUrlDisplay.svelte";
    import {
        validateSessionNameRealtime,
        validateSessionNameWithFeedback,
    } from "$lib/utils/session-name-validation.js";

    let projects = [];
    let activeProject = null;
    let projectName = ""; // New project name input
    let projectDescription = ""; // New project description input

    // Validation state for project name
    let nameValidation = { isValid: true };
    let showValidation = false;

    export let data;

    // Reactive validation for project name
    $: {
        nameValidation = validateSessionNameRealtime(projectName);
        // Only show validation feedback when there's a message or it's invalid
        showValidation = !nameValidation.isValid || nameValidation.message;
    }

    // Validate before submission
    function validateBeforeSubmit() {
        const finalValidation = validateSessionNameWithFeedback(projectName);
        nameValidation = finalValidation;
        showValidation = !finalValidation.isValid;
        return finalValidation.isValid;
    }

    let socket;
    let authed = false;

    // Dialog state
    let showDeleteProjectDialog = false;
    let projectToDelete = null;

    // Rename state
    let renamingProjectId = null;
    let renameValue = "";
    let renameValidation = { isValid: true };
    let showRenameValidation = false;

    function startRenaming(projectId, currentName) {
        renamingProjectId = projectId;
        renameValue = currentName;
        renameValidation = { isValid: true };
        showRenameValidation = false;
    }

    function cancelRenaming() {
        renamingProjectId = null;
        renameValue = "";
        renameValidation = { isValid: true };
        showRenameValidation = false;
    }

    async function confirmRename() {
        // Validate rename
        const validation = validateSessionNameWithFeedback(renameValue);
        renameValidation = validation;
        showRenameValidation = !validation.isValid;

        if (!validation.isValid) {
            return;
        }

        try {
            const result = await new Promise((resolve, reject) => {
                socket.emit('update-project', {
                    projectId: renamingProjectId,
                    updates: { name: renameValue.trim() }
                }, (response) => {
                    if (response.ok) {
                        resolve(response);
                    } else {
                        reject(new Error(response.error || 'Update failed'));
                    }
                });
            });

            console.log('Project renamed successfully:', result);
            cancelRenaming();
        } catch (err) {
            console.error('Failed to rename project:', err);
            renameValidation = { 
                isValid: false, 
                message: err.message || 'Failed to rename project',
                severity: 'error'
            };
            showRenameValidation = true;
        }
    }

    onMount(async () => {
        panelStore.closeMobilePanel();

        try {
            socket = io();

            socket.on("connect", () => {
                console.log("Connected to server");
                
                // Authenticate
                socket.emit("auth", data?.terminalKey || "test", (response) => {
                    if (response?.ok || response?.success) {
                        authed = true;
                        loadProjects();
                    } else {
                        console.error("Authentication failed");
                    }
                });
            });

            socket.on("projects-updated", (data) => {
                console.log("Projects updated:", data);
                projects = data.projects || [];
                activeProject = data.activeProject;
            });

            socket.on("disconnect", () => {
                console.log("Disconnected from server");
                authed = false;
            });

        } catch (error) {
            console.error("Failed to connect:", error);
        }
    });

    onDestroy(() => {
        if (socket) {
            socket.disconnect();
        }
    });

    function loadProjects() {
        if (!socket || !authed) return;

        socket.emit("list-projects", (response) => {
            if (response.ok) {
                projects = response.projects || [];
                activeProject = response.activeProject;
                console.log("Loaded projects:", projects);
            } else {
                console.error("Failed to load projects:", response.error);
            }
        });
    }

    async function createProject() {
        if (!validateBeforeSubmit()) {
            return;
        }

        if (!socket || !authed) {
            console.error("Not connected or authenticated");
            return;
        }

        try {
            const result = await new Promise((resolve, reject) => {
                socket.emit('create-project', {
                    name: projectName.trim(),
                    description: projectDescription.trim()
                }, (response) => {
                    if (response.ok) {
                        resolve(response);
                    } else {
                        reject(new Error(response.error || 'Creation failed'));
                    }
                });
            });

            console.log('Project created successfully:', result);
            
            // Clear form
            projectName = "";
            projectDescription = "";
            nameValidation = { isValid: true };
            showValidation = false;

            // Navigate to the new project
            goto(`/projects/${result.project.id}`);
        } catch (err) {
            console.error('Failed to create project:', err);
            nameValidation = { 
                isValid: false, 
                message: err.message || 'Failed to create project',
                severity: 'error'
            };
            showValidation = true;
        }
    }

    function openProject(projectId) {
        goto(`/projects/${projectId}`);
    }

    function setActive(projectId) {
        if (!socket || !authed) return;

        socket.emit("set-active-project", { projectId }, (response) => {
            if (response.ok) {
                console.log("Active project set:", projectId);
            } else {
                console.error("Failed to set active project:", response.error);
            }
        });
    }

    function confirmDeleteProject(project) {
        projectToDelete = project;
        showDeleteProjectDialog = true;
    }

    async function deleteProject() {
        if (!projectToDelete || !socket || !authed) return;

        try {
            const result = await new Promise((resolve, reject) => {
                socket.emit('delete-project', {
                    projectId: projectToDelete.id
                }, (response) => {
                    if (response.ok) {
                        resolve(response);
                    } else {
                        reject(new Error(response.error || 'Deletion failed'));
                    }
                });
            });

            console.log('Project deleted successfully');
            showDeleteProjectDialog = false;
            projectToDelete = null;
        } catch (err) {
            console.error('Failed to delete project:', err);
            // Could show error to user here
        }
    }

    function cancelDeleteProject() {
        showDeleteProjectDialog = false;
        projectToDelete = null;
    }
</script>

<Container>
    {#snippet header()}
        <HeaderToolbar>
            {#snippet left()}
                <button
                    class="btn-icon"
                    on:click={() => goto('/')}
                    title="Back to home"
                    aria-label="Back to home"
                >
                    <BackIcon />
                </button>
            {/snippet}
            {#snippet center()}
                <h1>Projects</h1>
            {/snippet}
            {#snippet right()}
                <PublicUrlDisplay />
            {/snippet}
        </HeaderToolbar>
    {/snippet}

    {#snippet children()}
        <div class="projects">
            {#if projects.length === 0}
                <div class="empty-state">
                    <h2>no projects yet</h2>
                    <p style="font-size: 0.9rem;">
                        create your first project to get started
                    </p>
                </div>
            {:else}
                <ul>
                    {#each projects as project}
                        <li>
                            <div
                                class="project-item"
                                data-augmented-ui="tl-clip tr-clip br-clip bl-clip both"
                                on:click={() => openProject(project.id)}
                                role="button"
                                tabindex="0"
                                on:keydown={(e) =>
                                    e.key === "Enter" &&
                                    openProject(project.id)}
                                title="Open project"
                                aria-label="Open project {project.name}"
                            >
                                <div class="project-actions">
                                    <button
                                        class="btn-sm btn-icon-only project-rename-btn"
                                        on:click={(e) => {
                                            e.stopPropagation();
                                            startRenaming(
                                                project.id,
                                                project.name,
                                            );
                                        }}
                                        title="Rename project"
                                        aria-label="Rename project"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        class="btn-sm btn-icon-only btn-danger"
                                        on:click={(e) => {
                                            e.stopPropagation();
                                            confirmDeleteProject(project);
                                        }}
                                        title="Delete project"
                                        aria-label="Delete project"
                                    >
                                        <EndSessionIcon />
                                    </button>
                                </div>
                                <div class="project-info">
                                    {#if renamingProjectId === project.id}
                                        <div class="rename-container">
                                            <input
                                                type="text"
                                                bind:value={renameValue}
                                                placeholder="Project name"
                                                class="rename-input"
                                                class:invalid={!renameValidation.isValid}
                                                on:keydown={(e) => {
                                                    if (e.key === "Enter") {
                                                        confirmRename();
                                                    } else if (e.key === "Escape") {
                                                        cancelRenaming();
                                                    }
                                                }}
                                                on:click={(e) => e.stopPropagation()}
                                                autofocus
                                            />
                                            <div class="rename-actions">
                                                <button
                                                    class="btn-sm"
                                                    on:click={(e) => {
                                                        e.stopPropagation();
                                                        confirmRename();
                                                    }}
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    class="btn-sm"
                                                    on:click={(e) => {
                                                        e.stopPropagation();
                                                        cancelRenaming();
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            {#if showRenameValidation && renameValidation.message}
                                                <div
                                                    class="rename-validation-message"
                                                    class:error={renameValidation.severity ===
                                                        "error"}
                                                    class:warning={renameValidation.severity ===
                                                        "warning"}
                                                    class:info={renameValidation.severity ===
                                                        "info"}
                                                >
                                                    {renameValidation.message}
                                                </div>
                                            {/if}
                                        </div>
                                    {:else}
                                        <div class="project-name">{project.name}</div>
                                        {#if project.description}
                                            <div class="project-description">{project.description}</div>
                                        {/if}
                                        <div class="project-meta">
                                            {project.sessions?.length || 0} session(s)
                                            {#if activeProject === project.id}
                                                <span class="project-status">(active)</span>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                                <button
                                    class="btn-sm btn-icon-only"
                                    on:click={(e) => {
                                        e.stopPropagation();
                                        openProject(project.id);
                                    }}
                                    title="Open project"
                                    aria-label="Open project"
                                >
                                    <SessionIcon />
                                </button>
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>

        <div class="project-form">
            <h3>Create New Project</h3>
            <div class="form-group">
                <label for="project-name">Project Name</label>
                <input
                    id="project-name"
                    type="text"
                    bind:value={projectName}
                    placeholder="Enter project name"
                    class:invalid={!nameValidation.isValid}
                    on:keydown={(e) => e.key === "Enter" && createProject()}
                />
                {#if showValidation && nameValidation.message}
                    <div
                        class="validation-message"
                        class:error={nameValidation.severity === "error"}
                        class:warning={nameValidation.severity === "warning"}
                        class:info={nameValidation.severity === "info"}
                    >
                        {nameValidation.message}
                    </div>
                {/if}
            </div>
            
            <div class="form-group">
                <label for="project-description">Description (optional)</label>
                <input
                    id="project-description"
                    type="text"
                    bind:value={projectDescription}
                    placeholder="Enter project description"
                    on:keydown={(e) => e.key === "Enter" && createProject()}
                />
            </div>

            <button
                class="btn-primary"
                on:click={createProject}
                disabled={!nameValidation.isValid || !projectName.trim()}
            >
                <StartSession />
                Create Project
            </button>
        </div>
    {/snippet}
</Container>

<!-- Delete confirmation dialog -->
<ConfirmationDialog
    bind:show={showDeleteProjectDialog}
    title="Delete Project"
    message="Are you sure you want to delete '{projectToDelete?.name}'? This will remove all sessions and data in this project."
    confirmText="Delete"
    cancelText="Cancel"
    dangerous={true}
    on:confirm={deleteProject}
    on:cancel={cancelDeleteProject}
/>

<style>
    .projects {
        flex: 1;
        max-height: 400px;
        overflow-y: auto;
        padding: var(--space-md);
    }

    .projects ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .empty-state {
        text-align: center;
        padding: 2rem;
        color: var(--text-muted);
        backdrop-filter: blur(10px);
        margin: var(--space-md);
    }

    .empty-state h2 {
        font-size: 1.2rem;
        color: var(--text-secondary);
        margin-bottom: var(--space-sm);
    }

    .project-item {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-md);
        margin-bottom: var(--space-sm);
        background: rgba(26, 26, 26, 0.8);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
    }

    .project-item:hover {
        background: rgba(0, 255, 136, 0.1);
        border-color: rgba(0, 255, 136, 0.6);
        transform: translateY(-2px);
    }

    .project-actions {
        display: flex;
        gap: var(--space-xs);
    }

    .project-info {
        flex: 1;
        min-width: 0;
    }

    .project-name {
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: var(--space-xs);
    }

    .project-description {
        font-size: 0.9rem;
        color: var(--text-secondary);
        margin-bottom: var(--space-xs);
    }

    .project-meta {
        font-size: 0.8rem;
        color: var(--text-muted);
    }

    .project-status {
        color: var(--accent);
        font-weight: 500;
    }

    .project-form {
        padding: var(--space-md);
        background: rgba(26, 26, 26, 0.8);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 8px;
        margin: var(--space-md);
        backdrop-filter: blur(10px);
    }

    .project-form h3 {
        margin-top: 0;
        margin-bottom: var(--space-md);
        color: var(--text-primary);
    }

    .form-group {
        margin-bottom: var(--space-md);
    }

    .form-group label {
        display: block;
        margin-bottom: var(--space-xs);
        color: var(--text-secondary);
        font-size: 0.9rem;
    }

    .form-group input {
        width: 100%;
        padding: var(--space-sm) var(--space-md);
        background: rgba(26, 26, 26, 0.8);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 6px;
        color: var(--text-primary);
        font-size: 1rem;
    }

    .form-group input:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.2);
    }

    .form-group input.invalid {
        border-color: var(--error);
    }

    .validation-message {
        margin-top: var(--space-xs);
        padding: var(--space-xs) var(--space-sm);
        border-radius: 4px;
        font-size: 0.8rem;
    }

    .validation-message.error {
        background: rgba(255, 99, 99, 0.1);
        color: var(--error);
        border: 1px solid rgba(255, 99, 99, 0.3);
    }

    .validation-message.warning {
        background: rgba(255, 193, 7, 0.1);
        color: #ffc107;
        border: 1px solid rgba(255, 193, 7, 0.3);
    }

    .validation-message.info {
        background: rgba(0, 255, 136, 0.1);
        color: var(--accent);
        border: 1px solid rgba(0, 255, 136, 0.3);
    }

    .rename-container {
        position: relative;
    }

    .rename-input {
        width: 100%;
        padding: var(--space-xs) var(--space-sm);
        background: rgba(26, 26, 26, 0.9);
        border: 1px solid var(--accent);
        border-radius: 4px;
        color: var(--text-primary);
        font-size: 0.9rem;
    }

    .rename-input:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.2);
    }

    .rename-input.invalid {
        border-color: var(--error);
    }

    .rename-actions {
        display: flex;
        gap: var(--space-xs);
        margin-top: var(--space-xs);
    }

    .rename-validation-message {
        margin-top: var(--space-xs);
        padding: var(--space-xs);
        border-radius: 4px;
        font-size: 0.7rem;
    }

    .rename-validation-message.error {
        background: rgba(255, 99, 99, 0.1);
        color: var(--error);
        border: 1px solid rgba(255, 99, 99, 0.3);
    }

    .btn-primary {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md);
        background: var(--accent);
        color: var(--bg);
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .btn-primary:hover:not(:disabled) {
        background: rgba(0, 255, 136, 0.8);
    }

    .btn-primary:disabled {
        background: rgba(0, 255, 136, 0.3);
        cursor: not-allowed;
    }

    .btn-sm {
        padding: var(--space-xs) var(--space-sm);
        background: rgba(0, 255, 136, 0.1);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 4px;
        color: var(--accent);
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-sm:hover {
        background: rgba(0, 255, 136, 0.2);
        border-color: var(--accent);
    }

    .btn-icon-only {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        background: rgba(0, 255, 136, 0.1);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 6px;
        color: var(--accent);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-icon-only:hover {
        background: rgba(0, 255, 136, 0.2);
        border-color: var(--accent);
    }

    .btn-danger {
        background: rgba(255, 99, 99, 0.1);
        border-color: rgba(255, 99, 99, 0.3);
        color: var(--error);
    }

    .btn-danger:hover {
        background: rgba(255, 99, 99, 0.2);
        border-color: var(--error);
    }
</style>