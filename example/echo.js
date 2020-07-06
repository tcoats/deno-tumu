import { serve } from 'https://deno.land/std/http/server.ts'

const { host, port } = JSON.parse(Deno.args[0])

// Restrict connections locally - from caddy only
const server = serve({ hostname: '127.0.0.1', port })

for await (const req of server) {
  console.error(host)
  req.respond({ body: host })
}
