import { hash, sleep, wait, exists, mutex, lines } from './lib.js'
import telegram from './telegram.js'

if (Deno.args.length != 1) {
  console.log('url for JSON configuration required')
  Deno.exit(1)
}
const state_url = Deno.args[0]

let caddy_fingerprint = null
let telegram_integration = null
let telegram_topic = null
const used_ports = new Set()
let starting_port = 9001
const next_port = () => {
  let port = starting_port
  while (used_ports.has(port)) port++
  used_ports.add(port)
  return port
}
const handles = new Map()
const http = new Set()
const cmd = new Set()

const generate_topics = (topic, service, type) => [
  `${telegram_topic}.*`,
  `${telegram_topic}.${service}.*`,
  `${telegram_topic}.${type}.*`,
  `${telegram_topic}.${service}.${type}.*`
]

const log_error = (service, msg) => {
  if (telegram_integration)
    telegram_integration.publish(generate_topics(telegram_topic, service, 'error'), `${service} ${msg}`, true)
  console.error(service, msg)
}
const log_msg = (service, msg) => {
  if (telegram_integration)
    telegram_integration.publish(generate_topics(telegram_topic, service, 'log'), `${service} ${msg}`, false)
  console.log(service, msg)
}

const launch_http = async (host, url) => {
  http.add(host)
  const slug = host.replace(/:/g, '_')
  const handle = { type: 'http', host, url, slug, port: next_port(), status: 'launching' }
  handles.set(host, handle)
  if (!await exists(slug)) Deno.mkdir(slug)
  start(handle)
}

const launch_cmd = async (host, url) => {
  cmd.add(host)
  const slug = host.replace(/:/g, '_')
  const handle = { type: 'cmd', host, url, slug, status: 'launching' }
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
    log_error(handle.host, e)
    return
  }
  const payload = handle.type == 'http'
    ? {
      host: handle.host,
      url: handle.url,
      port: handle.port,
      fingerprint: handle.fingerprint
    }
    : {
      host: handle.host,
      url: handle.url,
      fingerprint: handle.fingerprint
    }
  handle.process = await Deno.run({
    cmd: `deno run --quiet --allow-net --allow-read=./ --allow-write=./ --reload=${handle.url} ${handle.url} ${JSON.stringify(payload)}`.split(' '),
    stdout: 'piped',
    stderr: 'piped',
    stdin: 'null',
    cwd: handle.slug
  })
  handle.status = 'running'
  log_msg(handle.host, 'running')
  ;(async () => {
    for await (const line of lines(handle.process.stdout)) log_msg(handle.host, line)
  })()
  ;(async () => {
    for await (const line of lines(handle.process.stderr)) log_error(handle.host, line)
  })()
  await handle.process.status()
  if (handle.status == 'running') {
    handle.status = 'stopped'
    log_msg(handle.host, 'stopped')
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
  log_msg(handle.host, 'restarting')
  await stop(handle)
  start(handle)
}

const remove_http = async handle => {
  http.delete(handle.host)
  handles.delete(handle.host)
  handle.status = 'stopping'
  log_msg(handle.host, 'stopping')
  stop(handle)
  used_ports.delete(handle.port)
}

const remove_cmd = async handle => {
  cmd.delete(handle.host)
  handles.delete(handle.host)
  handle.status = 'stopping'
  log_msg(handle.host, 'stopping')
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

const update = async state => {
  if (state.telegram && state.telegram.topic)
    telegram_topic = state.telegram.topic
  if (state.caddy && state.caddy.starting_port)
    starting_port = state.caddy.starting_port
  if (state.telegram && state.telegram.token && state.telegram.topic) {
    if (telegram_integration && telegram_integration.token != state.telegram.token) {
      console.log('restarting telegram integration')
      telegram_integration.close()
      telegram_integration = null
    }
    if (!telegram_integration) {
      console.log('starting telegram integration')
      telegram_integration = await telegram(state.telegram.token)
    }
  }
  else if (telegram_integration) {
    console.log('stopping telegram integration')
    telegram_integration.close()
    telegram_integration = null
  }
  {
    const newcmd = new Map(Object.entries(state.cmd || {}))
    const { put, del, same } = diff(cmd, newcmd)
    for (const key of put) launch_cmd(key, newcmd.get(key))
    for (const key of del) remove_cmd(handles.get(key))
    for (const key of same) {
      const newurl = newcmd.get(key)
      const handle = handles.get(key)
      if (handle.url == newurl) continue
      handle.url = newurl
      if (handle.status != 'stopped') continue
      start(handle)
    }
  }
  {
    const newhttp = new Map(Object.entries(state.http || {}))
    const { put, del, same } = diff(http, newhttp)
    for (const key of put) launch_http(key, newhttp.get(key))
    for (const key of del) remove_http(handles.get(key))
    for (const key of same) {
      const newurl = newhttp.get(key)
      const handle = handles.get(key)
      if (handle.url == newurl) continue
      handle.url = newurl
      if (handle.status != 'stopped') continue
      start(handle)
    }
    // no caddy and no http... no need
    if (!state.caddy && !state.http) return
    if (put.length > 0 || del.length > 0) {
      const caddy = { apps: { http: { servers: { srv0: {
        listen: [':443'],
        routes: (state.caddy ? state.caddy.routes : []).concat(Array.from(newhttp.keys(), host => ({
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
      caddy_fingerprint = fingerprint
      const response = await fetch('http://localhost:2019/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      })
      if (!response.ok) log_error('caddy_integration', await response.text())
    }
  }
}

let lasterror = null
const getstate = async () => {
  try {
    const res = await fetch(state_url)
    if (!res.ok) throw `${state_url} not available`
    return await res.json()
  }
  catch (e) {
    const error = e.toString()
    // squelch repeated errors
    if (lasterror != error) {
      lasterror = error
      log_error('state_integration', e)
    }
    throw e
  }
}

let state = await wait(getstate, 1000)
if (state.caddy && state.caddy.starting_port) starting_port = state.caddy.starting_port
await update(state)

const refresh_mutex = mutex()
const refresh = async () => {
  const release = await refresh_mutex.acquire()
  try {
    state = await getstate()
    await update(state)
  }
  catch (e) {
    console.error(e)
  }

  for (const [key, value] of handles.entries()) {
    if (value.status == 'running') shouldrefresh(value)
    else if (value.status == 'stopped') shouldretry(value)
    else if (value.status == 'retrying') start(value)
  }
  release()
  setTimeout(refresh, state.state_refresh || 10000)
}
setTimeout(refresh, state.state_refresh || 10000)
