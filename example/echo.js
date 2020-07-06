import { serve } from 'https://deno.land/std/http/server.ts'

const { host, port } = JSON.parse(Deno.args[0])

const ping = () => {
  console.log('ping')
  setTimeout(ping, 5000)
}
ping()

// Restrict connections locally - from caddy only
const server = serve({ hostname: 'localhost', port })
for await (const req of server)
  req.respond({ body: host })
