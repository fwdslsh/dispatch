<script>
    import { goto } from "$app/navigation";
    import HeaderToolbar from "$lib/components/HeaderToolbar.svelte";
    import Container from "$lib/components/Container.svelte";
    import PublicUrlDisplay from "$lib/components/PublicUrlDisplay.svelte";
    import Projects from "$lib/components/Projects.svelte";
    import ExitIcon from "$lib/components/Icons/ExitIcon.svelte";

    let { data } = $props();

    function logout(){
        localStorage.removeItem('dispatch-auth-token');
        goto("/");
    }
</script>

<Container>
    {#snippet header()}
        <HeaderToolbar>
            {#snippet left()}
                <button
                    class="btn-icon-only button-danger"
                    onclick={() => logout()}
                    title="Logout"
                    aria-label="Logout"
                >
                    <ExitIcon />
                </button>
            {/snippet}
            {#snippet right()}
                <h2>Projects</h2>
            {/snippet}
        </HeaderToolbar>
    {/snippet}

    {#snippet children()}
        <PublicUrlDisplay />
        <Projects terminalKey={data?.terminalKey} />
    {/snippet}
</Container>
