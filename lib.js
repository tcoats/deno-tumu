// lib
const hash = s => [...s].reduce((hash, c) => (((hash << 5) - hash) + c.charCodeAt(0)) | 0, 0)
const rand = max => Math.floor(Math.random() * Math.floor(max))
const sleep = time => new Promise(res => setTimeout(res, time))
const wait = (fn, delay = 1000) => new Promise(async res => {
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
async function* lines(reader) {
  const decoder = new TextDecoder();
  let buf = new Uint8Array(100);
  let n = null
  let pending = ''
  while (n = await reader.read(buf)) {
    const chunks = `${pending}${decoder.decode(buf.subarray(0, n))}`.split('\n')
    for (const chunk of chunks.slice(0, -1)) yield chunk
    pending = chunks[chunks.length - 1]
  }
}

const base58 = n => {
  const alphabet = '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
  const base = alphabet.length
  let res = ''
  n = Number(n)
  while (n >= base) {
    const modulus = n % base
    res = alphabet[modulus] + res
    n = Math.floor(n / base)
  }

  return alphabet[n] + res
};

export { hash, rand, sleep, wait, exists, mutex, lines, base58 }
