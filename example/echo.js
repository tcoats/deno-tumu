import { serve } from 'https://deno.land/std/http/server.ts'

const { host, port } = JSON.parse(Deno.args)

const server = serve({ port })
for await (const req of server)
  req.respond({ body: host })
