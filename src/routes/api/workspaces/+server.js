
export async function GET({ locals }) {
  const list = await locals.workspaces.list();
  return new Response(JSON.stringify({ list }), { headers: { 'content-type': 'application/json' }});
}

export async function POST({ request, locals }) {
  const { action, from, to, path } = await request.json();
  if (action === 'open')  return new Response(JSON.stringify(await locals.workspaces.open(path)));
  if (action === 'clone') return new Response(JSON.stringify(await locals.workspaces.clone(from, to)));
  return new Response('Bad Request', { status: 400 });
}
