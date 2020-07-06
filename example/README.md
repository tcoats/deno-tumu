# Deno Tumu Example

Run tumu against `state.json`.

```bash
$ deno run \
    --quiet \
    --allow-net \
    --allow-run \
    --allow-read=./ \
    --allow-write=./ \
    --unstable \
    https://raw.githubusercontent.com/tcoats/deno-tumu/master/mod.js \
    https://raw.githubusercontent.com/tcoats/deno-tumu/master/example/state.json
```

`state.json` can be a url or a local file.
Code referenced can be hosted locally.
