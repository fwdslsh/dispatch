<script>
    import EditIcon from "./Icons/EditIcon.svelte";

    import { io } from "socket.io-client";
    import { goto } from "$app/navigation";
    import SessionIcon from "$lib/components/Icons/SessionIcon.svelte";
    import StartSession from "$lib/components/Icons/StartSession.svelte";
    import ConfirmationDialog from "$lib/components/ConfirmationDialog.svelte";
    // Simple validation functions
    function validateNameRealtime(name) {
        if (!name || name.length === 0) {
            return { isValid: true };
        }
        
        if (name.length > 45) {
            const remaining = 50 - name.length;
            return { 
                isValid: remaining >= 0, 
                message: remaining >= 0 ? `${remaining} characters remaining` : 'Name too long',
                severity: remaining >= 0 ? 'warning' : 'error'
            };
        }
        
        const validPattern = /^[a-zA-Z0-9\s_-]*$/;
        if (!validPattern.test(name)) {
            return { 
                isValid: false, 
                message: 'Invalid characters detected', 
                severity: 'error' 
            };
        }
        
        return { isValid: true };
    }

    function validateNameWithFeedback(name) {
        if (!name || !name.trim()) {
            return { isValid: true, message: 'Will use generated name if empty', severity: 'info' };
        }

        const trimmed = name.trim();
        
        if (trimmed.length > 50) {
            return { isValid: false, error: 'Name must be 50 characters or less' };
        }
        
        const validPattern = /^[a-zA-Z0-9\s_-]+$/;
        if (!validPattern.test(trimmed)) {
            return { isValid: false, error: 'Name can only contain letters, numbers, spaces, hyphens, and underscores' };
        }

        if (trimmed.length < 3) {
            return { isValid: true, message: 'Very short name', severity: 'warning' };
        }
        
        if (trimmed.length > 30) {
            return { isValid: true, message: 'Long name (max 50)', severity: 'warning' };
        }

        return { isValid: true };
    }
    import DeleteProject from "./Icons/DeleteProject.svelte";
    import { onMount } from "svelte";

    let { terminalKey } = $props();

    let projects = $state([]);
    let activeProject = $state(null);
    
    // Debug: track projects array changes
    $effect(() => {
        console.log("Projects reactive update - length:", projects.length);
    });
    let projectName = $state("");
    let projectDescription = $state("");

    // Validation state for project name
    let nameValidation = $state({
        isValid: true,
        message: "",
        severity: "info",
    });

    // Reactive validation for project name
    $effect(() => {
        nameValidation = validateNameRealtime(projectName);
    });

    // Validate before submission
    function validateBeforeSubmit() {
        const finalValidation = validateNameWithFeedback(projectName);
        nameValidation = finalValidation;
        return finalValidation.isValid;
    }

    let socket = $state(null);
    let authed = $state(false);

    // Dialog state
    let showDeleteProjectDialog = $state(false);
    let projectToDelete = $state(null);

    // Rename state
    let renamingProjectId = $state(null);
    let renameValue = $state("");
    let renameValidation = $state({
        isValid: true,
        message: "",
        severity: "info",
    });
    let showRenameValidation = $state(false);

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
        const validation = validateNameWithFeedback(renameValue);
        renameValidation = validation;
        showRenameValidation = !validation.isValid;

        if (!validation.isValid) {
            return;
        }

        try {
            const result = await new Promise((resolve, reject) => {
                socket.emit(
                    "update-project",
                    {
                        projectId: renamingProjectId,
                        updates: { name: renameValue.trim() },
                    },
                    (response) => {
                        if (response.success) {
                            resolve(response);
                        } else {
                            reject(
                                new Error(response.error || "Update failed"),
                            );
                        }
                    },
                );
            });

            console.log("Project renamed successfully:", result);
            cancelRenaming();
        } catch (err) {
            console.error("Failed to rename project:", err);
            renameValidation = {
                isValid: false,
                message: err.message || "Failed to rename project",
                severity: "error",
            };
            showRenameValidation = true;
        }
    }

    onMount(() => {
        try {
            if (!socket) {
                socket = io();
            }

            socket.on("connect", () => {
                console.log("Connected to server");

                // Get stored auth token from login
                const storedAuth = localStorage.getItem("dispatch-auth-token");
                const authKey = storedAuth === "no-auth" ? "" : storedAuth || "testkey12345";
                
                // Authenticate
                socket.emit("auth", authKey, (response) => {
                    if (response?.success) {
                        authed = true;
                        // Load projects immediately after authentication
                        loadProjects();
                    } else {
                        console.error("Authentication failed");
                    }
                });
            });

            socket.on("projects-updated", (data) => {
                console.log("Projects updated:", data);
                console.log("Setting projects array to:", data.projects?.length || 0, "items");
                projects = data.projects || [];
                activeProject = data.activeProject;
                console.log("Projects array now has:", projects.length, "items");
            });

            socket.on("disconnect", () => {
                console.log("Disconnected from server");
                authed = false;
            });
        } catch (error) {
            console.error("Failed to connect:", error);
        }

        // Cleanup function
        return () => {
            if (socket) {
                socket.disconnect();
                socket = null;
            }
        };
    });

    function loadProjects() {
        if (!socket || !authed) {
            console.log("Cannot load projects: socket =", !!socket, "authed =", authed);
            return;
        }

        console.log("Loading projects via list-projects...");
        socket.emit("list-projects", {}, (response) => {
            console.log("list-projects response:", response);
            if (response?.success) {
                const newProjects = response.projects || [];
                console.log("Setting projects to:", newProjects.length, "items");
                projects = newProjects;
                activeProject = response.activeProject;
                console.log("Projects now contains:", $state.snapshot(projects));
            } else {
                console.error("Failed to load projects:", response?.error || "Unknown error");
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
                socket.emit(
                    "create-project",
                    {
                        name: projectName.trim(),
                        description: projectDescription.trim(),
                    },
                    (response) => {
                        if (response.success) {
                            resolve(response);
                        } else {
                            reject(
                                new Error(response.error || "Creation failed"),
                            );
                        }
                    },
                );
            });

            console.log("Project created successfully:", result);

            // Clear form
            projectName = "";
            projectDescription = "";
            nameValidation = { isValid: true, message: "", severity: "info" };

            // Navigate to the newly created project
            if (result.project?.id) {
                goto(`/projects/${result.project.id}`);
            }
        } catch (err) {
            console.error("Failed to create project:", err);
            nameValidation = {
                isValid: false,
                message: err.message || "Failed to create project",
                severity: "error",
            };
        }
    }

    function openProject(projectId) {
        goto(`/projects/${projectId}`);
    }

    function setActive(projectId) {
        if (!socket || !authed) return;

        socket.emit("set-active-project", { projectId }, (response) => {
            if (response.success) {
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
                socket.emit(
                    "delete-project",
                    {
                        projectId: projectToDelete.id,
                    },
                    (response) => {
                        if (response.success) {
                            resolve(response);
                        } else {
                            reject(
                                new Error(response.error || "Deletion failed"),
                            );
                        }
                    },
                );
            });

            console.log("Project deleted successfully");
            showDeleteProjectDialog = false;
            projectToDelete = null;
        } catch (err) {
            console.error("Failed to delete project:", err);
            // Could show error to user here
        }
    }

    function cancelDeleteProject() {
        showDeleteProjectDialog = false;
        projectToDelete = null;
    }
</script>

<div class="projects-container">
    <div
        class="project-form"
        data-augmented-ui="tl-clip tr-clip br-clip bl-clip both"
    >
        <h3>Create New Project</h3>
        <div class="form-group">
            <label for="project-name">Project Name</label>
            <input
                id="project-name"
                type="text"
                bind:value={projectName}
                placeholder="Enter project name"
                class:invalid={!nameValidation.isValid}
                onkeydown={(e) => e.key === "Enter" && createProject()}
            />
            {#if !nameValidation.isValid && nameValidation.message}
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
                onkeydown={(e) => e.key === "Enter" && createProject()}
            />
        </div>

        <button
            class="btn-primary"
            onclick={createProject}
            disabled={!nameValidation.isValid || !projectName.trim()}
        >
            <StartSession />
            Create Project
        </button>
    </div>
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
                            onclick={() => openProject(project.id)}
                            role="button"
                            tabindex="0"
                            onkeydown={(e) =>
                                e.key === "Enter" && openProject(project.id)}
                            title="Open project"
                            aria-label="Open project {project.name}"
                        >
                            <div class="project-actions">
                                <button
                                    class="btn-icon-only project-rename-btn"
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        startRenaming(project.id, project.name);
                                    }}
                                    title="Rename project"
                                    aria-label="Rename project"
                                >
                                    <EditIcon></EditIcon>
                                </button>
                                <button
                                    class="btn-icon-only button-danger"
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        confirmDeleteProject(project);
                                    }}
                                    title="Delete project"
                                    aria-label="Delete project"
                                >
                                    <DeleteProject />
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
                                            onkeydown={(e) => {
                                                if (e.key === "Enter") {
                                                    confirmRename();
                                                } else if (e.key === "Escape") {
                                                    cancelRenaming();
                                                }
                                            }}
                                            onclick={(e) => e.stopPropagation()}
                                        />
                                        <div class="rename-actions">
                                            <button
                                                class="btn-icon-only"
                                                onclick={(e) => {
                                                    e.stopPropagation();
                                                    confirmRename();
                                                }}
                                            >
                                                ✓
                                            </button>
                                            <button
                                                class="btn-icon-only button-danger"
                                                onclick={(e) => {
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
                                    <div class="project-name">
                                        {project.name}
                                    </div>
                                    {#if project.description}
                                        <div class="project-description">
                                            {project.description}
                                        </div>
                                    {/if}
                                {/if}
                                <div class="project-meta">
                                    {project.sessions?.length || 0} session(s)
                                    {#if activeProject === project.id}
                                        <span class="project-status"
                                            >(active)</span
                                        >
                                    {/if}
                                </div>
                            </div>
                            <button
                                class="btn-icon-only"
                                onclick={(e) => {
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
</div>
<!-- Delete confirmation dialog -->
<ConfirmationDialog
    bind:show={showDeleteProjectDialog}
    title="Delete Project"
    message="Are you sure you want to delete '{projectToDelete?.name}'? This will remove all sessions and data in this project."
    confirmText="Delete"
    cancelText="Cancel"
    dangerous={true}
    onconfirm={deleteProject}
    oncancel={cancelDeleteProject}
/>

<style>
    .projects-container {
        display: flex;
        flex-direction: row;
        height: 100%;
        justify-content: space-between;
    }
    .projects {
        flex: 1;
        max-height: 90svh;
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
        display: flex;
        flex-direction: row;
        width: 100%;
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
</style>
