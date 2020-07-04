// lib
const hash = s => [...s].reduce((hash, c) => (((hash << 5) - hash) + c.charCodeAt(0)) | 0, 0)
const sleep = time => new Promise(res => setTimeout(res, time))
const wait = (fn, delay) => new Promise(async res => {
  const attempt = async () => {
    try { res(await fn()) }
    catch (e) { return false }
    return true
  }
  while (!await attempt()) await sleep(delay)
})
const exists = async path => {
  try {
    await Deno.stat(path)
    return true
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false
    else throw e
  }
}
const mutex = () => {
  const api = {
    islocked: false,
    current: Promise.resolve(),
    acquire: () => {
      let release
      const next = new Promise(resolve => release = () => {
        api.islocked = false
        resolve()
      })
      const result = api.current.then(() => {
        api.islocked = true
        return release
      })
      api.current = next
      return result
    }
  }
  return api
}


if (Deno.args.length != 1) {
  console.log('url for JSON configuration required')
  Deno.exit(1)
}
const state_url = Deno.args[0]

let nextport = 9001
const handles = new Map()
const hosts = new Set()

const launch = async (host, url) => {
  hosts.add(host)
  const slug = host.replace(/:/g, '_')
  const handle = { host, url, slug, port: nextport++, status: 'launching' }
  handles.set(host, handle)
  if (!await exists(slug)) Deno.mkdir(slug)
  start(handle)
}

const gethash = async handle => {
  const res = await fetch(handle.url)
  const source = await res.text()
  return hash(source)
}

const start = async handle => {
  handle.status = 'starting'
  try {
    handle.fingerprint = await gethash(handle)
  }
  catch (e) {
    handle.status = 'retrying'
    console.error(e)
    return
  }
  const payload = {
    host: handle.host,
    url: handle.url,
    port: handle.port,
    fingerprint: handle.fingerprint
  }
  handle.process = await Deno.run({
    cmd: `deno run --allow-net --allow-read=./ --allow-write=./ --reload=${handle.url} ${handle.url} ${JSON.stringify(payload)}`.split(' '),
    stdout: 'inherit', stderr: 'inherit', stdin: 'null',
    cwd: handle.slug
  })
  handle.status = 'running'
  console.log(handle.host, 'running')
  await handle.process.status()
  if (handle.status == 'running') {
    handle.status = 'stopped'
    console.log(handle.host, 'stopped')
  }
}

const stop = handle => new Promise(res => {
  handle.process.kill(Deno.Signal.SIGINT)
  let has_stopped = false
  ;(async () => {
    await handle.process.status()
    if (!has_stopped) {
      has_stopped = true
      res()
    }
  })()
  ;(async () => {
    await sleep(1000)
    if (!has_stopped) {
      has_stopped = true
      handle.process.close()
      res()
    }
  })()
})

const restart = async handle => {
  handle.status = 'restarting'
  console.log(handle.host, 'restarting')
  await stop(handle)
  start(handle)
}

const remove = async handle => {
  hosts.delete(handle.host)
  handles.delete(handle.host)
  handle.status = 'stopping'
  console.log(handle.host, 'stopping')
  stop(handle)
}

const haschanged = async handle => {
  try {
    const fingerprint = await gethash(handle)
    if (handle.fingerprint != fingerprint) return true
  }
  catch (e) { }
  return false
}

const shouldrefresh = async handle => {
  handle.status = 'checkingforupdates'
  if (await haschanged(handle)) restart(handle)
  else handle.status = 'running'
}

const shouldretry = async handle => {
  handle.status = 'checkingforupdates'
  if (await haschanged(handle)) start(handle)
  handle.status = 'stopped'
}

const diff = (prev, now) => {
  const res = { put: [], del: [], same: [] }
  for (const key of prev.keys())
    if (now.has(key)) res.same.push(key)
    else res.del.push(key)
  for (const key of now.keys())
    if (!prev.has(key)) res.put.push(key)
  return res
}

let caddy_fingerprint = null
const update = async state => {
  const newhosts = new Map(Object.entries(state.serve))
  const { put, del, same } = diff(
    hosts,
    newhosts
  )
  for (const key of put) launch(key, newhosts.get(key))
  for (const key of del) remove(handles.get(key))
  for (const key of same) handles.get(key).url = newhosts.get(key)
  if (put.length > 0 || del.length > 0) {
    const caddy = { apps: { http: { servers: { srv0: {
      listen: [':443'],
      routes: (state.routes || []).concat(Array.from(newhosts.keys(), host => ({
        handle: [{
          handler: 'reverse_proxy',
          upstreams: [{ dial: `127.0.0.1:${handles.get(host).port}` }]
        }],
        match: [{ host: [host] }],
        terminal: true
      })))
    } } } } }
    const body = JSON.stringify(caddy)
    const fingerprint = hash(body)
    if (caddy_fingerprint == fingerprint) return
    const response = await fetch('http://localhost:2019/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    })
    if (!response.ok) console.error(await response.text())
  }
}

let lasterror = null
const getstate = async () => {
  try {
    const res = await fetch(state_url)
    return await res.json()
  }
  catch (e) {
    const error = e.toString()
    // squelch repeat errors
    if (lasterror != error) {
      lasterror = error
      console.error(e)
    }
    throw e
  }
}

const initial_state = await wait(getstate, 1000)
if (initial_state.starting_port) nextport = initial_state.starting_port
await update(initial_state)

const refresh_mutex = mutex()
const refresh = async () => {
  const release = await refresh_mutex.acquire()
  let state = null
  try {
    state = await getstate()
    await update(state)
  }
  catch (e) { }

  for (const [key, value] of handles.entries()) {
    if (value.status == 'running') shouldrefresh(value)
    else if (value.status == 'stopped') shouldretry(value)
    else if (value.status == 'retrying') start(value)
  }
  release()
  setTimeout(refresh, state.refresh || 10000)
}

setTimeout(refresh, initial_state.refresh || 10000)
