import fs from 'node:fs';

const TUNNEL_FILE = "/tmp/tunnel-url.txt";
function GET() {
  try {
    const url = fs.readFileSync(TUNNEL_FILE, "utf-8").trim();
    return new Response(JSON.stringify({ url }), {
      headers: { "content-type": "application/json" }
    });
  } catch {
    return new Response(JSON.stringify({ url: null }), {
      headers: { "content-type": "application/json" }
    });
  }
}

export { GET };
//# sourceMappingURL=_server-6f2b4079.js.map
