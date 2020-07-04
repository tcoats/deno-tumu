# Deno Tumu

Caddy. Deno. PaaS.

Run code on your server using configuration and javascript hosted on the web.

## Steps

1. [Install Caddy](https://caddyserver.com)
2. [Install Deno](https://deno.land)
3. Configure DNS entries e.g. A record for *.yourdomainhere.com -> server IP address
4. Run Tumu against a `state.json` file describing services to run:
  `deno run --allow-net --allow-run --allow-read=./ --allow-write=./ --unstable --reload https://raw.githubusercontent.com/tcoats/deno-tumu/master/mod.js https://hostedsomewhere.com/state.json`
5. Adjust your `state.json` file and service code.
6. Tumu will automatically restart.
7. Caddy will automatially serve using TLS.

## Status

- [x] Filesystem isolation
- [x] Auto domain and TLS. Via [Caddy](https://caddyserver.com) integration.
- [ ] Network isolation. Not available within Deno. On the roadmap.
- [ ] CPU quota. Does not look supported by V8.
- [ ] Memory quota. Available in V8. Not available within Deno.
- [ ] Pub sub.
- [ ] Single process. Requires a custom cli built within Deno.
