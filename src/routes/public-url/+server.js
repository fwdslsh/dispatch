// src/routes/public-url/+server.js
import fs from 'node:fs';

const TUNNEL_FILE = '/tmp/tunnel-url.txt';

export function GET() {
  try {
    const url = fs.readFileSync(TUNNEL_FILE, 'utf-8').trim();
    return new Response(JSON.stringify({ url }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ url: null }), {
      headers: { 'content-type': 'application/json' }
    });
  }
}