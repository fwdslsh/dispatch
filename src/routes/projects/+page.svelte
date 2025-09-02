<script>
    import { goto } from "$app/navigation";
    import HeaderToolbar from "$lib/components/HeaderToolbar.svelte";
    import Container from "$lib/components/Container.svelte";
    import BackIcon from "$lib/components/Icons/BackIcon.svelte";
    import PublicUrlDisplay from "$lib/components/PublicUrlDisplay.svelte";
    import Projects from "$lib/components/Projects.svelte";

    export let data;

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
                    class="btn-icon-only"
                    on:click={() => logout()}
                    title="Back to home"
                    aria-label="Back to home"
                >
                    <BackIcon />
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
