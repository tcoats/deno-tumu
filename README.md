# Deno Tumu

Caddy. Deno. PaaS.

Run code on your server using configuration and javascript hosted on the web.

## Steps

1. [Install Caddy](https://caddyserver.com)
2. [Install Deno](https://deno.land)
3. Configure DNS entries e.g. A record for *.yourdomainhere.com -> server IP address
4. Run Tumu against a `state.json` file describing services to run:
  ```javascript
  deno run \
    --allow-net \
    --allow-run \
    --allow-read=./ \
    --allow-write=./ \
    --unstable \
    --reload \
    https://raw.githubusercontent.com/tcoats/deno-tumu/master/mod.js \
    https://hostedsomewhere.com/state.json
  ```
5. Adjust your `state.json` file and service code.
6. Tumu will automatically restart.
7. Caddy will automatially serve using TLS.

## state.json

```json
{
  "http": {
    "test1.yourdomainhere.com": "http://localhost:8080/echo.js",
    "test2.yourdomainhere.com": "http://localhost:8080/echo.js"
  },
  "cwd": {
    "test3.yourdomainhere.com": "http://localhost:8080/ping.js",
    "test4.yourdomainhere.com": "http://localhost:8080/ping.js"
  },
  "state_refresh": 10000,
  "starting_port": 9001,
  "telegram_token": "XXXXX",
  "telegram_topic": "YYYYY",
  "caddy_routes": []
}
```

`refresh` and `starting_port` are optional and will default to the values above.

`serve` is an object that maps the domains to serve from and the code to execute for that instance.

## Big rocks

- [x] Filesystem isolation
- [x] Auto domain and TLS. Via [Caddy](https://caddyserver.com) integration.
- [x] Telegram integration
- [ ] Network isolation. Not available within Deno. On the roadmap.
- [ ] CPU quota. Does not look supported by V8.
- [ ] Memory quota. Available in V8. Not available within Deno.
- [ ] Pub sub.
- [ ] Single process. Requires a custom cli built within Deno. Plugin?

## Smaller

- [ ] Recycle ports.
- [ ] Allow a local state.json file, reload on SIGHUP? Use fileWatcher?
- [ ] Optional caddy integration
