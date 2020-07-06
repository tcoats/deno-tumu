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
  "state_refresh": 10000,
  "http": {
    "test1.yourdomainhere.com": "http://localhost:8080/echo.js",
    "test2.yourdomainhere.com": "http://localhost:8080/echo.js"
  },
  "cmd": {
    "test3.yourdomainhere.com": "http://localhost:8080/ping.js",
    "test4.yourdomainhere.com": "http://localhost:8080/ping.js"
  },
  "telegram": {
    "token": "XXXXX",
    "topic": "YYYYY"
  },
  "caddy": {
    "starting_port": 9001,
    "routes": []
  }
}
```

`state_refresh` and `starting_port` are optional and will default to the values above.

`http` is an object that maps the domains to serve from and the code to execute for that instance.

`cmd` is an object that maps identifiers to code to run as a daemon.

## Big rocks

- [x] Filesystem isolation
- [x] Auto domain and TLS. Via [Caddy](https://caddyserver.com) integration.
- [x] Telegram integration
- [ ] Network isolation. Not available within Deno. On the Deno roadmap.
- [ ] CPU quota. Does not look supported by V8.
- [ ] Memory quota. Available in V8. Not available within Deno. Not on the roadmap?
- [ ] Pub sub. Implement via TCP + file sync'd queues. Reimplement resolute?
- [ ] Single process. Requires a custom cli built within Deno. Or a plugin?

## Smaller

- [x] Recycle ports.
- [ ] Allow a local state.json file, reload on SIGHUP? Use fileWatcher?
- [x] Optional caddy integration
- [ ] Why doesn't setMyCommands work?
