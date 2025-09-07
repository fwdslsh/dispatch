/** @type {import('./$types').PageServerLoad} */
export async function load({ parent, params }) {
    const { data } = await parent();

    const project = data?.projects
        ?.find(p => p.id === params.id);
        
    if (!project) {
        return {
            status: 404,
            error: 'Project not found'
        };
    }
    return { project };
};