const { host } = JSON.parse(Deno.args[0])

const ping = () => {
  console.log('ping')
  setTimeout(ping, 5000)
}
ping()
