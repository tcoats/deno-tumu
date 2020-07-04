# Deno Tumu Example

Spin up a file server on port 8080.

`$ deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts -p 8080`

Run tumu against `state.json`.

`$ deno run --allow-net --allow-run --allow-read=./ --allow-write=./ --unstable ../mod.js http://localhost:8080/state.json`

`state.json` will spin up two echo servers.
`state.json` and `echo.js` could be a secret github gist, your own public repo or a locally hosted file server.